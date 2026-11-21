@echo off
setlocal
echo ===================================================
echo Starting Distributed Payment System - Phase 1
echo ===================================================

set "JAVA_HOME=C:\Program Files\Microsoft\jdk-17.0.21.102-hotspot"
set "MAVEN_HOME=%LOCALAPPDATA%\Programs\apache-maven"
set "PATH=%JAVA_HOME%\bin;%MAVEN_HOME%\bin;%PATH%"

echo Using Java:
"%JAVA_HOME%\bin\java.exe" -version

if not exist "%~dp0target\distributed-payment-system-1.0.0-SNAPSHOT.jar" (
    echo Building project JAR...
    call "%MAVEN_HOME%\bin\mvn.cmd" clean package -DskipTests
)

echo Starting Spring Boot on http://localhost:8080 ...
"%JAVA_HOME%\bin\java.exe" -jar "%~dp0target\distributed-payment-system-1.0.0-SNAPSHOT.jar"

endlocal
