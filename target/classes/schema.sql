-- =========================================================================
-- Phase 1 to Phase 5 Comprehensive Database Schema (PostgreSQL)
-- Sub-cent monetary precision using NUMERIC(19,4) to prevent IEEE 754 float drift
-- =========================================================================

CREATE TABLE IF NOT EXISTS accounts (
    id UUID PRIMARY KEY,
    owner_id VARCHAR(255) NOT NULL UNIQUE,
    balance NUMERIC(19, 4) NOT NULL DEFAULT 0.0000,
    currency VARCHAR(10) NOT NULL,
    version BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_positive_balance CHECK (balance >= 0)
);

CREATE TABLE IF NOT EXISTS payments (
    id UUID PRIMARY KEY,
    user_id VARCHAR(255) NOT NULL,
    merchant_id VARCHAR(255) NOT NULL,
    amount NUMERIC(19, 4) NOT NULL,
    currency VARCHAR(10) NOT NULL,
    status VARCHAR(50) NOT NULL, -- 'PENDING', 'SUCCESS', 'FAILED', 'FRAUD_REJECTED'
    idempotency_key VARCHAR(255) NOT NULL UNIQUE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_positive_amount CHECK (amount > 0)
);

CREATE TABLE IF NOT EXISTS ledger_entries (
    id UUID PRIMARY KEY,
    payment_id UUID NOT NULL REFERENCES payments(id) ON DELETE CASCADE,
    entry_type VARCHAR(20) NOT NULL, -- 'DEBIT' or 'CREDIT'
    amount NUMERIC(19, 4) NOT NULL,
    account_id UUID NOT NULL REFERENCES accounts(id),
    counter_account_id UUID NOT NULL REFERENCES accounts(id),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_ledger_positive_amount CHECK (amount > 0),
    CONSTRAINT chk_entry_type CHECK (entry_type IN ('DEBIT', 'CREDIT'))
);

-- =========================================================================
-- Transactional Outbox Table (Phase 2)
-- =========================================================================
CREATE TABLE IF NOT EXISTS outbox_events (
    id UUID PRIMARY KEY,
    event_type VARCHAR(100) NOT NULL,
    aggregate_id VARCHAR(255) NOT NULL,
    partition_key VARCHAR(255) NOT NULL,
    payload TEXT NOT NULL,
    status VARCHAR(50) NOT NULL, -- 'NEW', 'PUBLISHED', 'FAILED'
    retry_count INT NOT NULL DEFAULT 0,
    trace_id VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- =========================================================================
-- Idempotent Consumer Deduplication Table (Phase 3)
-- =========================================================================
CREATE TABLE IF NOT EXISTS processed_events (
    event_id VARCHAR(512) PRIMARY KEY,
    consumer_group VARCHAR(100) NOT NULL,
    topic VARCHAR(100) NOT NULL,
    processed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- =========================================================================
-- Reliable Webhooks & Merchant Registration (Phase 5)
-- =========================================================================
CREATE TABLE IF NOT EXISTS merchant_webhooks (
    id UUID PRIMARY KEY,
    merchant_id VARCHAR(255) NOT NULL UNIQUE,
    url VARCHAR(512) NOT NULL,
    secret VARCHAR(255) NOT NULL,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS webhook_deliveries (
    id UUID PRIMARY KEY,
    payment_id UUID NOT NULL,
    merchant_id VARCHAR(255) NOT NULL,
    url VARCHAR(512) NOT NULL,
    payload TEXT NOT NULL,
    signature VARCHAR(255) NOT NULL,
    status VARCHAR(50) NOT NULL, -- 'PENDING', 'DELIVERED', 'RETRYING', 'FAILED_DLQ'
    attempt_count INT NOT NULL DEFAULT 1,
    last_response_code INT,
    last_error TEXT,
    next_retry_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- =========================================================================
-- Financial Reconciliation Alerts (Phase 5)
-- =========================================================================
CREATE TABLE IF NOT EXISTS reconciliation_alerts (
    id UUID PRIMARY KEY,
    alert_type VARCHAR(100) NOT NULL, -- 'STALE_PAYMENT', 'GHOST_PAYMENT', 'DUPLICATE_LEDGER', 'LEDGER_IMBALANCE', 'ORPHAN_LEDGER'
    entity_id VARCHAR(255),
    details TEXT NOT NULL,
    severity VARCHAR(20) NOT NULL, -- 'WARN', 'CRITICAL'
    resolved BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_payments_idempotency_key ON payments(idempotency_key);
CREATE INDEX IF NOT EXISTS idx_payments_user_id ON payments(user_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status);
CREATE INDEX IF NOT EXISTS idx_ledger_payment_id ON ledger_entries(payment_id);
CREATE INDEX IF NOT EXISTS idx_ledger_account_id ON ledger_entries(account_id);
CREATE INDEX IF NOT EXISTS idx_outbox_status_created ON outbox_events(status, created_at);
CREATE INDEX IF NOT EXISTS idx_processed_events_processed_at ON processed_events(processed_at);
CREATE INDEX IF NOT EXISTS idx_webhook_status_retry ON webhook_deliveries(status, next_retry_at);
CREATE INDEX IF NOT EXISTS idx_reconciliation_alerts_type ON reconciliation_alerts(alert_type, created_at);
