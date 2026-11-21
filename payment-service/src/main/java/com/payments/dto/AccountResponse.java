package com.payments.dto;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

public class AccountResponse {

    private UUID id;
    private String ownerId;
    private BigDecimal balance;
    private String currency;
    private Long version;
    private Instant createdAt;
    private Instant updatedAt;

    public AccountResponse() {
    }

    public AccountResponse(UUID id, String ownerId, BigDecimal balance, String currency, Long version, Instant createdAt, Instant updatedAt) {
        this.id = id;
        this.ownerId = ownerId;
        this.balance = balance;
        this.currency = currency;
        this.version = version;
        this.createdAt = createdAt;
        this.updatedAt = updatedAt;
    }

    public UUID getId() {
        return id;
    }

    public void setId(UUID id) {
        this.id = id;
    }

    public String getOwnerId() {
        return ownerId;
    }

    public void setOwnerId(String ownerId) {
        this.ownerId = ownerId;
    }

    public BigDecimal getBalance() {
        return balance;
    }

    public void setBalance(BigDecimal balance) {
        this.balance = balance;
    }

    public String getCurrency() {
        return currency;
    }

    public void setCurrency(String currency) {
        this.currency = currency;
    }

    public Long getVersion() {
        return version;
    }

    public void setVersion(Long version) {
        this.version = version;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(Instant createdAt) {
        this.createdAt = createdAt;
    }

    public Instant getUpdatedAt() {
        return updatedAt;
    }

    public void setUpdatedAt(Instant updatedAt) {
        this.updatedAt = updatedAt;
    }
}
