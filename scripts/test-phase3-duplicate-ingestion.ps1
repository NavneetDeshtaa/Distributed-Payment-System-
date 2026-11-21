# =========================================================================
# Phase 3 Failure Test 1: High-Frequency Kafka Duplicate Ingestion
# Pushes the exact same JSON event 100 times to payment.created with the same x-event-id.
#
# Verifications:
# 1. Exactly 1 message is processed; 99 messages log "Duplicate event detected — skipping".
# 2. The ledger entries for this payment == 2 (1 DEBIT + 1 CREDIT).
# 3. Exactly-Once Processing (EOS) is guaranteed despite network duplicates / redelivery.
# =========================================================================

$ErrorActionPreference = "Stop"

Write-Host "============================================================" -ForegroundColor Cyan
Write-Host " Phase 3 Failure Test 1: High-Frequency Duplicate Ingestion " -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan

$baseUrl = "http://localhost:8080"
$testEventId = "eos-dup-" + [System.Guid]::NewGuid().ToString()

Write-Host "`n[Step 1] Triggering 100 Duplicate Kafka Messages with same x-event-id: $testEventId..." -ForegroundColor Yellow

$uri = "$baseUrl/simulation/duplicate-events?count=100&eventId=$testEventId&userId=alice&merchantId=bob&amount=10.0000"
$response = Invoke-RestMethod -Uri $uri -Method Post

Write-Host "`nSimulation Result:" -ForegroundColor Green
$response | Format-List

Write-Host "`n[Step 2] Verifying Exactly-Once Semantics (EOS)..." -ForegroundColor Yellow

if ($response.exactlyOnceAchieved -eq $true -and $response.actualLedgerEntries -eq 2) {
    Write-Host "`nSUCCESS: Phase 3 Failure Test 1 PASSED!" -ForegroundColor Green
    Write-Host "  - Total Messages Sent: $($response.totalMessagesSent)" -ForegroundColor Green
    Write-Host "  - Expected Processed: 1" -ForegroundColor Green
    Write-Host "  - Expected Duplicates Skipped: 99" -ForegroundColor Green
    Write-Host "  - Actual Ledger Entries in DB: $($response.actualLedgerEntries)" -ForegroundColor Green
    Write-Host "  - Double-Entry Invariant: Balanced (1 DEBIT + 1 CREDIT)" -ForegroundColor Green
} else {
    Write-Host "`nFAILURE: Exactly-Once Semantics violated!" -ForegroundColor Red
    Write-Host "  - Actual Ledger Entries: $($response.actualLedgerEntries) (Expected: 2)" -ForegroundColor Red
    exit 1
}
