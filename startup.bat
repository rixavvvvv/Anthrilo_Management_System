@echo off
REM ============================================================================
REM Anthrilo Management System - Startup Script
REM Automatically starts Redis, Backend, and Frontend
REM ============================================================================

echo.
echo ========================================================================
echo   ANTHRILO MANAGEMENT SYSTEM - STARTUP
echo ========================================================================
echo.

REM Check if Docker is running
docker info >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Docker is not running!
    echo Please start Docker Desktop and try again.
    pause
    exit /b 1
)

echo [1/4] Starting Redis...
echo.

REM Try to start existing container first
docker start redis-server >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    echo     ✓ Redis started on port 6379
    goto :redis_done
)

REM If start failed, check if container is already running
docker ps --filter "name=redis-server" --format "{{.Names}}" 2>nul | findstr "redis-server" >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    echo     ✓ Redis already running on port 6379
    goto :redis_done
)

REM If container doesn't exist, try to create it
docker run -d --name redis-server -p 6379:6379 redis:7-alpine >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    echo     ✓ Redis created and started on port 6379
    goto :redis_done
)

REM If creation failed, container name might be in use - remove and recreate
docker rm -f redis-server >nul 2>&1
docker run -d --name redis-server -p 6379:6379 redis:7-alpine >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    echo     ✓ Redis recreated and started on port 6379
) else (
    echo     [ERROR] Failed to start Redis
    echo     Try manually: docker start redis-server
    pause
    exit /b 1
)

:redis_done
timeout /t 2 /nobreak >nul

echo.
echo [2/4] Starting Backend Server...
echo.

REM Navigate to backend directory and start server in new window
cd /d "%~dp0backend"
start "Anthrilo Backend" cmd /k "call ..\.venv\Scripts\activate.bat && uvicorn app.main:app --reload --host 0.0.0.0 --port 8000"

echo     ✓ Backend starting on http://localhost:8000
timeout /t 3 /nobreak >nul

echo.
echo [3/4] Starting Frontend Server...
echo.

REM Navigate to frontend directory and start server in new window
cd /d "%~dp0frontend"
start "Anthrilo Frontend" cmd /k "npm run dev"

echo     ✓ Frontend starting on http://localhost:3000
timeout /t 2 /nobreak >nul

echo.
echo [4/4] Running Health Checks...
echo.
timeout /t 5 /nobreak >nul

powershell -Command "try { $r = Invoke-RestMethod -Uri 'http://localhost:8000/health' -TimeoutSec 5; Write-Host '     ✓ Backend is healthy' -ForegroundColor Green } catch { Write-Host '     ⚠ Backend may still be starting...' -ForegroundColor Yellow }"

echo.
echo ========================================================================
echo   STARTUP COMPLETE!
echo ========================================================================
echo.
echo   Services Running:
echo   • Redis:    redis://localhost:6379
echo   • Backend:  http://localhost:8000
echo   • Frontend: http://localhost:3000
echo.
echo   Access your application at: http://localhost:3000
echo.
echo   To stop all services, run: shutdown.bat
echo ========================================================================
echo.

REM Keep window open
pause
