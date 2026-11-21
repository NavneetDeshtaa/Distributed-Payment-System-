package com.payments.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.payments.dto.FraudResultEvent;
import com.payments.dto.PaymentCreatedEvent;
import com.payments.entity.Payment;
import com.payments.entity.PaymentStatus;
import com.payments.repository.PaymentRepository;
import com.payments.util.KafkaHeaderUtil;
import org.apache.kafka.clients.consumer.ConsumerRecord;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.slf4j.MDC;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.kafka.support.Acknowledgment;
import org.springframework.stereotype.Service;

import java.util.UUID;

@Service
public class FraudResultConsumer {

    private static final Logger log = LoggerFactory.getLogger(FraudResultConsumer.class);
    private static final String FRAUD_ALERTS_TOPIC = "fraud.alerts";

    private final ObjectMapper objectMapper;
    private final PaymentRepository paymentRepository;
    private final PaymentAsyncSettlementService settlementService;
    private final WebhookService webhookService;
    private final KafkaTemplate<String, String> kafkaTemplate;

    public FraudResultConsumer(ObjectMapper objectMapper,
                               PaymentRepository paymentRepository,
                               PaymentAsyncSettlementService settlementService,
                               WebhookService webhookService,
                               KafkaTemplate<String, String> kafkaTemplate) {
        this.objectMapper = objectMapper;
        this.paymentRepository = paymentRepository;
        this.settlementService = settlementService;
        this.webhookService = webhookService;
        this.kafkaTemplate = kafkaTemplate;
    }

    /**
     * Consumes evaluation from Python Fraud Microservice on 'fraud.result'.
     *
     * Distributed Tracing Contract:
     * - Sets MDC trace_id from 'x-trace-id' Kafka header.
     *
     * If fraud == false:
     *   Logs: "traceId=... Fraud check passed, updating ledger."
     *   Executes double-entry settlement in DB transaction.
     *   Marks Payment status = SUCCESS.
     *   Dispatches HMAC-signed merchant webhook.
     *
     * If fraud == true:
     *   Logs: "traceId=... Fraud check failed: [reason]"
     *   Marks Payment status = FRAUD_REJECTED.
     *   Emits alert to 'fraud.alerts' Kafka topic.
     */
    @KafkaListener(topics = "fraud.result", groupId = "fraud-result-consumer-group")
    public void consumeFraudResult(ConsumerRecord<String, String> record, Acknowledgment ack) {
        String traceId = KafkaHeaderUtil.setupMdc(record);
        Payment payment = null;

        try {
            FraudResultEvent result = objectMapper.readValue(record.value(), FraudResultEvent.class);
            UUID paymentId = UUID.fromString(result.getPaymentId());

            payment = paymentRepository.findById(paymentId)
                    .orElse(null);

            if (payment == null) {
                log.warn("Payment not found for id={} in fraud.result", paymentId);
                if (ack != null) ack.acknowledge();
                return;
            }

            if (!result.isFraud()) {
                // Fraud Check Passed -> Proceed with async settlement
                log.info("Fraud check passed (score={}, stage={}), updating ledger for paymentId={}",
                        result.getScore(), result.getStage(), payment.getId());

                PaymentCreatedEvent settlementEvent = new PaymentCreatedEvent(
                        payment.getId(),
                        payment.getUserId(),
                        payment.getMerchantId(),
                        payment.getAmount(),
                        payment.getCurrency(),
                        payment.getIdempotencyKey(),
                        traceId,
                        payment.getCreatedAt()
                );

                settlementService.settlePaymentTransaction(settlementEvent);

                // Dispatch HMAC signed merchant webhook
                webhookService.dispatchWebhook(payment);

            } else {
                // Fraud Detected -> Reject payment
                log.warn("🚨 FRAUD DETECTED by stage '{}': {}. Marking paymentId={} as FRAUD_REJECTED.",
                        result.getStage(), result.getReason(), payment.getId());

                payment.setStatus(PaymentStatus.FRAUD_REJECTED);
                paymentRepository.saveAndFlush(payment);

                // Emit alert to Kafka
                try {
                    kafkaTemplate.send(FRAUD_ALERTS_TOPIC, payment.getUserId(),
                            "[FRAUD REJECTED] paymentId=" + payment.getId() + " user=" + payment.getUserId() +
                            " amount=" + payment.getAmount() + " reason=" + result.getReason());
                } catch (Exception e) {
                    log.error("Failed to emit fraud alert: {}", e.getMessage());
                }
            }

            if (ack != null) {
                ack.acknowledge();
            }

        } catch (Exception ex) {
            log.error("Error processing fraud.result: {}", ex.getMessage(), ex);
            try {
                if (payment != null && payment.getStatus() == PaymentStatus.PENDING) {
                    payment.setStatus(PaymentStatus.FAILED);
                    paymentRepository.saveAndFlush(payment);
                }
            } catch (Exception markEx) {
                log.error("Failed to mark payment as FAILED: {}", markEx.getMessage());
            }
            if (ack != null) ack.acknowledge();
        } finally {
            KafkaHeaderUtil.clearMdc();
        }
    }
}
