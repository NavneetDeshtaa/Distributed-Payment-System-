@echo off
setlocal
echo ==========================================================
echo    DISTRIBUTED PAYMENT PROCESSING INFRASTRUCTURE LAUNCHER  
echo ==========================================================

set "JAVA_HOME=C:\Program Files\Microsoft\jdk-17.0.21.102-hotspot"
set "PATH=%JAVA_HOME%\bin;%PATH%"

echo.
echo [1/5] Ensuring Docker Infrastructure is UP (Redis, Kafka, ZooKeeper, Prometheus, Grafana)...
docker compose up -d

echo.
echo [2/5] Building Multi-Module Java Services (payment-service & api-gateway)...
if not exist "%~dp0payment-service\target\payment-service-1.0.0-SNAPSHOT.jar" (
    call "%~dp0mvnw.cmd" clean package -DskipTests
)
if not exist "%~dp0api-gateway\target\api-gateway-1.0.0-SNAPSHOT.jar" (
    call "%~dp0mvnw.cmd" clean package -DskipTests
)

echo.
echo [3/5] Starting Polyglot Python Fraud AI Microservice on port 8000...
start "Fraud AI Service" cmd /k "cd /d %~dp0fraud-service && python -m uvicorn main:app --host 0.0.0.0 --port 8000"

echo.
echo [4/5] Starting Payment Core Service (:8080) & Edge Gateway (:8090)...
start "Payment Core Service" cmd /k "java -jar %~dp0payment-service\target\payment-service-1.0.0-SNAPSHOT.jar"
start "Edge API Gateway" cmd /k "java -jar %~dp0api-gateway\target\api-gateway-1.0.0-SNAPSHOT.jar"

echo.
echo [5/5] Starting React Frontend Dashboard on port 3000...
start "Frontend Dashboard" cmd /k "cd /d %~dp0frontend && npx vite --port 3000 --host"

echo.
echo ==========================================================
echo    ALL SERVICES STARTED SUCCESSFULLY!
echo    - React Frontend:    http://localhost:3000
echo    - Grafana Metrics:   http://localhost:3001 (admin/admin)
echo    - Prometheus UI:     http://localhost:9090
echo    - Edge API Gateway:  http://localhost:8090
echo    - Payment Service:   http://localhost:8080
echo    - Python Fraud AI:   http://localhost:8000
echo ==========================================================
endlocal
