@echo off
title UsahaKu + GoWA Setup
cd /d "F:\Peoject AI\Usahaku"

echo.
echo [Memulai Backend API...]
cd backend
if not exist .venv (echo "-> Belum ada venv, install dulu.") else (
    call .\.venv\Scripts\activate
    pip install -r requirements.txt >nul 2>&1
    uvicorn server:app --host 0.0.0.0 --port 8000 --log-level warning &
)
echo [Backend jalan di http://localhost:8000]
echo.

echo [Memulai Frontend React...]
cd ..
if exist frontend (
    cd frontend
    npx react-scripts start >nul 2>&1 &
    echo [Frontend jalan di http://localhost:3000]
) else (
    echo "-> Folder frontend tidak ditemukan."
)
echo.

echo [Memulai GoWA (WhatsApp Gateway)...]
cd tools\gowa
if exist gowa.exe (
    echo [..] Memastikan GoWA port 3001...
    taskkill /F /IM gowa.exe 2>nul
    timeout /t 2 /nobreak >nul
    start "GoWA" /min gowa.exe rest --port=3001 --basic-auth=admin:admin123 --webhook=http://localhost:8000/api/wa/webhook?secret=usahaku_wa_secret_2026 --webhook-secret=usahaku_wa_secret_2026 --os=UsahaKu --account-validation=false
    timeout /t 5 /nobreak >nul
    echo [GoWAjalan di http://localhost:3001]
) else (
    echo "-> File gowa.exe tidak ditemukan di tools\gowa"
)
echo.

echo ===== SEMUA SERVICE SUDAH DIMULAI =====
echo.
echo - Backend : http://localhost:8000
echo - Frontend: http://localhost:3000
echo - GoWA    : http://localhost:3001 (WhatsApp Gateway)
echo.
echo [Catakan] Untuk berhenti semua, tutup jendela CMD ini atau tekan Ctrl+C.
echo.
pause