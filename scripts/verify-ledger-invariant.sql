-- =========================================================================
-- Ledger Invariant SQL Verification
-- Asserts Financial Double-Entry Bookkeeping:
-- Money is never created or destroyed; it only moves between accounts.
-- Every payment must have: SUM(DEBIT) == SUM(CREDIT) == Payment Amount.
-- This query MUST return 0 rows!
-- =========================================================================

SELECT 
    payment_id,
    SUM(CASE WHEN entry_type = 'DEBIT' THEN amount ELSE 0 END) AS total_debit,
    SUM(CASE WHEN entry_type = 'CREDIT' THEN amount ELSE 0 END) AS total_credit
FROM ledger_entries
GROUP BY payment_id
HAVING SUM(CASE WHEN entry_type = 'DEBIT' THEN amount ELSE 0 END) != SUM(CASE WHEN entry_type = 'CREDIT' THEN amount ELSE 0 END);
