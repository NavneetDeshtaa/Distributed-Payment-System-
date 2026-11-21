# =========================================================================
# Phase 2 - Happy Path & Transactional Outbox Test Script (PowerShell)
# =========================================================================

$baseUrl = "http://localhost:8080"
$idempotencyKey = "phase2-happy-" + [System.Guid]::NewGuid().ToString()

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "1. Submitting Payment Request (Decoupled Ingestion)" -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan

$headers = @{
    "Idempotency-Key" = $idempotencyKey
    "Content-Type" = "application/json"
}
$body = @{
    userId = "u1"
    merchantId = "m1"
    amount = 30.0000
    currency = "USD"
} | ConvertTo-Json

$sw = [System.Diagnostics.Stopwatch]::StartNew()
$paymentResponse = Invoke-RestMethod -Uri "$baseUrl/payments" -Method Post -Headers $headers -Body $body
$sw.Stop()

Write-Host "Ingestion Latency: $($sw.ElapsedMilliseconds)ms (Instant Response!)" -ForegroundColor Green
Write-Host "Initial Payment Status: $($paymentResponse.status)" -ForegroundColor Yellow
Write-Host "Payment ID: $($paymentResponse.id)"

Write-Host "`n==========================================================" -ForegroundColor Cyan
Write-Host "2. Verifying Outbox Event Queue" -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan

$outbox = Invoke-RestMethod -Uri "$baseUrl/outbox" -Method Get
Write-Host "NEW Events in Outbox: $($outbox.newCount)"
Write-Host "PUBLISHED Events in Outbox: $($outbox.publishedCount)"

Write-Host "`nWaiting 2 seconds for Outbox Publisher (@Scheduled) and Kafka Consumer..." -ForegroundColor Yellow
Start-Sleep -Seconds 2

Write-Host "`n==========================================================" -ForegroundColor Cyan
Write-Host "3. Checking Final Payment & Ledger State After Kafka Processing" -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan

$finalPayment = Invoke-RestMethod -Uri "$baseUrl/payments/$($paymentResponse.id)" -Method Get
Write-Host "Final Payment Status: $($finalPayment.status)" -ForegroundColor Green

$entries = Invoke-RestMethod -Uri "$baseUrl/ledger/payments/$($paymentResponse.id)" -Method Get
Write-Host "Ledger Entries Count: $($entries.Count) (Expected: 2)" -ForegroundColor Green
$entries | Format-Table id, entryType, amount, accountId, counterAccountId

$verification = Invoke-RestMethod -Uri "$baseUrl/ledger/verify" -Method Get
Write-Host "Double-Entry Invariant Balanced: $($verification.balanced)" -ForegroundColor Green
