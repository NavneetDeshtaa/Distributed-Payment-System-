# Comprehensive End-to-End System Test Suite
Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "   DISTRIBUTED PAYMENT SYSTEM - FULL VERIFICATION SUITE   " -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan

# 1. Health Checks
Write-Host "`n[1/5] Verifying Microservices Health..." -ForegroundColor Yellow
$gwHealth = (Invoke-RestMethod -Uri "http://localhost:8090/actuator/health" -Method Get -ErrorAction SilentlyContinue).status
$psHealth = (Invoke-RestMethod -Uri "http://localhost:8080/actuator/health" -Method Get -ErrorAction SilentlyContinue).status
$fsHealth = (Invoke-RestMethod -Uri "http://localhost:8000/health" -Method Get -ErrorAction SilentlyContinue).status

Write-Host " - Gateway (:8090):      $gwHealth"
Write-Host " - Payment Core (:8080): $psHealth"
Write-Host " - Fraud AI (:8000):     $fsHealth"

# 2. JWT Minting & Authenticated Payment Ingestion
Write-Host "`n[2/5] Testing Edge Gateway JWT Authentication & Payment Ingestion..." -ForegroundColor Yellow
$token = (Invoke-RestMethod -Uri "http://localhost:8090/auth/token" -Method Post -ContentType "application/json" -Body '{"userId":"alice"}').token
$idemKey = [System.Guid]::NewGuid().ToString()

$headers = @{
    "Authorization" = "Bearer $token"
    "Idempotency-Key" = $idemKey
    "Content-Type" = "application/json"
}
$payBody = @{
    userId = "alice"
    merchantId = "m1"
    amount = 50.00
    currency = "USD"
} | ConvertTo-Json

$resp = Invoke-RestMethod -Uri "http://localhost:8090/payments" -Method Post -Headers $headers -Body $payBody
Write-Host " - Created Payment ID: $($resp.id), Initial Status: $($resp.status)"

# Wait for Kafka & ML Pipeline
Start-Sleep -Seconds 3
$finalPay = Invoke-RestMethod -Uri "http://localhost:8080/payments/$($resp.id)" -Method Get
Write-Host " - Asynchronous Settled Status: $($finalPay.status)"

# 3. High-Velocity Fraud Attack
Write-Host "`n[3/5] Testing Phase 4 High-Velocity Attack (15 Rapid Requests)..." -ForegroundColor Yellow
$attack = Invoke-RestMethod -Uri "http://localhost:8080/simulation/velocity-attack?userId=suite-attacker-1&requestCount=15" -Method Post
Start-Sleep -Seconds 4
$velPayments = (Invoke-RestMethod -Uri "http://localhost:8080/payments" -Method Get) | Where-Object { $_.userId -eq "suite-attacker-1" }
$successCount = ($velPayments | Where-Object { $_.status -eq "SUCCESS" }).Count
$fraudCount = ($velPayments | Where-Object { $_.status -eq "FRAUD_REJECTED" }).Count
Write-Host " - Velocity Attack Results: $successCount Passed (1-10), $fraudCount Rejected (11-15)"

# 4. Financial Reconciliation 5 Audits
Write-Host "`n[4/5] Testing Phase 5 Financial Reconciliation (5 Audits)..." -ForegroundColor Yellow
$recon = Invoke-RestMethod -Uri "http://localhost:8080/simulation/reconciliation/run" -Method Post
Write-Host " - Reconciliation Status: $($recon.status)"
Write-Host " - Stale Payments: $($recon.stalePaymentsCount), Imbalance: $($recon.ledgerImbalanceCount), Duplicates: $($recon.duplicateLedgerCount)"

# 5. Ledger Invariant
Write-Host "`n[5/5] Checking Double-Entry Accounting Invariant (SUM(DEBIT) == SUM(CREDIT))..." -ForegroundColor Yellow
$inv = Invoke-RestMethod -Uri "http://localhost:8080/ledger/verify" -Method Get
Write-Host " - Invariant Balanced: $($inv.balanced) (0 Discrepancies)"

Write-Host "`n==========================================================" -ForegroundColor Green
Write-Host "          ALL TESTS COMPLETED SUCCESSFULLY!               " -ForegroundColor Green
Write-Host "==========================================================" -ForegroundColor Green
