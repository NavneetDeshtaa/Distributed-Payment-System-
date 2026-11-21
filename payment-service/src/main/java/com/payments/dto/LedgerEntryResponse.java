package com.payments.dto;

import com.payments.entity.LedgerEntryType;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

public class LedgerEntryResponse {

    private UUID id;
    private UUID paymentId;
    private LedgerEntryType entryType;
    private BigDecimal amount;
    private UUID accountId;
    private UUID counterAccountId;
    private Instant createdAt;

    public LedgerEntryResponse() {
    }

    public LedgerEntryResponse(UUID id, UUID paymentId, LedgerEntryType entryType, BigDecimal amount,
                               UUID accountId, UUID counterAccountId, Instant createdAt) {
        this.id = id;
        this.paymentId = paymentId;
        this.entryType = entryType;
        this.amount = amount;
        this.accountId = accountId;
        this.counterAccountId = counterAccountId;
        this.createdAt = createdAt;
    }

    public UUID getId() {
        return id;
    }

    public void setId(UUID id) {
        this.id = id;
    }

    public UUID getPaymentId() {
        return paymentId;
    }

    public void setPaymentId(UUID paymentId) {
        this.paymentId = paymentId;
    }

    public LedgerEntryType getEntryType() {
        return entryType;
    }

    public void setEntryType(LedgerEntryType entryType) {
        this.entryType = entryType;
    }

    public BigDecimal getAmount() {
        return amount;
    }

    public void setAmount(BigDecimal amount) {
        this.amount = amount;
    }

    public UUID getAccountId() {
        return accountId;
    }

    public void setAccountId(UUID accountId) {
        this.accountId = accountId;
    }

    public UUID getCounterAccountId() {
        return counterAccountId;
    }

    public void setCounterAccountId(UUID counterAccountId) {
        this.counterAccountId = counterAccountId;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(Instant createdAt) {
        this.createdAt = createdAt;
    }
}
