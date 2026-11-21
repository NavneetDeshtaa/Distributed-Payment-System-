package com.payments.exception;

import java.math.BigDecimal;

public class InsufficientBalanceException extends RuntimeException {
    public InsufficientBalanceException(String ownerId, BigDecimal currentBalance, BigDecimal requiredAmount) {
        super(String.format("Account '%s' has insufficient balance: %s available, %s required",
                ownerId, currentBalance, requiredAmount));
    }
}
