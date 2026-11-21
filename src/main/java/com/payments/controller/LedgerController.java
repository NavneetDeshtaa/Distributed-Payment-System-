package com.payments.controller;

import com.payments.dto.LedgerEntryResponse;
import com.payments.dto.LedgerVerificationResult;
import com.payments.service.LedgerService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/ledger")
public class LedgerController {

    private final LedgerService ledgerService;

    public LedgerController(LedgerService ledgerService) {
        this.ledgerService = ledgerService;
    }

    /**
     * Ledger Invariant SQL Verification API endpoint:
     * Verifies that for every payment: SUM(DEBIT) == SUM(CREDIT) == payment amount.
     * Returns 200 OK with balanced status.
     */
    @GetMapping("/verify")
    public ResponseEntity<LedgerVerificationResult> verifyLedger() {
        return ResponseEntity.ok(ledgerService.verifyAllLedgerInvariants());
    }

    @GetMapping("/payments/{paymentId}")
    public ResponseEntity<List<LedgerEntryResponse>> getEntriesForPayment(@PathVariable UUID paymentId) {
        return ResponseEntity.ok(ledgerService.getEntriesForPayment(paymentId));
    }
}
