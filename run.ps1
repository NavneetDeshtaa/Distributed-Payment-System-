# Enterprise Distributed Payment Processing Infrastructure Launcher
$ErrorActionPreference = "Continue"

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "   DISTRIBUTED PAYMENT PROCESSING INFRASTRUCTURE LAUNCHER  " -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan

$env:JAVA_HOME = "C:\Program Files\Microsoft\jdk-17.0.21.102-hotspot"
$env:Path = "$env:JAVA_HOME\bin;" + $env:Path

# 1. Start Docker Infrastructure
Write-Host "`n[1/5] Ensuring Docker Infrastructure is UP (Postgres, Redis, Kafka, ZooKeeper)..." -ForegroundColor Yellow
docker compose up -d

# 2. Build Multi-Module Projects if needed
$paymentJar = "payment-service\target\payment-service-1.0.0-SNAPSHOT.jar"
$gatewayJar = "api-gateway\target\api-gateway-1.0.0-SNAPSHOT.jar"

if (-not (Test-Path $paymentJar) -or -not (Test-Path $gatewayJar)) {
    Write-Host "`n[2/5] Building Multi-Module Java services..." -ForegroundColor Yellow
    .\mvnw.cmd clean package -DskipTests
}

# 3. Start Python Fraud AI (:8000)
Write-Host "`n[3/5] Starting Polyglot Python Fraud AI Microservice on port 8000..." -ForegroundColor Yellow
Start-Process -NoNewWindow powershell -ArgumentList "-Command cd fraud-service; python -m uvicorn main:app --host 0.0.0.0 --port 8000"

# 4. Start Core Payment Service (:8080) & Edge Gateway (:8090)
Write-Host "`n[4/5] Starting Payment Core Service (:8080) & Edge Gateway (:8090)..." -ForegroundColor Yellow
Start-Process -NoNewWindow powershell -ArgumentList "-Command java -jar $paymentJar"
Start-Process -NoNewWindow powershell -ArgumentList "-Command java -jar $gatewayJar"

# 5. Start Frontend (:3000)
Write-Host "`n[5/5] Starting React Frontend Dashboard on port 3000..." -ForegroundColor Yellow
Start-Process -NoNewWindow powershell -ArgumentList "-Command cd frontend; npx vite --port 3000 --host"

Write-Host "`n==========================================================" -ForegroundColor Green
Write-Host "   ALL SERVICES STARTED SUCCESSFULLY!                     " -ForegroundColor Green
Write-Host "   - React Frontend:    http://localhost:3000              " -ForegroundColor Green
Write-Host "   - Grafana Metrics:   http://localhost:3001 (admin/admin)" -ForegroundColor Green
Write-Host "   - Prometheus UI:     http://localhost:9090              " -ForegroundColor Green
Write-Host "   - Edge API Gateway:  http://localhost:8090              " -ForegroundColor Green
Write-Host "   - Payment Service:   http://localhost:8080              " -ForegroundColor Green
Write-Host "   - Python Fraud AI:   http://localhost:8000              " -ForegroundColor Green
Write-Host "==========================================================" -ForegroundColor Green
