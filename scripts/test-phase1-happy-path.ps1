# =========================================================================
# Phase 1 - Happy Path & Ledger Invariant Test Script (PowerShell)
# =========================================================================

$baseUrl = "http://localhost:8080"
$idempotencyKey = "happy-path-" + [System.Guid]::NewGuid().ToString()

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "1. Checking Initial Account Balances" -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan

$payerBefore = Invoke-RestMethod -Uri "$baseUrl/accounts/u1" -Method Get
$merchantBefore = Invoke-RestMethod -Uri "$baseUrl/accounts/m1" -Method Get
Write-Host "Payer (u1) Balance: $($payerBefore.balance) $($payerBefore.currency) (Version: $($payerBefore.version))"
Write-Host "Merchant (m1) Balance: $($merchantBefore.balance) $($merchantBefore.currency) (Version: $($merchantBefore.version))"

Write-Host "`n==========================================================" -ForegroundColor Cyan
Write-Host "2. Submitting Payment Request (Amount: 50.0000 USD)" -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan

$headers = @{
    "Idempotency-Key" = $idempotencyKey
    "Content-Type" = "application/json"
}
$body = @{
    userId = "u1"
    merchantId = "m1"
    amount = 50.0000
    currency = "USD"
} | ConvertTo-Json

$paymentResponse = Invoke-RestMethod -Uri "$baseUrl/payments" -Method Post -Headers $headers -Body $body
Write-Host "Payment Status: $($paymentResponse.status)" -ForegroundColor Green
Write-Host "Payment ID: $($paymentResponse.id)" -ForegroundColor Green
Write-Host "Idempotent Replay: $($paymentResponse.idempotentReplay)"

Write-Host "`n==========================================================" -ForegroundColor Cyan
Write-Host "3. Checking Updated Balances & Invariant" -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan

$payerAfter = Invoke-RestMethod -Uri "$baseUrl/accounts/u1" -Method Get
$merchantAfter = Invoke-RestMethod -Uri "$baseUrl/accounts/m1" -Method Get
Write-Host "Payer (u1) Balance: $($payerAfter.balance) (Debited by 50.0000, Version: $($payerAfter.version))"
Write-Host "Merchant (m1) Balance: $($merchantAfter.balance) (Credited by 50.0000, Version: $($merchantAfter.version))"

Write-Host "`n==========================================================" -ForegroundColor Cyan
Write-Host "4. Querying Ledger Entries for Payment $($paymentResponse.id)" -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan

$entries = Invoke-RestMethod -Uri "$baseUrl/ledger/payments/$($paymentResponse.id)" -Method Get
$entries | Format-Table id, entryType, amount, accountId, counterAccountId, createdAt

Write-Host "`n==========================================================" -ForegroundColor Cyan
Write-Host "5. Running Automated SQL Ledger Invariant Verification" -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan

$verification = Invoke-RestMethod -Uri "$baseUrl/ledger/verify" -Method Get
Write-Host "Ledger Balanced: $($verification.balanced)" -ForegroundColor Green
Write-Host "Imbalanced Count: $($verification.imbalancedPaymentsCount)" -ForegroundColor Green
Write-Host "Status Message: $($verification.message)"
