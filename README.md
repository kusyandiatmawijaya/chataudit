# ChatAudit — WhatsApp Audit & Business Intelligence Platform

Dashboard manajemen multi-device WhatsApp, real-time monitoring chat, audit analisis berbasis AI (LLM), pelaporan bisnis (*Business Intelligence*), dan sinkronisasi data eksternal yang bersifat universal/general.

---

## 🚀 Fitur Utama

- **Multi-Device WhatsApp Management** — Koneksi banyak nomor WhatsApp melalui QR Code (Baileys WebSocket).
- **Real-time Monitoring & Audit** — Intercept pesan masuk/keluar, filter kontak yang dikecualikan (*Excluded Chats*).
- **AI Chat Analysis & BI Raport** — Analisis kinerja percakapan dan evaluasi otomatis dengan AI.
- **Universal External Data Sync (General Sync)**:
  - Dukungan API manapun (GET/POST) tanpa ketergantungan pada vendor/perusahaan tertentu.
  - Opsi Autentikasi Fleksibel (*Basic Auth*, *Bearer Token*, *API Key Header*, atau *No Auth*).
  - Paginasi Dinamis (*Offset-Limit*, *Page Number*, atau *Single Fetch*).
  - *Dynamic Field Mapping* (JSON pemetaan kolom API eksternal ke entitas internal).
  - *Inbound Push Webhook* (`POST /api/sync/push/:module`) agar sistem ERP eksternal dapat mengirimkan data secara langsung.
  - *Dynamic Custom Data Sets* (`CustomDataSet` & `CustomDataRow`) untuk tabel khusus apa saja.
- **Chatbot & Persona Auto-Reply** — AI Assistant dengan RAG Knowledge Base.
- **Broadcast & Template Engine** — Pengiriman pesan massal terencana dengan jeda anti-blokir.

---

## 🛠️ Tech Stack & Arsitektur (Opsi A)

```text
chataudit/
├── package.json        # Root script: menjalankan backend & frontend bersamaan
├── backend/            # Express.js v5 + Socket.IO + Baileys + Prisma (PostgreSQL)
│   ├── server.js
│   ├── controllers/syncController.js  # General Sync Engine
│   ├── routes/syncRoutes.js
│   └── prisma/schema.prisma
└── frontend/           # React 19 (Vite) + Tailwind CSS + Lucide Icons + Recharts
    ├── src/pages/SyncPage.jsx
    └── vite.config.js
```

---

## 🏁 Cara Menjalankan di Lokal (WSL / Ubuntu)

### 1. Masuk ke Direktori Project
```bash
cd ~/chataudit
```

### 2. Konfigurasi Environment Backend
Salin file konfigurasi:
```bash
cp backend/.env.example backend/.env
```
Sesuaikan `DATABASE_URL` (koneksi PostgreSQL Anda) dan `JWT_SECRET`.

### 3. Generate Prisma Client
```bash
cd backend
npx prisma generate
```

### 4. Jalankan Server Dev (Backend + Frontend Bersamaan)
Dari root folder `chataudit`:
```bash
cd ~/chataudit
npm run dev
```

- **Frontend (UI Dashboard):** [http://localhost:5173](http://localhost:5173)
- **Backend (API Server):** [http://localhost:3013](http://localhost:3013)
