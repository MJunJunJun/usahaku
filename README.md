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
- Backend API: http://localhost:8000
- MongoDB: mongodb://localhost:27017

### Akun admin default
- Email: `admin@usahaku.id`
- Password: `admin123`

### Hentikan layanan
```bash
docker compose down
```
