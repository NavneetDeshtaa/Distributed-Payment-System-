package com.payments.dto;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

public class PaymentCreatedEvent {

    private String eventId;
    private UUID paymentId;
    private String userId;
    private String merchantId;
    private BigDecimal amount;
    private String currency;
    private String idempotencyKey;
    private String traceId;
    private Instant createdAt;

    public PaymentCreatedEvent() {
    }

    public PaymentCreatedEvent(UUID paymentId, String userId, String merchantId, BigDecimal amount,
                               String currency, String idempotencyKey, String traceId, Instant createdAt) {
        this(null, paymentId, userId, merchantId, amount, currency, idempotencyKey, traceId, createdAt);
    }

    public PaymentCreatedEvent(String eventId, UUID paymentId, String userId, String merchantId, BigDecimal amount,
                               String currency, String idempotencyKey, String traceId, Instant createdAt) {
        this.eventId = eventId;
        this.paymentId = paymentId;
        this.userId = userId;
        this.merchantId = merchantId;
        this.amount = amount;
        this.currency = currency;
        this.idempotencyKey = idempotencyKey;
        this.traceId = traceId;
        this.createdAt = createdAt;
    }

    public String getEventId() {
        return eventId;
    }

    public void setEventId(String eventId) {
        this.eventId = eventId;
    }

    public UUID getPaymentId() {
        return paymentId;
    }

    public void setPaymentId(UUID paymentId) {
        this.paymentId = paymentId;
    }

    public String getUserId() {
        return userId;
    }

    public void setUserId(String userId) {
        this.userId = userId;
    }

    public String getMerchantId() {
        return merchantId;
    }

    public void setMerchantId(String merchantId) {
        this.merchantId = merchantId;
    }

    public BigDecimal getAmount() {
        return amount;
    }

    public void setAmount(BigDecimal amount) {
        this.amount = amount;
    }

    public String getCurrency() {
        return currency;
    }

    public void setCurrency(String currency) {
        this.currency = currency;
    }

    public String getIdempotencyKey() {
        return idempotencyKey;
    }

    public void setIdempotencyKey(String idempotencyKey) {
        this.idempotencyKey = idempotencyKey;
    }

    public String getTraceId() {
        return traceId;
    }

    public void setTraceId(String traceId) {
        this.traceId = traceId;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(Instant createdAt) {
        this.createdAt = createdAt;
    }
}
