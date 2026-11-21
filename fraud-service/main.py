import json
import logging
import threading
import time
from typing import Optional
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from confluent_kafka import Consumer, Producer, KafkaError

from fraud_model import FraudMLScorer
from rule_engine import RuleEngine

# Structured JSON Logger
class JsonFormatter(logging.Formatter):
    def format(self, record):
        log_obj = {
            "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime(record.created)),
            "level": record.levelname,
            "service": "fraud-service",
            "message": record.getMessage()
        }
        if hasattr(record, "trace_id"):
            log_obj["trace_id"] = record.trace_id
        if hasattr(record, "details"):
            log_obj["details"] = record.details
        return json.dumps(log_obj)

logger = logging.getLogger("fraud_service")
handler = logging.StreamHandler()
handler.setFormatter(JsonFormatter())
logger.addHandler(handler)
logger.setLevel(logging.INFO)

app = FastAPI(title="Polyglot ML Fraud Microservice", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

rule_engine = RuleEngine()
ml_scorer = FraudMLScorer()

KAFKA_BOOTSTRAP = "localhost:9092"
TOPIC_REQUEST = "fraud.request"
TOPIC_RESULT = "fraud.result"

class ScoreRequest(BaseModel):
    payment_id: str
    user_id: str
    amount: float
    currency: str
    trace_id: Optional[str] = "tr-direct"

class ScoreResponse(BaseModel):
    payment_id: str
    fraud: bool
    reason: Optional[str] = None
    stage: str
    score: float
    trace_id: str

def evaluate_transaction(payment_id: str, user_id: str, amount: float, currency: str, trace_id: str) -> dict:
    """
    Two-Stage Evaluation Pipeline:
    Stage 1: Deterministic Rules (Amount, Currency, Velocity)
    Stage 2: Machine Learning Anomaly Scoring (Isolation Forest)
    """
    # Stage 1: Rules
    rule_fraud, rule_reason = rule_engine.evaluate(user_id, amount, currency)
    if rule_fraud:
        logger.info(
            f"Stage 1 Rule Rejection: {rule_reason}",
            extra={"trace_id": trace_id, "details": {"payment_id": payment_id, "user_id": user_id, "stage": "rule", "fraud": True}}
        )
        return {
            "paymentId": payment_id,
            "payment_id": payment_id,
            "fraud": True,
            "reason": rule_reason,
            "stage": "rule",
            "score": 1.0,
            "traceId": trace_id,
            "trace_id": trace_id
        }

    # Stage 2: ML Scoring
    score, ml_fraud = ml_scorer.score(amount, currency)
    reason = "IsolationForest anomaly probability score >= 0.75" if ml_fraud else "Passed fraud screening"
    
    logger.info(
        f"Stage 2 ML Evaluation: score={score}, fraud={ml_fraud}",
        extra={"trace_id": trace_id, "details": {"payment_id": payment_id, "score": score, "stage": "ml", "fraud": ml_fraud}}
    )

    return {
        "paymentId": payment_id,
        "payment_id": payment_id,
        "fraud": ml_fraud,
        "reason": reason if ml_fraud else None,
        "stage": "ml",
        "score": score,
        "traceId": trace_id,
        "trace_id": trace_id
    }

@app.post("/score", response_model=ScoreResponse)
def score_endpoint(req: ScoreRequest):
    result = evaluate_transaction(req.payment_id, req.user_id, req.amount, req.currency, req.trace_id)
    return ScoreResponse(**result)

@app.get("/health")
def health():
    return {"status": "UP", "service": "fraud-service", "rule_engine": "ACTIVE", "ml_model": "LOADED"}

def start_kafka_pipeline():
    """
    Multithreaded Kafka Request-Reply pipeline using confluent-kafka (librdkafka):
    Listens to 'fraud.request' -> Evaluates -> Publishes to 'fraud.result'
    """
    def run_consumer():
        time.sleep(2) # Wait for Kafka startup
        try:
            consumer_conf = {
                'bootstrap.servers': KAFKA_BOOTSTRAP,
                'group.id': 'python-fraud-evaluator-group',
                'auto.offset.reset': 'earliest',
                'enable.auto.commit': True
            }
            producer_conf = {
                'bootstrap.servers': KAFKA_BOOTSTRAP
            }
            consumer = Consumer(consumer_conf)
            producer = Producer(producer_conf)

            consumer.subscribe([TOPIC_REQUEST])
            logger.info("Kafka Fraud Consumer successfully connected and listening to 'fraud.request'")

            while True:
                msg = consumer.poll(timeout=1.0)
                if msg is None:
                    continue
                if msg.error():
                    if msg.error().code() == KafkaError._PARTITION_EOF:
                        continue
                    logger.error(f"Kafka consumer error: {msg.error()}")
                    continue

                try:
                    payload = json.loads(msg.value().decode("utf-8"))
                    headers_dict = {}
                    if msg.headers():
                        for k, v in msg.headers():
                            headers_dict[k] = v.decode("utf-8") if v else ""

                    trace_id = headers_dict.get("x-trace-id", payload.get("traceId", "tr-unknown"))
                    correlation_id = headers_dict.get("x-correlation-id", payload.get("correlationId", "corr-unknown"))
                    event_id = headers_dict.get("x-event-id", payload.get("eventId", ""))

                    payment_id = payload.get("paymentId", "")
                    user_id = payload.get("userId", "")
                    amount = float(payload.get("amount", 0.0))
                    currency = payload.get("currency", "USD")

                    # Execute 2-stage evaluation
                    evaluation = evaluate_transaction(payment_id, user_id, amount, currency, trace_id)
                    evaluation["correlationId"] = correlation_id
                    evaluation["eventId"] = event_id
                    evaluation["userId"] = user_id
                    evaluation["amount"] = amount
                    evaluation["currency"] = currency

                    # Publish response to fraud.result with tracing headers
                    out_headers = [
                        ("x-trace-id", trace_id.encode("utf-8")),
                        ("x-correlation-id", correlation_id.encode("utf-8")),
                        ("x-event-id", event_id.encode("utf-8"))
                    ]

                    producer.produce(
                        TOPIC_RESULT,
                        key=user_id.encode("utf-8"),
                        value=json.dumps(evaluation).encode("utf-8"),
                        headers=out_headers
                    )
                    producer.flush()

                except Exception as ex:
                    logger.error(f"Error evaluating Kafka message: {ex}")

        except Exception as ex:
            logger.error(f"Kafka pipeline startup error: {ex}")

    t = threading.Thread(target=run_consumer, daemon=True)
    t.start()

@app.on_event("startup")
def on_startup():
    start_kafka_pipeline()

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=False)
