package com.payments.dto;

import java.util.List;
import java.util.Map;

public class LedgerVerificationResult {

    private boolean balanced;
    private int imbalancedPaymentsCount;
    private List<Map<String, Object>> discrepancies;
    private String message;

    public LedgerVerificationResult() {
    }

    public LedgerVerificationResult(boolean balanced, int imbalancedPaymentsCount, List<Map<String, Object>> discrepancies, String message) {
        this.balanced = balanced;
        this.imbalancedPaymentsCount = imbalancedPaymentsCount;
        this.discrepancies = discrepancies;
        this.message = message;
    }

    public boolean isBalanced() {
        return balanced;
    }

    public void setBalanced(boolean balanced) {
        this.balanced = balanced;
    }

    public int getImbalancedPaymentsCount() {
        return imbalancedPaymentsCount;
    }

    public void setImbalancedPaymentsCount(int imbalancedPaymentsCount) {
        this.imbalancedPaymentsCount = imbalancedPaymentsCount;
    }

    public List<Map<String, Object>> getDiscrepancies() {
        return discrepancies;
    }

    public void setDiscrepancies(List<Map<String, Object>> discrepancies) {
        this.discrepancies = discrepancies;
    }

    public String getMessage() {
        return message;
    }

    public void setMessage(String message) {
        this.message = message;
    }
}
