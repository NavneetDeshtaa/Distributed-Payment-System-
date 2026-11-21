package com.payments.exception;

import java.math.BigDecimal;
import java.util.UUID;

public class LedgerInvariantViolationException extends RuntimeException {
    public LedgerInvariantViolationException(UUID paymentId, BigDecimal totalDebit, BigDecimal totalCredit, BigDecimal expectedAmount) {
        super(String.format("Ledger invariant violation for payment %s: SUM(DEBIT)=%s, SUM(CREDIT)=%s, expected=%s",
                paymentId, totalDebit, totalCredit, expectedAmount));
    }
}
