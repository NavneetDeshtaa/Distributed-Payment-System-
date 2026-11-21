package com.payments.dto;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import java.math.BigDecimal;

public class CreatePaymentRequest {

    @NotBlank(message = "userId is required")
    private String userId;

    @NotBlank(message = "merchantId is required")
    private String merchantId;

    @NotNull(message = "amount is required")
    @DecimalMin(value = "0.0001", message = "amount must be greater than zero")
    private BigDecimal amount;

    @NotBlank(message = "currency is required")
    private String currency;

    public CreatePaymentRequest() {
    }

    public CreatePaymentRequest(String userId, String merchantId, BigDecimal amount, String currency) {
        this.userId = userId;
        this.merchantId = merchantId;
        this.amount = amount;
        this.currency = currency;
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
}
