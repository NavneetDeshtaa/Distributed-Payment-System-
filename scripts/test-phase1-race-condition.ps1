# =========================================================================
# Failure Test 1: The Double-Charge Race Condition (PowerShell)
# Simulates two concurrent requests with identical Idempotency-Key
# at the exact same millisecond.
#
# Expected Behavior:
# - One request creates the payment (HTTP 201)
# - The second request returns the existing payment (HTTP 200/409 idempotent replay)
# - Payer account balance is debited EXACTLY ONCE.
# =========================================================================

$baseUrl = "http://localhost:8080"
$sharedIdempotencyKey = "race-test-" + [System.Guid]::NewGuid().ToString()
$payerBefore = Invoke-RestMethod -Uri "$baseUrl/accounts/u1" -Method Get
Write-Host "Payer (u1) Balance Before Race Test: $($payerBefore.balance)" -ForegroundColor Cyan

$headers = @{
    "Idempotency-Key" = $sharedIdempotencyKey
    "Content-Type" = "application/json"
}
$body = @{
    userId = "u1"
    merchantId = "m1"
    amount = 50.0000
    currency = "USD"
} | ConvertTo-Json

Write-Host "`nFiring 2 concurrent HTTP POST requests with Idempotency-Key: $sharedIdempotencyKey" -ForegroundColor Yellow

$job1 = Start-Job -ScriptBlock {
    param($url, $h, $b)
    try {
        $resp = Invoke-WebRequest -Uri "$url/payments" -Method Post -Headers $h -Body $b -UseBasicParsing
        return @{ StatusCode = $resp.StatusCode; Content = $resp.Content }
    } catch {
        return @{ StatusCode = $_.Exception.Response.StatusCode.value__; Error = $_.Exception.Message }
    }
} -ArgumentList $baseUrl, $headers, $body

$job2 = Start-Job -ScriptBlock {
    param($url, $h, $b)
    try {
        $resp = Invoke-WebRequest -Uri "$url/payments" -Method Post -Headers $h -Body $b -UseBasicParsing
        return @{ StatusCode = $resp.StatusCode; Content = $resp.Content }
    } catch {
        return @{ StatusCode = $_.Exception.Response.StatusCode.value__; Error = $_.Exception.Message }
    }
} -ArgumentList $baseUrl, $headers, $body

$res1 = Receive-Job -Job $job1 -Wait
$res2 = Receive-Job -Job $job2 -Wait
Remove-Job -Job $job1, $job2

Write-Host "`nResults:" -ForegroundColor Cyan
Write-Host "Request 1 Response Code: $($res1.StatusCode)"
Write-Host "Request 2 Response Code: $($res2.StatusCode)"

$payerAfter = Invoke-RestMethod -Uri "$baseUrl/accounts/u1" -Method Get
Write-Host "`nPayer (u1) Balance After Race Test: $($payerAfter.balance)" -ForegroundColor Green

$expectedBalance = [decimal]$payerBefore.balance - [decimal]50.0000
if ([decimal]$payerAfter.balance -eq $expectedBalance) {
    Write-Host "[SUCCESS] Double-charge prevented! Account was debited exactly once." -ForegroundColor Green
} else {
    Write-Host "[FAILED] Double-charge occurred! Account balance differs from expected." -ForegroundColor Red
}
