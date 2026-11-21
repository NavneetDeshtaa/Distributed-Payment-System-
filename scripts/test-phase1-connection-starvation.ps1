# =========================================================================
# Failure Test 2: Connection Pool Starvation (Simulating Slow External Call)
# Simulates a slow external fraud API call (Thread.sleep 2000ms inside the transaction)
# under concurrent load (20 concurrent users).
#
# Expected Behavior:
# - HikariCP database connection pool (size 10) saturates.
# - Requests block waiting for a database connection.
# - Subsequent requests encounter ConnectionTimeoutException and HTTP 500.
# =========================================================================

$baseUrl = "http://localhost:8080"
$concurrentUsers = 20
Write-Host "Simulating Slow External Call (2000ms delay per request) with $concurrentUsers concurrent requests..." -ForegroundColor Yellow
Write-Host "HikariCP pool maximum size is 10 connections." -ForegroundColor Yellow

$jobs = @()
for ($i = 1; $i -le $concurrentUsers; $i++) {
    $key = "slow-call-key-$i-" + [System.Guid]::NewGuid().ToString()
    $jobs += Start-Job -ScriptBlock {
        param($url, $k)
        $h = @{
            "Idempotency-Key" = $k
            "X-Simulate-Slow-Call" = "true"
            "Content-Type" = "application/json"
        }
        $b = @{
            userId = "u1"
            merchantId = "m1"
            amount = 1.0000
            currency = "USD"
        } | ConvertTo-Json
        $sw = [System.Diagnostics.Stopwatch]::StartNew()
        try {
            $resp = Invoke-WebRequest -Uri "$url/payments" -Method Post -Headers $h -Body $b -TimeoutSec 15 -UseBasicParsing
            $sw.Stop()
            return @{ Success = $true; Status = $resp.StatusCode; TimeMs = $sw.ElapsedMilliseconds }
        } catch {
            $sw.Stop()
            return @{ Success = $false; Error = $_.Exception.Message; TimeMs = $sw.ElapsedMilliseconds }
        }
    } -ArgumentList $baseUrl, $key
}

$results = $jobs | ForEach-Object { Receive-Job -Job $_ -Wait }
$jobs | Remove-Job

$successCount = ($results | Where-Object { $_.Success -eq $true }).Count
$failureCount = ($results | Where-Object { $_.Success -eq $false }).Count

Write-Host "`nTest Execution Complete:" -ForegroundColor Cyan
Write-Host "Successful Requests: $successCount"
Write-Host "Timed out / Starved Requests: $failureCount"
Write-Host "`nThis demonstrates Why to Move to Phase 2: synchronous dual-writes stretch DB transactions and exhaust connection pools." -ForegroundColor Yellow
