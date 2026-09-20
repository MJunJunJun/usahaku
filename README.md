# Situska

## Menjalankan dengan Docker

### Prasyarat
- Docker
- Docker Compose

### Jalankan aplikasi
```bash
docker compose up --build
```

Setelah berjalan:
- Frontend: http://localhost:3000
- MongoDB: mongodb://localhost:27017

Catatan:
- Request API dari browser tetap lewat `http://localhost:3000/api/*` dan otomatis diproxy ke service backend.
- Service backend dan GoWA berjalan di jaringan internal Docker (tidak dibuka ke host).
- Alur WhatsApp: frontend -> backend (`/api/admin/wa/*`) -> GoWA (`http://gowa:3000`) internal antar-container.

### Konfigurasi keamanan produksi

Jangan gunakan akun atau secret bawaan. Sebelum menjalankan Docker Compose,
buat `.env` di server dan isi `MONGO_ROOT_USERNAME`, `MONGO_ROOT_PASSWORD`,
`MONGO_URL` (dengan kredensial yang sudah di-URL-encode), `JWT_SECRET`,
`GOWA_USER`, `GOWA_PASS`, `WHATSAPP_WEBHOOK_SECRET`, dan
`ADMIN_TOTP_SECRET` dengan nilai unik berentropi tinggi. `ADMIN_EMAIL` dan
`ADMIN_PASSWORD` bersifat opsional dan hanya dipakai untuk bootstrap
administrator pertama. Administrator wajib menggunakan TOTP pada deployment
Docker; buat secret TOTP dari aplikasi authenticator dan jangan menyimpannya
di Git.

Publikasikan hanya reverse proxy/CDN yang menangani HTTPS ke
`127.0.0.1:3000`; jangan mengubah `FRONTEND_BIND_ADDRESS` menjadi `0.0.0.0`
tanpa firewall. Aktifkan redirect HTTPS dan HSTS pada proxy/CDN tersebut.

GoWA tidak boleh dipublikasikan. Dalam Docker port GoWA tidak dipetakan ke
host; pada mode native launcher mengikatnya ke `127.0.0.1:3001`, serta
menonaktifkan dashboard dan MCP GoWA. Jalankan sekali PowerShell sebagai
Administrator: `powershell -ExecutionPolicy Bypass -File .\tools\block-public-gowa.ps1`
untuk menambahkan blokir firewall sebagai lapisan tambahan. QR WhatsApp hanya
tersedia melalui panel admin yang telah login.

### Hentikan layanan
```bash
docker compose down
```
