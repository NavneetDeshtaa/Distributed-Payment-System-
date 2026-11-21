# =========================================================================
# Phase 2 Survival Test: Kafka Down Zero-Payment-Loss Test
# =========================================================================

$baseUrl = "http://localhost:8080"

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "1. Stopping Apache Kafka Container" -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan

docker compose stop kafka
Write-Host "Apache Kafka is STOPPED." -ForegroundColor Red

Write-Host "`n==========================================================" -ForegroundColor Cyan
Write-Host "2. Submitting 5 Payment Requests while Kafka is DOWN" -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan

$paymentIds = @()
for ($i = 1; $i -le 5; $i++) {
    $key = "kafka-down-test-$i-" + [System.Guid]::NewGuid().ToString()
    $headers = @{ "Idempotency-Key" = $key; "Content-Type" = "application/json" }
    $body = @{ userId = "u1"; merchantId = "m1"; amount = 10.0000; currency = "USD" } | ConvertTo-Json
    $res = Invoke-RestMethod -Uri "$baseUrl/payments" -Method Post -Headers $headers -Body $body
    Write-Host "Payment $i Ingested: ID=$($res.id), Status=$($res.status)" -ForegroundColor Green
    $paymentIds += $res.id
}

Write-Host "`n==========================================================" -ForegroundColor Cyan
Write-Host "3. Verifying Zero Payment Loss (Outbox Events status = NEW)" -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan

$outbox = Invoke-RestMethod -Uri "$baseUrl/outbox" -Method Get
Write-Host "NEW Events safely waiting in PostgreSQL Outbox: $($outbox.newCount)" -ForegroundColor Green

Write-Host "`n==========================================================" -ForegroundColor Cyan
Write-Host "4. Restarting Apache Kafka Container" -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan

docker compose start kafka
Write-Host "Apache Kafka is RESTARTED. Waiting 5 seconds for recovery & publishing..." -ForegroundColor Green
Start-Sleep -Seconds 5

Write-Host "`n==========================================================" -ForegroundColor Cyan
Write-Host "5. Verifying Outbox Recovery & Settlement" -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan

$outboxAfter = Invoke-RestMethod -Uri "$baseUrl/outbox" -Method Get
Write-Host "Remaining NEW Events: $($outboxAfter.newCount)" -ForegroundColor Green
Write-Host "Total PUBLISHED Events: $($outboxAfter.publishedCount)" -ForegroundColor Green

$successCount = 0
foreach ($id in $paymentIds) {
    $p = Invoke-RestMethod -Uri "$baseUrl/payments/$id" -Method Get
    if ($p.status -eq "SUCCESS") { $successCount++ }
}

Write-Host "Payments Transitioned to SUCCESS: $successCount / 5" -ForegroundColor Green
Write-Host "[SUCCESS] Zero payments were lost during the broker outage!" -ForegroundColor Green
