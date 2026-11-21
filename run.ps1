# Distributed Payment System - Phase 1 Launcher (PowerShell)
$ErrorActionPreference = "Stop"

Write-Host "===================================================" -ForegroundColor Cyan
Write-Host "Starting Distributed Payment System - Phase 1" -ForegroundColor Cyan
Write-Host "===================================================" -ForegroundColor Cyan

$env:JAVA_HOME = "C:\Program Files\Microsoft\jdk-17.0.21.102-hotspot"
$env:MAVEN_HOME = "$env:LOCALAPPDATA\Programs\apache-maven"
$env:Path = "$env:JAVA_HOME\bin;$env:MAVEN_HOME\bin;" + $env:Path

Write-Host "Java Version:" -ForegroundColor Yellow
& "$env:JAVA_HOME\bin\java.exe" -version

$jarPath = Join-Path $PSScriptRoot "target\distributed-payment-system-1.0.0-SNAPSHOT.jar"
if (-not (Test-Path $jarPath)) {
    Write-Host "Building project JAR..." -ForegroundColor Yellow
    & "$env:MAVEN_HOME\bin\mvn.cmd" clean package -DskipTests
}

Write-Host "`nStarting Spring Boot on http://localhost:8080 ..." -ForegroundColor Green
& "$env:JAVA_HOME\bin\java.exe" -jar $jarPath
