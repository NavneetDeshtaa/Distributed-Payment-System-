package com.payments.dto;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import java.math.BigDecimal;

public class CreateAccountRequest {

    @NotBlank(message = "ownerId is required")
    private String ownerId;

    @NotNull(message = "initialBalance is required")
    @DecimalMin(value = "0.0000", message = "initialBalance cannot be negative")
    private BigDecimal initialBalance;

    @NotBlank(message = "currency is required")
    private String currency;

    public CreateAccountRequest() {
    }

    public CreateAccountRequest(String ownerId, BigDecimal initialBalance, String currency) {
        this.ownerId = ownerId;
        this.initialBalance = initialBalance;
        this.currency = currency;
    }

    public String getOwnerId() {
        return ownerId;
    }

    public void setOwnerId(String ownerId) {
        this.ownerId = ownerId;
    }

    public BigDecimal getInitialBalance() {
        return initialBalance;
    }

    public void setInitialBalance(BigDecimal initialBalance) {
        this.initialBalance = initialBalance;
    }

    public String getCurrency() {
        return currency;
    }

    public void setCurrency(String currency) {
        this.currency = currency;
    }
}
