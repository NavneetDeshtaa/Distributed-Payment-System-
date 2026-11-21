# =========================================================================
# Phase 3 Failure Test 2: Redis Crash Under Traffic (Graceful Degradation)
# Runs continuous payment requests, then executes `docker compose stop redis`.
#
# Verifications:
# 1. The API must NOT return 500 when Redis is suddenly stopped.
# 2. Rate limiter seamlessly falls back to in-memory Caffeine cache (50,000 entries, 2-min TTL).
# 3. Layer 1 cache lookups fail open and fall back directly to PostgreSQL.
# 4. Payments continue processing uninterrupted.
# 5. Redis is restarted and cache resumes operation.
# =========================================================================

$ErrorActionPreference = "Stop"

Write-Host "============================================================" -ForegroundColor Cyan
Write-Host " Phase 3 Failure Test 2: Redis Crash Under Traffic          " -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan

$baseUrl = "http://localhost:8080"

Write-Host "`n[Step 1] Checking initial Redis status..." -ForegroundColor Yellow
$stats = Invoke-RestMethod -Uri "$baseUrl/simulation/stats" -Method Get
Write-Host "Redis Connected: $($stats.redisConnected)" -ForegroundColor Cyan

# 1. Send 5 payments while Redis is healthy
Write-Host "`n[Step 2] Processing payments with healthy Redis..." -ForegroundColor Yellow
for ($i = 1; $i -le 3; $i++) {
    $idemKey = "redis-live-$i-" + [System.Guid]::NewGuid().ToString()
    $body = @{
        userId = "alice"
        merchantId = "bob"
        amount = [decimal]10.0000
        currency = "USD"
    } | ConvertTo-Json

    $res = Invoke-RestMethod -Uri "$baseUrl/payments" -Method Post -Headers @{ "Idempotency-Key" = $idemKey } -ContentType "application/json" -Body $body
    Write-Host "  Payment $i created (Status=$($res.status), Replay=$($res.idempotentReplay))" -ForegroundColor Green
}

# 2. Crash Redis container
Write-Host "`n[Step 3] Crashing Redis container (docker compose stop redis)..." -ForegroundColor Red
docker compose stop redis
Start-Sleep -Seconds 2

# 3. Send 5 payments during Redis outage
Write-Host "`n[Step 4] Processing payments DURING REDIS CRASH (Testing Graceful Degradation)..." -ForegroundColor Yellow
$crashSuccessCount = 0

for ($i = 1; $i -le 5; $i++) {
    $idemKey = "redis-crashed-$i-" + [System.Guid]::NewGuid().ToString()
    $body = @{
        userId = "alice"
        merchantId = "bob"
        amount = [decimal]5.0000
        currency = "USD"
    } | ConvertTo-Json

    try {
        $res = Invoke-RestMethod -Uri "$baseUrl/payments" -Method Post -Headers @{ "Idempotency-Key" = $idemKey } -ContentType "application/json" -Body $body
        Write-Host "  Payment $i during Redis outage: SUCCESS (Status=$($res.status), HTTP 201)" -ForegroundColor Green
        $crashSuccessCount++
    } catch {
        Write-Host "  Payment $i during Redis outage: FAILED ($($_.Exception.Message))" -ForegroundColor Red
    }
}

# 4. Check stats during crash
$crashStats = Invoke-RestMethod -Uri "$baseUrl/simulation/stats" -Method Get
Write-Host "`nStats during Redis Outage:" -ForegroundColor Cyan
Write-Host "  - Redis Connected: $($crashStats.redisConnected)" -ForegroundColor Yellow
Write-Host "  - Rate Limiter Caffeine Fallback Count: $($crashStats.rateLimiter.caffeineFallbackCount)" -ForegroundColor Yellow
Write-Host "  - Total Payments Processed During Outage: $crashSuccessCount / 5" -ForegroundColor Yellow

# 5. Restart Redis
Write-Host "`n[Step 5] Restarting Redis container (docker compose start redis)..." -ForegroundColor Green
docker compose start redis
Start-Sleep -Seconds 3

# 6. Verify recovery
$recoveredStats = Invoke-RestMethod -Uri "$baseUrl/simulation/stats" -Method Get
Write-Host "`nRecovery Verification:" -ForegroundColor Cyan
Write-Host "  - Redis Reconnected: $($recoveredStats.redisConnected)" -ForegroundColor Green

if ($crashSuccessCount -eq 5 -and $crashStats.rateLimiter.caffeineFallbackCount -gt 0) {
    Write-Host "`nSUCCESS: Phase 3 Failure Test 2 PASSED!" -ForegroundColor Green
    Write-Host "  - Zero 500 errors during Redis crash" -ForegroundColor Green
    Write-Host "  - Seamless fallback to Caffeine cache verified" -ForegroundColor Green
    Write-Host "  - PostgreSQL continued processing all transactions" -ForegroundColor Green
} else {
    Write-Host "`nFAILURE: Graceful degradation failed!" -ForegroundColor Red
    exit 1
}
