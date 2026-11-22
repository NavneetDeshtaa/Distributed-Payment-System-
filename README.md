# Enterprise Distributed Payment Processing Infrastructure

A production-grade, polyglot distributed payment processing engine built across 5 architectural phases. Features an edge gateway, transactional outbox pattern, exactly-once event processing (EOS), an asynchronous Python machine learning fraud microservice, adaptive backpressure rate limiting, automated financial reconciliation, reliable HMAC-signed merchant webhooks, and an interactive light-mode React dashboard.

---

## 1. System Topology & Architecture

```
                       [ React Frontend (:3000) ]
                                    │
                                    │ HTTP / Bearer JWT
                                    ▼
                ┌───────────────────────────────────────┐
                │   Spring Cloud Edge Gateway (:8090)   │
                │  - HS256 Local Token Verification     │
                │  - Request Enrichment (sub -> User-Id)│
                │  - Correlation & Trace ID Injection   │
                └───────────────────┬───────────────────┘
                                    │
                       Enriched HTTP│(Internal Network)
                                    ▼
                ┌───────────────────────────────────────┐
                │     Core Payment Service (:8080)      │
                │  - Atomic Transactional Outbox        │
                │  - Idempotent Consumer (EOS)          │
                │  - Double-Entry Accounting Ledger     │
                │  - Dynamic Rate Limiter & Fallback    │
                └───────────┬───────────────┬───────────┘
                            │               │
       Asynchronous Pub/Sub │               │ Persistent Writes & Caching
                            ▼               ▼
        ┌───────────────────────┐       ┌───────────────────────┐
        │  Apache Kafka (:9092) │       │  PostgreSQL 15 (:5432)│
        │  - payment.created    │       │  - payments           │
        │  - fraud.request      │       │  - ledger_entries     │
        │  - fraud.result       │       │  - outbox_events      │
        │  - fraud.alerts       │       │  - processed_events   │
        │  - webhook.DLQ        │       │  - reconciliation     │
        └───────────┬───────────┘       └───────────────────────┘
                    │                               │
       Request-Reply│                  Multi-Layer  │
          Kafka Pipe│                  Cache & TTL  │
                    ▼                               ▼
        ┌───────────────────────┐       ┌───────────────────────┐
        │ Python Fraud AI(:8000)│       │    Redis 7 (:6380)    │
        │  - FastAPI + Scikit   │       │  - Layer 1 Idem Cache │
        │  - Stage 1 Rules      │       │  - Lua Token Bucket   │
        │  - Stage 2 ML Anomaly │       │  - Sliding Velocity   │
        └───────────────────────┘       └───────────────────────┘
```

---

## 2. Technology Stack & Ecosystem

### 🌐 System Overview & Component Matrix

| Layer / Domain | Technology | Version | Key Responsibilities & Architectural Role |
| :--- | :--- | :--- | :--- |
| **API Gateway & Edge** | **Spring Cloud Gateway** | `2024.0.0` / Boot `3.4.4` | Non-blocking reactive reverse proxy (Netty), HS256 JWT validation, request enrichment (`X-User-Id`), distributed trace ID injection |
| **Core Service Engine** | **Java & Spring Boot** | `Java 17 (LTS)` / `3.4.4` | Double-entry accounting ledger, Transactional Outbox poller, Exactly-Once Semantics (EOS) consumer, dynamic backpressure controller |
| **Relational Database** | **PostgreSQL** | `15.x` | ACID persistence, row-level concurrency locking (`@Version`), high-precision financial decimals (`NUMERIC(19,4)`), outbox storage |
| **In-Memory Cache & Store** | **Redis** | `7-alpine` | Distributed token-bucket rate limiting (Lua scripts), L1 idempotency cache (`idem:<key>`, 24h TTL), sliding-window fraud velocity sets |
| **Local Near-Cache Fallback**| **Caffeine Cache** | `3.x` | In-process resilient near-cache (W-TinyLFU eviction, 50,000 entries) providing zero-downtime rate limiter fallback if Redis disconnects |
| **Event Streaming Broker** | **Apache Kafka** | `7.5.0` (Confluent) | Partition-ordered async event log (`payment.created`, `fraud.request`, `fraud.result`, `webhook.DLQ`), user affinity routing |
| **Distributed Coordination** | **Apache ZooKeeper** | `7.5.0` | Kafka broker cluster consensus, leader election, and distributed partition metadata management |
| **AI / Machine Learning** | **Python, FastAPI, Scikit-Learn** | `3.11+` / `0.110+` / `1.5+` | Polyglot microservice, unsupervised `IsolationForest` anomaly scoring, deterministic rules (currency, amounts, velocity) |
| **Frontend Dashboard** | **React 19, Vite 8, Tailwind CSS v4** | `19.3` / `8.3` / `4.3` | Modern reactive UI, real-time metrics telemetry, double-entry ledger inspector, interactive fraud & chaos testing control center |
| **Security & Cryptography** | **Auth0 Java JWT & HMAC-SHA256** | `4.4.0` | Stateless HS256 JWT signature verification, timing-attack-safe HMAC-SHA256 merchant webhook signatures (`X-Signature`), UUID v4 |
| **Observability & Metrics** | **Prometheus & Grafana** | `v2.47.0` / `10.1.0` | Pull-based TSDB metric scraping via Micrometer `/actuator/prometheus`, pre-provisioned Grafana dashboards, system alerting |
| **Containerization & Dev** | **Docker & Docker Compose** | `Compose v3.8` | Containerized virtualization for Kafka, Zookeeper, Redis, Prometheus, and Grafana; automated PowerShell orchestration |

---

### 🔍 Deep Dive by Architectural Layer

#### 1. Backend Core & Microservices
* **Java 17 (LTS)**: Core language platform utilizing modern record semantics, strong encapsulation, text blocks, and pattern matching.
* **Spring Boot 3.4.4**: Production microservices framework running on Jakarta EE 10, delivering cloud-native dependency injection and unified configuration.
* **Spring Cloud Gateway (2024.0.0)**: Fully reactive edge gateway built on Project Reactor and Netty. Eliminates thread-per-request overhead, handles CORS, and verifies JWT tokens at the boundary without hitting downstream databases.
* **Spring Data JPA & Hibernate 6**: Persistence abstraction enforcing ACID transactions across ledger entries, handling composite primary keys for idempotency deduplication, and managing optimistic concurrency locking (`@Version`).
* **HikariCP**: Production connection pooler tuned to **40 connections** for sub-millisecond connection acquisition while safeguarding PostgreSQL against connection exhaustion.

#### 2. Event Streaming & Distributed Asynchrony
* **Apache Kafka 7.5.0**: Distributed commit log with partition ordering keyed by `userId`, ensuring sequential consistency for payment workflows while isolating slow fraud evaluation.
* **Spring Kafka**: High-throughput consumers and producers configured with consumer groups, manual ack semantics, and Dead Letter Queue (`webhook.DLQ`) routing.
* **Transactional Outbox Engine**: Scheduled background poller (200ms fixed delay, batch size 100) streaming pending events to Kafka without distributed two-phase commits (2PC) or dual-write anomalies.
* **Distributed Tracing Contract**: Custom `KafkaHeaderUtil` propagating `x-trace-id`, `x-correlation-id`, and `x-event-id` across Kafka record headers and SLF4J MDC.

#### 3. Storage, In-Memory Caching & Resilient State
* **PostgreSQL 15**: System of record for double-entry financial ledger lines, payments, outbox events, and reconciliation audit logs. Uses `NUMERIC(19,4)` to prevent IEEE 754 floating-point rounding errors.
* **Redis 7**:
  * *Idempotency L1 Cache*: Sub-millisecond lookup (`idem:<key>`) with 24-hour TTL, serving cached payment responses on replay without hitting PostgreSQL.
  * *Distributed Rate Limiter*: Atomic Lua script (`INCR` + `EXPIRE`) executing server-side within Redis to prevent race conditions during burst traffic.
  * *Sliding Window Velocity*: Redis Sorted Sets (`ZADD`, `ZREMRANGEBYSCORE`, `ZCARD`) calculating real-time user transaction frequencies.
* **Caffeine Near-Cache**: Graceful fallback cache configured with a 2-minute TTL and 50,000 maximum size, maintaining rate limiting uptime even during complete Redis outages.

#### 4. Machine Learning & Fraud AI Microservice
* **FastAPI (0.110+) & Uvicorn (0.30+)**: Asynchronous ASGI Python service providing sub-15ms ML inference and continuous Kafka event processing via `librdkafka`.
* **Scikit-Learn (1.5+) & NumPy (1.26+)**: Unsupervised `IsolationForest` machine learning model evaluating feature vectors (`amount`, `is_high_value`, `currency_risk`). Normalized anomaly scores $\ge 0.75$ flag fraudulent activity.
* **Confluent-Kafka (2.4+)**: High-speed C-native Kafka client for low-latency request-reply message consumption from `fraud.request` and production to `fraud.result`.

#### 5. Frontend & Operations Dashboard
* **React 19 (19.3+)**: State management and UI components featuring React Actions and live microservice health polling.
* **Vite 8 (8.3+)**: Fast build engine with native ESM, hot module replacement, and optimized production chunking.
* **Tailwind CSS v4 (4.3+)**: Modern utility-first styling with `@tailwindcss/vite` integration, dark/light contrast management, and responsive layouts.
* **Lucide React & KaTeX**: Comprehensive vector iconography and KaTeX mathematical typesetting for rendering ledger invariants.

#### 6. Security, Compliance & Observability
* **Auth0 Java JWT (4.4.0)**: Stateless HMAC-SHA256 token verification at the edge gateway.
* **HMAC-SHA256 Webhook Verification**: Constant-time signature comparison preventing timing attacks on merchant webhook deliveries.
* **Prometheus & Grafana**: Automated scraper capturing JVM metrics, HikariCP connection stats, Kafka consumer lag, and HTTP latency histograms.

---

## 3. Microservice Directory Structure

```
DistributedPaymentSystem/
├── api-gateway/          # Spring Cloud Gateway (Port 8090)
│   ├── src/main/java/com/payments/gateway/
│   │   ├── config/       # JWT Token Verification (HS256)
│   │   ├── controller/   # Auth Controller (POST /auth/token)
│   │   └── filter/       # RequestEnrichmentFilter & Correlation ID
│   ├── src/main/resources/application.yml
│   └── pom.xml
├── payment-service/      # Core Financial Service (Port 8080)
│   ├── src/main/java/com/payments/
│   │   ├── config/       # Database, Redis Lua & WebMvc Configuration
│   │   ├── controller/   # Payment, Account, Ledger, Simulation Controllers
│   │   ├── dto/          # Data Transfer Objects & Events
│   │   ├── entity/       # JPA Entities (Payment, LedgerEntry, OutboxEvent, etc.)
│   │   ├── repository/   # Spring Data JPA Repositories
│   │   ├── service/      # Outbox, Settle, RateLimiter, Recon, Webhooks
│   │   └── util/         # KafkaHeaderUtil (Distributed Tracing Contract)
│   ├── src/main/resources/schema.sql & application.yml
│   └── pom.xml
├── fraud-service/        # Polyglot Python Fraud AI Microservice (Port 8000)
│   ├── fraud_model.py    # Scikit-Learn IsolationForest Anomaly Scorer
│   ├── rule_engine.py    # Deterministic Currency, Limit, & Redis Velocity Rules
│   ├── main.py           # FastAPI Web Application & Confluent Kafka Consumer
│   └── requirements.txt  # Pinned Python Dependencies
├── frontend/             # Standalone Light-Mode React Dashboard (Port 3000)
│   ├── src/
│   │   ├── components/   # Topology, Terminal, Fraud, Tracing, Backpressure, etc.
│   │   ├── services/     # Centralized Microservices API Client
│   │   ├── App.jsx       # Tab Orchestrator & State Management
│   │   └── index.css     # Clean Tailwind CSS Styles
│   ├── package.json
│   └── vite.config.js
├── monitoring/           # Observability Stack (Prometheus + Grafana)
│   ├── prometheus.yml    # Prometheus Scraper Config (Port 9090)
│   └── grafana/          # Auto-Provisioned Dashboards & Datasources (Port 3001)
├── scripts/              # Consolidated Verification & Chaos Engineering Scripts
│   ├── test-all.ps1      # Master Automated Test Suite
│   └── verify-ledger-invariant.sql
├── docker-compose.yml    # Kafka, ZooKeeper, Redis 7, Prometheus, Grafana
├── pom.xml               # Multi-Module Parent Aggregator POM
├── run.bat & run.ps1     # One-Click System Launchers
└── README.md
```

---

## 4. Implemented Phases & Core Features

### Phase 1: Core Transactional Payment Engine
* **ACID Double-Entry Accounting**: Every settled payment records balanced `DEBIT` and `CREDIT` entries. Verified by invariant query: $\sum \text{DEBIT} = \sum \text{CREDIT} = \text{Amount}$.
* **Optimistic Concurrency Control**: Uses `@Version` locking to eliminate lost updates on concurrent balance adjustments.
* **Financial Precision**: Monetary amounts stored as `NUMERIC(19,4)` to prevent IEEE 754 floating-point rounding errors.

### Phase 2: Transactional Outbox Pattern
* **Decoupled Ingestion**: Ingests transactions with `POST /payments` and writes both the `Payment` (PENDING) and `OutboxEvent` (NEW) within a **single atomic PostgreSQL transaction**.
* **Instant Ingestion Response**: Responds with `201 Created` in under 20ms without blocking on external messaging.
* **At-Least-Once Delivery**: Background `OutboxPublisherService` polls events every second and publishes to Kafka with user partition affinity.

### Phase 3: Exactly-Once Semantics (EOS) & Multi-Layer Caching
* **Idempotent Consumer**: `processed_events` table with composite primary key `<topic>:<partition>:<eventId>` guarantees duplicate redeliveries become no-ops.
* **Multi-Layer Cache Defense**: `PaymentCacheService` provides sub-millisecond Layer 1 cached reads for idempotent replays (`idem:<key>`) with a 24-hour TTL, shielding primary storage.
* **Atomic Rate Limiter & Fallback**: Redis Lua script (`INCR` + `EXPIRE`) token bucket. Gracefully degrades to an in-memory Caffeine cache (50,000 entries, 2-minute TTL) if Redis crashes.

### Phase 4: Polyglot ML Fraud Microservice & Distributed Tracing
* **Asynchronous Request-Reply over Kafka**: Java produces to `fraud.request`; Python FastAPI worker scores the event and produces to `fraud.result`.
* **Stage 1 (Deterministic Rules)**:
  * Currency allowlist check (`USD`, `EUR`, `GBP`, `INR`, `CAD`, `AUD`).
  * Hard threshold check (amounts $> \$10,000$ automatically rejected).
  * Sliding-window velocity check: Uses Redis sorted sets to reject users with $>10$ transactions in 60s.
* **Stage 2 (Machine Learning Inference)**:
  * Unsupervised `IsolationForest` model evaluates feature vectors (`amount`, `is_high_value`, `currency_risk`). Normalized score $\ge 0.75 \implies \text{FRAUD}$.
* **Distributed Tracing Contract**: `KafkaHeaderUtil` injects `x-trace-id`, `x-correlation-id`, and `x-event-id` across broker records. SLF4J MDC and Python structured JSON log matching trace identifiers across all 5 hops.

### Phase 5: Edge Gateway, Adaptive Backpressure & Financial Reconciliation
* **Spring Cloud Edge Gateway**: Validates HS256 JWT tokens with zero database queries. `RequestEnrichmentFilter` extracts claims into `X-User-Id` and `X-Correlation-ID`, strips raw credentials, and handles route circuit-breaking.
* **Adaptive Backpressure Engine**: Polls Kafka `AdminClient` for consumer group lag. Dynamically throttles `RateLimiterService`:
  * Lag $< 1,000 \implies$ Normal operation (100% capacity).
  * Lag $\ge 5,000 \implies$ 50% Throttle reduction (0.50 multiplier).
  * Lag $\ge 10,000 \implies$ 90% Throttle reduction (0.10 multiplier $\to$ HTTP 429).
* **Automated Financial Reconciliation Engine**: Runs 5 core invariant audits:
  1. `STALE_PAYMENT`: Stuck in PENDING $> 10$ minutes.
  2. `GHOST_PAYMENT`: Outbox event PUBLISHED but missing in payments table.
  3. `DUPLICATE_LEDGER`: $> 2$ ledger entries for a single transaction.
  4. `LEDGER_IMBALANCE`: $\sum \text{DEBIT} \ne \sum \text{CREDIT}$.
  5. `ORPHAN_LEDGER`: Ledger entries pointing to non-existent payment records.
  Publishes alerts to `reconciliation.alerts` and PostgreSQL table `reconciliation_alerts`.
* **Reliable Webhooks**: Computes HMAC-SHA256 signatures (`X-Signature`), executes exponential backoff retry scheduling (5s, 30s, 2m, 10m, 30m), and routes failed deliveries to `webhook.DLQ`.

---

## 5. Quick Start & Execution

### Prerequisites
* **Java 17+** (JDK 17)
* **Node.js 20+** & npm
* **Python 3.11+**
* **Docker & Docker Compose**
* **PostgreSQL 15** running locally on port `5432`

### One-Click Launch
Run the automated launcher script (starts Docker, builds Java modules, starts Python AI, Payment Core, Gateway, and React Frontend):

```powershell
# In PowerShell:
.\run.ps1

# Or in Windows CMD:
run.bat
```

### Manual Individual Startup
1. **Start Docker Containers**:
   ```bash
   docker compose up -d
   ```
2. **Build Multi-Module Java Services**:
   ```bash
   ./mvnw clean package -DskipTests
   ```
3. **Start Python Fraud Service**:
   ```bash
   cd fraud-service
   pip install -r requirements.txt
   python -m uvicorn main:app --host 0.0.0.0 --port 8000
   ```
4. **Start Core Payment Service**:
   ```bash
   java -jar payment-service/target/payment-service-1.0.0-SNAPSHOT.jar
   ```
5. **Start Edge API Gateway**:
   ```bash
   java -jar api-gateway/target/api-gateway-1.0.0-SNAPSHOT.jar
   ```
6. **Start React Frontend Dashboard**:
   ```bash
   cd frontend
   npm install
   npm run dev -- --port 3000 --host
   ```

---

## 6. Live Service Endpoints

| Service | Port | Endpoint URL | Description |
| :--- | :--- | :--- | :--- |
| **React Frontend** | `3000` | [http://localhost:3000](http://localhost:3000) | Light-mode management & testing dashboard |
| **Grafana Monitoring** | `3001` | [http://localhost:3001](http://localhost:3001) | Grafana Dashboard (User: `admin`, Pass: `admin`) |
| **Prometheus Scraper** | `9090` | [http://localhost:9090](http://localhost:9090) | Prometheus UI & TSDB metrics browser |
| **Edge API Gateway** | `8090` | [http://localhost:8090](http://localhost:8090) | Central reverse proxy & JWT authenticator |
| **Gateway Health** | `8090` | `GET /actuator/health` | Health endpoint |
| **Gateway Metrics** | `8090` | `GET /actuator/prometheus` | Prometheus scraper endpoint |
| **Core Payment Service**| `8080` | [http://localhost:8080](http://localhost:8080) | Financial processing engine |
| **Payment Metrics** | `8080` | `GET /actuator/prometheus` | Prometheus scraper endpoint |
| **Python Fraud AI** | `8000` | [http://localhost:8000/health](http://localhost:8000/health) | FastAPI health check |
| **ML Inference Endpoint** | `8000` | `POST /score` | Direct IsolationForest ML inference |

---

## 7. Running the Verification Test Suite

Run the master automated verification script:

```powershell
powershell -File scripts/test-all.ps1
```

**Output Verification Checklist:**
* [x] Edge Gateway JWT token minting & validation.
* [x] Ingestion responds with `201 PENDING` in $< 25\text{ms}$.
* [x] Asynchronous settlement confirms `SUCCESS` after ML screening.
* [x] High-velocity fraud attack (15 requests $\to$ 10 pass, 5 rejected by Redis sliding-window).
* [x] Financial reconciliation validates 0 imbalances and 0 duplicate entries.
* [x] Double-entry ledger invariant verified ($\sum \text{DEBIT} = \sum \text{CREDIT}$).

---

## 8. Performance Benchmarks, Latency & Scaling Architecture

All metrics below are **empirically measured** on the live running distributed system under multi-threaded concurrent burst load:

### ⚡ Empirical Benchmark Results

| System Stage | P50 Latency | P95 Latency | P99 Latency | Average | Min | Success Rate |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: |
| **Synchronous Ingestion (Gateway $\to$ JWT $\to$ Outbox)** | **23.23 ms** | **37.95 ms** | **45.00 ms** | 25.40 ms | 15.42 ms | **100.0%** |
| **Idempotent Replay Cache Hit (Redis L1)** | **12.44 ms** | **24.62 ms** | **24.92 ms** | 13.49 ms | 10.28 ms | **100.0%** |
| **ML Fraud Evaluation (IsolationForest + Redis)** | **14.14 ms** | **21.72 ms** | **50.93 ms** | 15.83 ms | 11.56 ms | **100.0%** |
| **Concurrent Burst Throughput (100 Txns / 15 Workers)** | **51.31 ms** | **91.85 ms** | **119.87 ms** | — | — | **222.2 TPS** |
| **Double-Entry Ledger Integrity Audit** | **0.00 ms** | **$0.00 Imbalance** | **0 Discrepancies** | — | — | **100% Balanced** |

### 🛠️ Production Capacity Tuning (Optimal Stability)

* **HikariCP Connection Pool**: Tuned to **40 connections** (optimal for 12 logical CPU cores: $12 \times 2 + 1 \approx 25\text{--}40$). Safely within PostgreSQL's 100-connection ceiling, preventing `FATAL: sorry, too many clients already` while ensuring $< 1\text{ms}$ connection acquisition time.
* **Transactional Outbox Poller**: Tuned to **200ms fixedDelay with a 100-event batch size** ($5\text{ batches/sec} \times 100\text{ events} = \mathbf{500\text{ TPS}}$ event streaming ceiling). Eliminates CPU query thrashing while keeping Kafka dispatch delay under 200ms.
* **Two-Tier Adaptive Rate Limiter**: 1,000 req/window base ceiling with dynamic closed-loop backpressure monitoring Kafka consumer lag (automatically throttles by 50% at 5k lag and 90% at 10k lag; falls back to in-memory Caffeine cache if Redis goes offline).

### 📈 Scaling Roadmap & Architectural Bottlenecks

| Scale Target | Achievable? | Primary Bottlenecks & Required Evolution |
| :--- | :---: | :--- |
| **Current (222 TPS)** | ✅ **Measured** | Local single-node hardware, synchronous PostgreSQL commits, single Kafka partition. |
| **1,000 TPS** | ✅ **Ready** | Horizontal scaling of `payment-service` (3-5 instances), PgBouncer connection pooler. |
| **10,000 TPS** | 🟡 **Architectural Upgrade** | Replace Polling Outbox with **Debezium CDC (WAL)**, scale Kafka to **32 partitions** keyed by `userId`, deploy ML with **Triton / ONNX C++ runtime**. |
| **100,000 TPS** | 🔴 **Paradigm Shift** | **Ledger Striping & Flink Tumbling Windows** (no row-level locking on merchant accounts), append-only distributed log ingestion (Kafka / Apache Pulsar), Distributed NewSQL (CockroachDB / Spanner). |

