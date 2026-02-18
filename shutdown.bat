@echo off
REM ============================================================================
REM Anthrilo Management System - Shutdown Script
REM Stops Redis, Backend, and Frontend
REM ============================================================================

echo.
echo ========================================================================
echo   ANTHRILO MANAGEMENT SYSTEM - SHUTDOWN
echo ========================================================================
echo.

echo [1/3] Stopping Frontend Server...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :3000 ^| findstr LISTENING') do (
    taskkill /F /PID %%a >nul 2>&1
)
echo     ✓ Frontend stopped

echo.
echo [2/3] Stopping Backend Server...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :8000 ^| findstr LISTENING') do (
    taskkill /F /PID %%a >nul 2>&1
)
echo     ✓ Backend stopped

echo.
echo [3/3] Stopping Redis...
docker stop redis-server >nul 2>&1
docker stop catalog_redis >nul 2>&1
echo     ✓ Redis stopped

echo.
echo ========================================================================
echo   ALL SERVICES STOPPED
echo ========================================================================
echo.
pause
