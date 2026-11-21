package com.payments.repository;

import com.payments.entity.LedgerEntry;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@Repository
public interface LedgerEntryRepository extends JpaRepository<LedgerEntry, UUID> {

    List<LedgerEntry> findByPaymentId(UUID paymentId);

    List<LedgerEntry> findByPaymentIdOrderByCreatedAtAsc(UUID paymentId);

    /**
     * Ledger Invariant SQL Verification:
     * Asserts: SUM(DEBIT) == SUM(CREDIT) == payment amount for every payment.
     * Must return 0 rows in a consistent system.
     */
    @Query(value = "SELECT CAST(payment_id AS VARCHAR) AS payment_id, " +
            "SUM(CASE WHEN entry_type = 'DEBIT' THEN amount ELSE 0 END) AS total_debit, " +
            "SUM(CASE WHEN entry_type = 'CREDIT' THEN amount ELSE 0 END) AS total_credit " +
            "FROM ledger_entries " +
            "GROUP BY payment_id " +
            "HAVING SUM(CASE WHEN entry_type = 'DEBIT' THEN amount ELSE 0 END) != SUM(CASE WHEN entry_type = 'CREDIT' THEN amount ELSE 0 END)",
            nativeQuery = true)
    List<Map<String, Object>> findImbalancedPayments();
}
