package com.payments.entity;

import jakarta.persistence.*;
import org.springframework.data.domain.Persistable;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "ledger_entries")
public class LedgerEntry implements Persistable<UUID> {

    @Id
    @Column(name = "id", nullable = false, updatable = false)
    private UUID id;

    @Column(name = "payment_id", nullable = false)
    private UUID paymentId;

    @Enumerated(EnumType.STRING)
    @Column(name = "entry_type", nullable = false, length = 20)
    private LedgerEntryType entryType;

    @Column(name = "amount", nullable = false, precision = 19, scale = 4)
    private BigDecimal amount;

    @Column(name = "account_id", nullable = false)
    private UUID accountId;

    @Column(name = "counter_account_id", nullable = false)
    private UUID counterAccountId;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Transient
    private boolean isNewRecord = true;

    public LedgerEntry() {
    }

    public LedgerEntry(UUID id, UUID paymentId, LedgerEntryType entryType, BigDecimal amount, UUID accountId, UUID counterAccountId) {
        this.id = id != null ? id : UUID.randomUUID();
        this.paymentId = paymentId;
        this.entryType = entryType;
        this.amount = amount.setScale(4, RoundingMode.HALF_UP);
        this.accountId = accountId;
        this.counterAccountId = counterAccountId;
        this.createdAt = Instant.now();
        this.isNewRecord = true;
    }

    @Override
    public boolean isNew() {
        return isNewRecord;
    }

    @PostPersist
    @PostLoad
    void markNotNew() {
        this.isNewRecord = false;
    }

    @PrePersist
    protected void onCreate() {
        if (id == null) {
            id = UUID.randomUUID();
        }
        if (createdAt == null) {
            createdAt = Instant.now();
        }
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
        this.amount = amount.setScale(4, RoundingMode.HALF_UP);
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
}
