@echo off
cd /d "F:\Peoject AI\Usahaku\tools\gowa"
echo [..] Menjalankan GoWA native...
start "GoWA" /min gowa.exe rest --port=3001 --basic-auth=admin:admin123 --webhook=http://localhost:8000/api/wa/webhook?secret=usahaku_wa_secret_2026 --webhook-secret=usahaku_wa_secret_2026 --os=UsahaKu --account-validation=false > ..\..\gowa.log 2>&1
timeout /t 3 /nobreak >nul