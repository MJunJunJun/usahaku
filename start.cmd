@echo off
title UsahaKu - Start System
cd /d "%~dp0"

echo ============================================
echo    UsahaKu - Menjalankan Sistem
echo ============================================

REM ---------- 1. CEK MONGODB ----------
sc query MongoDB | findstr "RUNNING" >nul 2>&1
if %errorlevel%==0 (
    echo [OK] MongoDB berjalan
) else (
    echo [..] MongoDB mati, mencoba menyalakan...
    net start MongoDB >nul 2>&1
    sc query MongoDB | findstr "RUNNING" >nul 2>&1
    if %errorlevel%==0 (
        echo [OK] MongoDB berhasil dinyalakan
    ) else (
        echo [X] GAGAL menyalakan MongoDB! Jalankan manual sebagai Administrator.
    )
)

REM ---------- 2. BACKEND (port 8000) ----------
netstat -aon | findstr ":8000" | findstr "LISTENING" >nul 2>&1
if %errorlevel%==0 (
    echo [OK] Backend sudah jalan di port 8000
) else (
    echo [..] Menjalankan backend di port 8000...
    start "UsahaKu Backend" /min cmd /c "pushd backend && .venv\Scripts\python.exe -m uvicorn server:app --host 0.0.0.0 --port 8000 > ..\backend.log 2>&1"
    timeout /t 6 /nobreak >nul
    netstat -aon | findstr ":8000" | findstr "LISTENING" >nul 2>&1
    if %errorlevel%==0 (
        echo [OK] Backend jalan: http://localhost:8000
    ) else (
        echo [X] Backend GAGAL jalan! Cek backend.log
    )
)

REM ---------- 3. FRONTEND (port 3000) ----------
netstat -aon | findstr ":3000" | findstr "LISTENING" >nul 2>&1
if %errorlevel%==0 (
    echo [OK] Frontend sudah jalan di port 3000
) else (
    echo [..] Menjalankan frontend di port 3000...
    start "UsahaKu Frontend" /min cmd /c "pushd frontend && call npm.cmd start > ..\frontend.log 2>&1"
    echo [OK] Frontend sedang kompilasi +- 40 detik
    echo     Browser akan terbuka otomatis di http://localhost:3000
)

REM ---------- 4. WHATSAPP GATEWAY / GoWA ----------
REM Baca kredensial GoWA dari backend\.env (sumber tunggal)
set "GOWA_USER=admin"
set "GOWA_PASS=admin123"
if exist "backend\.env" (
    for /f "usebackq tokens=1,* delims==" %%a in ("backend\.env") do (
        if /I "%%a"=="GOWA_USER" set "GOWA_USER=%%b"
        if /I "%%a"=="GOWA_PASS" set "GOWA_PASS=%%b"
    )
)
set "GOWA_MODE="
where docker >nul 2>&1
if not errorlevel 1 set "GOWA_MODE=docker"
if not defined GOWA_MODE (
    if exist "tools\gowa\gowa.exe" set "GOWA_MODE=native"
    if exist "tools\gowa\go-whatsapp-web-multidevice.exe" set "GOWA_MODE=native"
)
if "%GOWA_MODE%"=="" goto gowa_none
if "%GOWA_MODE%"=="docker" goto gowa_docker

:gowa_native
netstat -aon | findstr ":3001" | findstr "LISTENING" >nul 2>&1
if %errorlevel%==0 (
    echo [OK] GoWA native sudah jalan di port 3001
    goto gowa_done
)
echo [..] Menjalankan GoWA native (tanpa Docker)...
start "UsahaKu GoWA" /min cmd /c "pushd tools\gowa && gowa.exe rest --port=3001 --basic-auth=%GOWA_USER%:%GOWA_PASS% --webhook=http://localhost:8000/api/wa/webhook?secret=usahaku_wa_secret_2026 --webhook-secret=usahaku_wa_secret_2026 --os=UsahaKu --account-validation=false > ..\..\gowa.log 2>&1"
timeout /t 4 /nobreak >nul
netstat -aon | findstr ":3001" | findstr "LISTENING" >nul 2>&1
if %errorlevel%==0 (
    echo [OK] GoWA native jalan. Scan QR di: Panel Admin ^> WhatsApp ^> Tampilkan QR
) else (
    echo [X] GoWA GAGAL jalan! Cek gowa.log
)
goto gowa_done

:gowa_docker
docker info >nul 2>&1
if errorlevel 1 (
    echo [!] Docker terpasang tapi tidak jalan - buka Docker Desktop dulu.
    goto gowa_done
)
docker ps --format "{{.Names}}" | findstr /x "usahaku-gowa" >nul 2>&1
if %errorlevel%==0 (
    echo [OK] GoWA WhatsApp Gateway sudah jalan
    goto gowa_done
)
echo [..] Menjalankan GoWA via Docker Compose...
docker compose --env-file backend\.env up -d gowa
timeout /t 4 /nobreak >nul
docker ps --format "{{.Names}}" | findstr /x "usahaku-gowa" >nul 2>&1
if %errorlevel%==0 (
    echo [OK] GoWA jalan. Scan QR di: Panel Admin ^> WhatsApp ^> Tampilkan QR
) else (
    echo [X] GoWA GAGAL jalan! Cek: docker logs usahaku-gowa
)
goto gowa_done

:gowa_none
echo [!] Docker tidak ada dan GoWA.exe belum diunduh - WhatsApp dilewati.
echo     Cara aktifkan WhatsApp, pilih salah satu:
echo     A. Pasang Docker Desktop  -^> jalankan start.cmd lagi
echo     B. Unduh GoWA Windows dari github.com/aldinokemal/go-whatsapp-web-multidevice/releases
echo        lalu ekstrak isi zip ke folder: tools\gowa\
:gowa_done

echo ============================================
echo    Selesai!
echo    Log error : backend.log / frontend.log / gowa.log
echo    Untuk stop: jalankan stop.cmd
echo ============================================
pause
