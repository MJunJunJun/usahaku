@echo off
title UsahaKu - Stop System
cd /d "%~dp0"

echo ============================================
echo    UsahaKu - Menghentikan Sistem
echo ============================================

call :killport 8000 "Backend "
call :killport 3000 "Frontend"

REM ---------- GoWA: versi Docker ----------
set "GOWA_STOPPED="
where docker >nul 2>&1
if not errorlevel 1 (
    docker ps --format "{{.Names}}" | findstr /x "usahaku-gowa" >nul 2>&1
    if not errorlevel 1 (
        docker stop usahaku-gowa >nul 2>&1
        echo [OK] GoWA Docker dihentikan
        set "GOWA_STOPPED=1"
    )
)

REM ---------- GoWA: versi native .exe ----------
tasklist /FI "IMAGENAME eq gowa.exe" 2>nul | findstr /I "gowa.exe" >nul
if not errorlevel 1 (
    taskkill /F /IM gowa.exe /T >nul 2>&1
    echo [OK] GoWA native dihentikan
    set "GOWA_STOPPED=1"
)
tasklist /FI "IMAGENAME eq go-whatsapp-web-multidevice.exe" 2>nul | findstr /I "go-whatsapp" >nul
if not errorlevel 1 (
    taskkill /F /IM go-whatsapp-web-multidevice.exe /T >nul 2>&1
    echo [OK] GoWA native dihentikan
    set "GOWA_STOPPED=1"
)

if not defined GOWA_STOPPED echo [-] GoWA memang tidak sedang jalan

echo.
echo Semua proses UsahaKu sudah dihentikan.
echo (MongoDB tetap berjalan sebagai service Windows)
echo ============================================
pause
goto :eof

:killport
set "PORT=%~1"
set "NAMA=%~2"
set "FOUND="
for /f "tokens=5" %%p in ('netstat -aon ^| findstr ":%PORT%" ^| findstr "LISTENING"') do (
    set FOUND=1
    taskkill /F /T /PID %%p >nul 2>&1
)
if defined FOUND (
    echo [OK] %NAMA% di port %PORT% dihentikan
) else (
    echo [-] %NAMA% memang tidak sedang jalan
)
goto :eof
