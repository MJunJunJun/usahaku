# UsahaKu

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

### Akun admin default
- Email: `admin@usahaku.id`
- Password: `admin123`

### Hentikan layanan
```bash
docker compose down
```
