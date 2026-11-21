package com.payments;

import com.payments.entity.Account;
import com.payments.entity.LedgerEntry;
import com.payments.entity.LedgerEntryType;
import com.payments.exception.LedgerInvariantViolationException;
import com.payments.repository.LedgerEntryRepository;
import com.payments.service.LedgerService;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;

@SpringBootTest
@ActiveProfiles("test")
public class LedgerInvariantTest {

    @Autowired
    private LedgerService ledgerService;

    @Autowired
    private LedgerEntryRepository ledgerEntryRepository;

    @Test
    @DisplayName("Ledger Invariant Verification: SUM(DEBIT) == SUM(CREDIT) == payment amount")
    void testBalancedLedgerInvariant() {
        UUID paymentId = UUID.randomUUID();
        UUID userAccId = UUID.randomUUID();
        UUID merchantAccId = UUID.randomUUID();
        BigDecimal amount = new BigDecimal("75.5000");

        List<LedgerEntry> entries = List.of(
                new LedgerEntry(UUID.randomUUID(), paymentId, LedgerEntryType.DEBIT, amount, userAccId, merchantAccId),
                new LedgerEntry(UUID.randomUUID(), paymentId, LedgerEntryType.CREDIT, amount, merchantAccId, userAccId)
        );

        // Must succeed without throwing
        assertDoesNotThrow(() -> ledgerService.assertDoubleEntryInvariant(paymentId, entries, amount));
    }

    @Test
    @DisplayName("Ledger Invariant Assertion throws LedgerInvariantViolationException if debits and credits do not balance")
    void testUnbalancedLedgerThrowsException() {
        UUID paymentId = UUID.randomUUID();
        UUID userAccId = UUID.randomUUID();
        UUID merchantAccId = UUID.randomUUID();
        BigDecimal debitAmount = new BigDecimal("75.5000");
        BigDecimal unbalancedCredit = new BigDecimal("70.0000");

        List<LedgerEntry> entries = List.of(
                new LedgerEntry(UUID.randomUUID(), paymentId, LedgerEntryType.DEBIT, debitAmount, userAccId, merchantAccId),
                new LedgerEntry(UUID.randomUUID(), paymentId, LedgerEntryType.CREDIT, unbalancedCredit, merchantAccId, userAccId)
        );

        assertThrows(LedgerInvariantViolationException.class, () ->
                ledgerService.assertDoubleEntryInvariant(paymentId, entries, debitAmount));
    }

    @Test
    @DisplayName("Ledger Invariant SQL Verification Query returns 0 discrepancies across all ledger entries")
    void testLedgerSqlVerificationReturnsZeroRows() {
        List<Map<String, Object>> discrepancies = ledgerEntryRepository.findImbalancedPayments();
        assertTrue(discrepancies.isEmpty(), "Ledger Invariant SQL check must return 0 rows of discrepancies");
    }
}
