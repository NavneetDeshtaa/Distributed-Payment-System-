# =========================================================================
# Phase 2 Failure Test 1: Simulating Consumer Crash Before Offset Commit
# =========================================================================

$baseUrl = "http://localhost:8080"
$crashKey = "crash-test-" + [System.Guid]::NewGuid().ToString()

Write-Host "==========================================================" -ForegroundColor Yellow
Write-Host "1. Enabling Consumer Crash Simulation" -ForegroundColor Yellow
Write-Host "==========================================================" -ForegroundColor Yellow

Invoke-RestMethod -Uri "$baseUrl/simulation/consumer-crash?enabled=true" -Method Post | Out-Null
Write-Host "Consumer Crash Simulation: ENABLED" -ForegroundColor Red
Write-Host "Consumer will commit ledger entries in DB, but CRASH before acknowledging Kafka offset."

Write-Host "`n==========================================================" -ForegroundColor Yellow
Write-Host "2. Submitting Payment Request" -ForegroundColor Yellow
Write-Host "==========================================================" -ForegroundColor Yellow

$headers = @{
    "Idempotency-Key" = $crashKey
    "Content-Type" = "application/json"
}
$body = @{
    userId = "u1"
    merchantId = "m1"
    amount = 20.0000
    currency = "USD"
} | ConvertTo-Json

$payment = Invoke-RestMethod -Uri "$baseUrl/payments" -Method Post -Headers $headers -Body $body
Write-Host "Payment Ingested: ID=$($payment.id), Status=$($payment.status)"

Write-Host "`nWaiting 4 seconds for Kafka redelivery attempts..." -ForegroundColor Yellow
Start-Sleep -Seconds 4

Write-Host "`n==========================================================" -ForegroundColor Yellow
Write-Host "3. Inspecting PostgreSQL Ledger Entries for Payment $($payment.id)" -ForegroundColor Yellow
Write-Host "==========================================================" -ForegroundColor Yellow

$entries = Invoke-RestMethod -Uri "$baseUrl/ledger/payments/$($payment.id)" -Method Get
Write-Host "Total Ledger Entries Recorded: $($entries.Count)" -ForegroundColor Red

if ($entries.Count -gt 2) {
    Write-Host "`n[DEMONSTRATION SUCCESSFUL] Redelivery duplicate detected!" -ForegroundColor Red
    Write-Host "Count is $($entries.Count) entries instead of 2! The customer was double-debited." -ForegroundColor Red
    Write-Host "Why Move to Phase 3: Kafka at-least-once delivery requires Idempotent Consumers with dedup table." -ForegroundColor Yellow
} else {
    Write-Host "Ledger entries count: $($entries.Count)"
}

# Reset simulation
Invoke-RestMethod -Uri "$baseUrl/simulation/consumer-crash?enabled=false" -Method Post | Out-Null
Write-Host "`nConsumer Crash Simulation reset to DISABLED." -ForegroundColor Green
