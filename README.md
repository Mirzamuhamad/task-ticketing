# Portal Task Ticketing System

Webapp ticketing sesuai PRD: NestJS API, React dashboard, Socket.IO realtime, upload lampiran, RBAC, audit log, notifikasi in-app, dan MySQL.

## Stack

- Backend: NestJS, TypeORM, JWT, Socket.IO, Multer
- Frontend: React + Vite + Socket.IO Client
- Database: MySQL 8

## Fitur Utama

- Login role customer, support, dan admin
- Dashboard statistik tiket
- Buat tiket dengan kategori, prioritas, deskripsi, dan lampiran
- Detail tiket dengan chat realtime
- Upload JPG, JPEG, PNG, GIF, PDF, DOCX, XLSX maksimal 10 MB
- Status workflow: Open, Assigned, In Progress, Waiting Customer, Solved, Closed
- Assignment support oleh admin
- Close ticket oleh customer saat status Solved
- Audit trail untuk login, tiket, pesan, upload, dan close
- Notifikasi in-app realtime

## Menjalankan Lokal

1. Salin konfigurasi:

```bash
cp .env.example .env
```

2. Jalankan MySQL:

```bash
docker compose up -d mysql
```

3. Install dependency:

```bash
npm install
```

4. Jalankan backend dan frontend:

```bash
npm run dev
```

Frontend berjalan di `http://localhost:5173`, backend di `http://localhost:4000/api`.

## Akun Demo

Semua akun memakai password `password123`.

- Admin: `admin@demo.test`
- Support: `support@demo.test`
- Customer: `customer@demo.test`

Seed user dan kategori dibuat otomatis ketika backend pertama kali terhubung ke database.

## Catatan Produksi

- Ganti `JWT_SECRET` sebelum deploy.
- Matikan `synchronize` TypeORM dan gunakan migration untuk production.
- Pasang HTTPS di reverse proxy.
- Jadwalkan backup harian database dengan retensi minimal 30 hari.
