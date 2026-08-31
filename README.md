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
- Backend: http://localhost:8000
- GoWA: http://localhost:3001
- MongoDB: mongodb://localhost:27017

Catatan:
- Request API dari browser tetap lewat `http://localhost:3000/api/*` dan otomatis diproxy ke service backend.

### Akun admin default
- Email: `admin@usahaku.id`
- Password: `admin123`

### Hentikan layanan
```bash
docker compose down
```
