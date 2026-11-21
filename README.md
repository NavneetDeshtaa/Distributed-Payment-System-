# Distributed Payment Infrastructure — Phase 2: Decoupled Outbox Core

## Overview
Phase 2 decouples client payment ingestion from background balance mutation and ledger settlement using **Apache Kafka** and the **Transactional Outbox Pattern**. This eliminates the Dual-Write Problem, prevents database connection pool exhaustion, and drops ingestion response latency to sub-20ms.

```
[ Client / Web UI ]
         │
         │ POST /payments (Header: Idempotency-Key)
         ▼
┌────────────────────────────────────────────────────────────────────────┐
│                   Payment Service (Spring Boot 3.4.4)                  │
│                                                                        │
│   @Transactional:                                                      │
│     1. SELECT ... FOR UPDATE (Idempotency check)                       │
│     2. INSERT INTO payments (status = 'PENDING')                       │
│     3. INSERT INTO outbox_events (status = 'NEW', partition_key=userId)│
│   COMMIT                                                               │
│   Return 201 Created (Instant sub-20ms ingestion response!)            │
└──────────────────────────────────┬─────────────────────────────────────┘
                                   │
              ┌────────────────────┴────────────────────┐
              │ Background Poller (@Scheduled every 1s) │
              ▼                                         ▼
   [ outbox_events Table ]                    [ Apache Kafka 7.5 ]
   (Mark status = 'PUBLISHED')   ───────────▶ (Topic: payment.created)
                                                        │
                                                        ▼
                                              [ PaymentEventConsumer ]
                                              (Records ledger entries async)
                                                        │
                                                        ▼
                                            [ Update status = SUCCESS ]
```

---

## 1. What is Built in Phase 2

### Infrastructure
- **Apache Kafka (Confluent 7.5.0) & ZooKeeper**: Running via Docker Compose on port `9092` (host) and `29092` (internal).
- **PostgreSQL Database (`payments`)**: Local PostgreSQL with schema additions.

### PostgreSQL Database Additions (`schema.sql`)
- `outbox_events` table:
  - `id`: UUID (Primary Key)
  - `event_type`: VARCHAR(100) (`PAYMENT_CREATED`)
  - `aggregate_id`: VARCHAR(255) (payment ID)
  - `partition_key`: VARCHAR(255) (`userId` for Kafka partition affinity)
  - `payload`: TEXT (JSON event payload)
  - `status`: VARCHAR(50) (`NEW`, `PUBLISHED`, `FAILED`)
  - `retry_count`: INT (Retry attempts on broker failure)
  - `trace_id`: VARCHAR(255) (Distributed trace context)
  - `created_at`, `updated_at`: TIMESTAMP WITH TIME ZONE
- `payments.status`: Updated to support `PENDING`, `SUCCESS`, and `FAILED`.

### Core Application Services
- `PaymentService`: Ingests payments synchronously into PostgreSQL (`PENDING` + `OutboxEvent NEW`) within the **same local ACID transaction**, returning `201 Created` instantly.
- `OutboxPublisherService`: Background scheduler polling up to 50 `NEW` events every second and publishing to Kafka with `userId` partition key.
- `PaymentEventConsumer`: Kafka listener on `payment.created` with manual acknowledgment (`MANUAL_IMMEDIATE`).
- `PaymentAsyncSettlementService`: Handles async balance deductions, credits, and double-entry ledger entries in an isolated transaction.
- `OutboxController`: Endpoint `/outbox` to monitor real-time queue metrics.
- `SimulationController`: Endpoint `/simulation/consumer-crash` to demonstrate Phase 2 failure modes.

---

## 2. Core Concepts Used

1. **The Dual-Write Problem**:
   - A service cannot write to a database and publish to a message broker in a single atomic operation without slow, fragile two-phase commit (2PC) protocols.
   - If the DB commit succeeds but Kafka crashes, the event is lost.
   - If the message is sent to Kafka but the DB commit rolls back, downstream services process a phantom transaction.
2. **The Transactional Outbox Pattern**:
   - Solves the dual-write dilemma by storing the message inside an `outbox_events` table within the **same relational database transaction** as the business entity (`Payment`).
   - The message is guaranteed to persist if and only if the payment persists.
3. **Kafka Partition Key Affinity**:
   - The outbox event uses `userId` as the Kafka message key.
   - Kafka hashes the key to assign the partition:
     $$\text{Partition} = \text{murmur2}(\text{userId}) \pmod{\text{NumPartitions}}$$
   - Guarantees all payments for a given user arrive in strict chronological order on the same partition.

---

## 3. Failure Scenarios & Why Move to Phase 3?

### Failure Test 1: Simulating Consumer Crash Before Offset Commit
- When the consumer finishes writing ledger entries to the database, but crashes / throws before calling `ack.acknowledge()`, Kafka assumes message delivery failed.
- Kafka redelivers the message upon restart.
- Without an **Idempotent Consumer Deduplication Table** (`processed_events`), the consumer processes the message a second time, writing duplicate `DEBIT` and `CREDIT` entries.
- **Run the demonstration:**
  ```powershell
  powershell -ExecutionPolicy Bypass -File .\scripts\test-phase2-consumer-crash.ps1
  ```
- **Result:** Ledger count is 4+ entries instead of 2. Customer was double-debited.

### Kafka Down Survival Test: Zero Payment Loss Guarantee
- **Run the test:**
  ```powershell
  powershell -ExecutionPolicy Bypass -File .\scripts\test-phase2-kafka-down.ps1
  ```
- Proves that stopping Kafka during live payment ingestion results in zero lost transactions:
  1. Payments are accepted with `status = PENDING`.
  2. Outbox events accumulate safely with `status = NEW`.
  3. When Kafka restarts, the Outbox Publisher automatically clears the backlog, and the consumer settles all payments to `SUCCESS`.

---

## 4. Interactive Web Dashboard

Open your browser at:
👉 **http://localhost:8080/**

- Real-time Outbox Queue counters (`NEW`, `PUBLISHED`, `FAILED`).
- Ingestion latency metrics (sub-20ms).
- Live failure test triggers and visual redelivery duplicate demonstration.
- Instant double-entry ledger audit trail.
