package com.payments.service;

import com.payments.dto.LedgerEntryResponse;
import com.payments.dto.LedgerVerificationResult;
import com.payments.entity.Account;
import com.payments.entity.LedgerEntry;
import com.payments.entity.LedgerEntryType;
import com.payments.entity.Payment;
import com.payments.exception.LedgerInvariantViolationException;
import com.payments.repository.LedgerEntryRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
public class LedgerService {

    private static final Logger log = LoggerFactory.getLogger(LedgerService.class);

    private final LedgerEntryRepository ledgerEntryRepository;

    public LedgerService(LedgerEntryRepository ledgerEntryRepository) {
        this.ledgerEntryRepository = ledgerEntryRepository;
    }

    /**
     * Double-entry accounting engine.
     * Generates 1 DEBIT and 1 CREDIT entry, asserts the invariant:
     * SUM(DEBIT) == SUM(CREDIT) == payment amount
     * and persists the entries.
     */
    @Transactional(propagation = Propagation.MANDATORY)
    public List<LedgerEntry> recordEntries(Payment payment, Account payerAccount, Account merchantAccount) {
        BigDecimal amount = payment.getAmount().setScale(4, RoundingMode.HALF_UP);

        // 1 DEBIT entry on payer account
        LedgerEntry debitEntry = new LedgerEntry(
                UUID.randomUUID(),
                payment.getId(),
                LedgerEntryType.DEBIT,
                amount,
                payerAccount.getId(),
                merchantAccount.getId()
        );

        // 1 CREDIT entry on merchant account
        LedgerEntry creditEntry = new LedgerEntry(
                UUID.randomUUID(),
                payment.getId(),
                LedgerEntryType.CREDIT,
                amount,
                merchantAccount.getId(),
                payerAccount.getId()
        );

        List<LedgerEntry> entries = List.of(debitEntry, creditEntry);

        // Assert Double-Entry Invariant: SUM(DEBIT) == SUM(CREDIT) == amount
        assertDoubleEntryInvariant(payment.getId(), entries, amount);

        List<LedgerEntry> saved = ledgerEntryRepository.saveAll(entries);
        log.info("Recorded {} balanced ledger entries for paymentId={}, amount={}",
                saved.size(), payment.getId(), amount);
        return saved;
    }

    /**
     * Mathematical invariant enforcement:
     * Financial Double-Entry Bookkeeping: Money is never created or destroyed; it only moves between accounts.
     * Asserts that SUM(DEBIT) == SUM(CREDIT) == expectedAmount.
     */
    public void assertDoubleEntryInvariant(UUID paymentId, List<LedgerEntry> entries, BigDecimal expectedAmount) {
        BigDecimal totalDebit = BigDecimal.ZERO.setScale(4, RoundingMode.HALF_UP);
        BigDecimal totalCredit = BigDecimal.ZERO.setScale(4, RoundingMode.HALF_UP);

        for (LedgerEntry entry : entries) {
            if (entry.getAmount() == null || entry.getAmount().compareTo(BigDecimal.ZERO) <= 0) {
                throw new LedgerInvariantViolationException(paymentId, totalDebit, totalCredit, expectedAmount);
            }
            if (entry.getEntryType() == LedgerEntryType.DEBIT) {
                totalDebit = totalDebit.add(entry.getAmount());
            } else if (entry.getEntryType() == LedgerEntryType.CREDIT) {
                totalCredit = totalCredit.add(entry.getAmount());
            }
        }

        if (totalDebit.compareTo(totalCredit) != 0 || totalDebit.compareTo(expectedAmount) != 0) {
            log.error("LEDGER INVARIANT VIOLATION: paymentId={}, totalDebit={}, totalCredit={}, expectedAmount={}",
                    paymentId, totalDebit, totalCredit, expectedAmount);
            throw new LedgerInvariantViolationException(paymentId, totalDebit, totalCredit, expectedAmount);
        }
    }

    @Transactional(readOnly = true)
    public List<LedgerEntryResponse> getEntriesForPayment(UUID paymentId) {
        return ledgerEntryRepository.findByPaymentIdOrderByCreatedAtAsc(paymentId).stream()
                .map(e -> new LedgerEntryResponse(
                        e.getId(),
                        e.getPaymentId(),
                        e.getEntryType(),
                        e.getAmount(),
                        e.getAccountId(),
                        e.getCounterAccountId(),
                        e.getCreatedAt()
                ))
                .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public LedgerVerificationResult verifyAllLedgerInvariants() {
        List<Map<String, Object>> discrepancies = ledgerEntryRepository.findImbalancedPayments();
        boolean balanced = discrepancies.isEmpty();
        String message = balanced
                ? "Ledger invariant verified successfully: SUM(DEBIT) == SUM(CREDIT) for all payments (0 discrepancies found)."
                : "LEDGER INTEGRITY BREACH: Discrepancies detected across " + discrepancies.size() + " payments!";
        return new LedgerVerificationResult(balanced, discrepancies.size(), discrepancies, message);
    }
}
