# AI Agent PRD — Audit WA (WhatsApp Audit Dashboard)

> **Tujuan Dokumen**: Dokumen ini adalah referensi utama bagi AI Coding Agent untuk memahami, mengembangkan, men-debug, dan memperluas aplikasi **Audit WA**. Dokumen mencakup arsitektur, database schema, API reference, frontend routing, konvensi kode, bug yang diketahui, dan aturan mutlak yang harus dipatuhi.

---

## 1. Ringkasan Proyek

**Audit WA** adalah dashboard web untuk menghubungkan, memonitor, dan mengaudit percakapan WhatsApp dari berbagai device (multi-device). Fitur utama saat ini telah berkembang menjadi platform WhatsApp Business Intelligence dan Automasi yang komprehensif:

- **Multi-Device Management** — Hubungkan banyak akun WhatsApp via QR code.
- **Real-time Chat Monitoring** — Intercept & simpan pesan masuk/keluar secara otomatis.
- **Exclude Chats** — Abaikan chat sensitif/tidak relevan dari monitoring.
- **AI Chat Analysis & BI Reports** — Kirim transkrip chat ke LLM untuk analisis, ringkasan, atau ekstraksi data (Buku Raport/BI Report Cards).
- **Group Chat Analysis** — Analisis tingkat partisipasi, topik, dan ringkasan khusus untuk grup WhatsApp.
- **AI Dictionary & Knowledge Base** — Kamus jargon bisnis & Product Knowledge (RAG) yang di-inject ke prompt AI.
- **Scheduled AI Reports & Backups** — Jadwal otomatis analisis AI berkala dan auto-backup.
- **Chatbot & Auto-Reply Fallback** — Fallback auto-reply dengan dukungan Persona, Whitelist, dan RAG-based answers untuk Chatbot WA. AI juga mendukung tools pencarian data invoice, katalog produk, cek resi pembayaran, dan cek promo.
- **Broadcast & Templates** — Fitur pengiriman pesan massal menggunakan templates yang dinamis.
- **Data Sync & Management** — Sinkronisasi data eksternal (Customer, Outstanding AR, Credit Limit, Daftar Harga Barang) untuk memperkaya konteks AI.
- **Promo Management** — Publikasi dan pengelolaan kampanye promosi kepada pelanggan.
- **User Management & RBAC** — Sistem user dengan role (DEVELOPER, ADMINISTRATOR, USER).

---

## 2. Tech Stack

| Layer | Teknologi | Versi/Detail |
|---|---|---|
| **Runtime** | Node.js | CommonJS (`"type": "commonjs"`) |
| **Backend Framework** | Express.js | v5.2.1 |
| **Real-time** | Socket.IO | v4.8.3 (server) + v4.8.3 (client) |
| **WhatsApp Client** | `@whiskeysockets/baileys` | v7.0.0-rc13 (WebSockets-based, no Puppeteer) |
| **Headless Browser** | Puppeteer | v25.3.0 (untuk PDF/Image generation) |
| **Database** | PostgreSQL | Koneksi via `DATABASE_URL` di `.env` |
| **ORM** | Prisma | v5.22.0 |
| **AI Provider** | Groq SDK / Multi Provider | Konfigurasi Model dinamis di database. |
| **Auth** | JWT (`jsonwebtoken`) + `bcryptjs` | Token expires in 24h |
| **File Upload** | Multer | v2.2.0 |
| **Report Generation** | Puppeteer (PDF), ExcelJS (XLSX), Puppeteer (PNG) | — |
| **Frontend Framework** | React | v19.2.7 (Vite v8.1.1) |
| **Styling** | Tailwind CSS | v3.4.19 + `@tailwindcss/typography` |
| **Icons** | `lucide-react` | v1.23.0 |
| **HTTP Client** | Axios | v1.18.1 |
| **Routing** | React Router DOM | v7.18.1 |
| **Process Manager** | PM2 | Nama proses: `audit_wa_backend` (ID `11`) |

---

## 3. Environment Variables (`.env`)

File: `backend/.env`

```env
DATABASE_URL="postgresql://<user>:<password>@localhost:5433/audit_wa?schema=public"
PORT=3013
OPENROUTER_API_KEY=sk_xxxxx
JWT_SECRET=your_super_secret_jwt_key_here    # Wajib di-set
```

> **PENTING**: Fallback `secret-key` untuk `JWT_SECRET` telah dihapus demi keamanan. Jika `JWT_SECRET` tidak di-set di `.env`, backend akan langsung melempar error dan berhenti beroperasi (crash) pada saat startup.

---

## 4. Arsitektur & Data Flow

- **WhatsApp Connection**: Backend menginisialisasi WebSocket connection per session via `@whiskeysockets/baileys` (di `whatsapp.js`). QR code di-emit via Socket.IO ke frontend.
- **Message Ingestion**: Pesan di-normalize, dicek excluded list, dicek duplikat, lalu disimpan ke DB via `saveMessage()`. Media di-download dan disimpan ke `backend/uploads/`.
- **Chatbot Handler & Polling**: Sistem bisa memproses pesan masuk dan secara mandiri merespon dengan balasan berbasis Persona (RAG + Prompt Template).
- **TapTalk & OneTalk Integration**: Sistem terintegrasi dengan TapTalk ecosystem. Pesan balasan (reply) untuk sesi chat aktif dikirim menggunakan **OneTalk Webhook API** (`ONETALK_URL`) dengan menyertakan `caseID`. Jika webhook tidak memungkinkan (atau tidak ada `caseID`), sistem melakukan *fallback* menggunakan **TapTalk Broadcast API** (`TAPTALK_BASE_URL`).
- **External Data Sync**: Scheduler berjalan secara background untuk sinkronisasi data dari API external ke local DB.
- **Broadcast System**: Antrean sistem untuk pengiriman broadcast massal menggunakan Template WhatsApp secara terencana.

---

## 5. Database Schema (Prisma)

File: `backend/prisma/schema.prisma` mencakup 28 Models:

### Core Models
- `Session` — Perangkat WhatsApp.
- `Message` — Riwayat Chat.
- `User` — Autentikasi Pengguna.
- `ExcludedChat` — Daftar hitam kontak monitoring.
- `Dictionary` — Kamus AI Jargon Bisnis.

### Automation & Reporting
- `ReportSchedule` — Jadwal otomatis laporan.
- `BackupSchedule`, `BackupLog` — Penjadwalan log backup database media.
- `ReportCard`, `BIReportCard` — Analisis chat menggunakan skor dan evaluasi grading otomatis dari LLM.
- `PaymentExtraction` — Catatan parsing informasi resi pembayaran / transfer yang otomatis terdeteksi via Chat.

### External Data & Sync
- `Customer`, `OutstandingAr`, `AnalisaCreditLimit` — Data cermin (snapshot) master data dari ERP eksternal.
- `DaftarHargaBarang` — Katalog produk dan daftar harga barang dari sistem eksternal.
- `SyncSetting`, `SyncLog` — Endpoint dan jadwal otomatis sync data.

### Marketing & Promosi
- `Promo` — Penyimpanan data kampanye promo, lengkap dengan deskripsi, gambar, dan periode berlaku.

### Chatbot & Knowledge Base
- `Persona` — AI Persona Settings yang digunakan dalam membalas chat secara independen.
- `Contact` — Daftar Kontak yang telah terpetakan dan terkait kepada Persona tertentu.
- `ChatbotWhitelist` — Pengendali daftar siapa saja yang boleh menggunakan chatbot.
- `ProductKnowledge` — Dokumen referensi (Knowledge Base) untuk RAG Chatbot.

### Broadcast & Templates
- `Template` — WhatsApp message templates, support variabel dinamik.
- `Broadcast`, `BroadcastRecipient` — Task antrean pengiriman broadcast dan log status penerima.
- `PromptTemplate` — Template system prompts AI.

### Settings
- `AppSetting` — Key-Value global config aplikasi.
- `ListAIModel` — Manajemen Model LLM dari berbagai provider yang diaktivasi sistem.

---

## 6. API Reference

Selain endpoint lama (seperti `/api/auth`, `/api/sessions`, `/api/messages`, dll), ini daftar endpoint pengembangan baru:

| Base Route | Deskripsi |
|---|---|
| `/api/contacts` | CRUD & mapping WhatsApp Contact ke database Customer & Persona. |
| `/api/personas` | CRUD & tuning custom AI prompts Persona chatbot WA. |
| `/api/knowledge` | Upload dan ekstraksi otomatis file PDF/Teks ke DB sebagai basis knowledge AI Chatbot RAG. |
| `/api/broadcasts` | Scheduler, monitoring log, dan memicu manual broadcast ke banyak nomor (recipient). |
| `/api/templates` | Penyuntingan template WhatsApp message. |
| `/api/settings` | Pengaturan variabel enviroment key/value dalam DB (Application Config). |
| `/api/ai-models` | Setup pemilihan default model AI, API keys terkait, dsb. |
| `/api/sync` | Trigger pull master data eksternal ke database lokal (Customer, Credit Limit, dsb). |
| `/api/backup` | Trigger jadwal Backup database. |
| `/api/raport`, `/api/bi-raport` | Fetch Report Card analytics & BI Analysis dari tabel laporan. |
| `/api/group-analysis` | Analisis sentimen, keaktifan, dan ekstraksi dari percakapan di grup WhatsApp. |
| `/api/bi-chat` | Interaktif Chat interface yang di-inject data Business Intelligence terbaru (Outstanding, dll). |
| `/api/prompts` | Manajemen dynamic Prompt Templates, baik text maupun multi-input form format. |
| `/api/promos` | CRUD dan manajemen promosi (banner, masa berlaku, deskripsi promo). |

---

## 7. Frontend Architecture

### Routing (React Router `frontend/src/App.jsx`)

Semua Route dibawah komponen `Layout.jsx` kecuali Login.

- `/login` — Login Screen
- `/` — Real-time Dashboard Monitoring Chats
- `/schedules` — Scheduled Reports
- `/users` — User Management
- `/profile` — Profil User & Ubah Password
- `/dictionary` — Kamus AI
- `/raport` — Buku Raport: menampilkan Report Cards Analisis AI Per User / Sales
- `/data-management` — Menampilkan Data External Tersinkronisasi (Master Customer, AR)
- `/sync` — Integrasi Sync Endpoint (Konfigurasi Sync API External)
- `/bi-chat` — BI Chat AI (Tanya jawab dengan asisten pintar berbasis data external ERP)
- `/prompts` — Editor AI Prompt Templates
- `/templates` — Editor Broadcast WA Templates
- `/broadcasts` — Manajemen Antrean dan History Broadcast WA
- `/chatbot` — Pengaturan Chatbot Settings (Toggle engine, Fallback messages, Whitelists)
- `/personas` — Editor Chatbot Persona AI & Tools Assignment
- `/contacts` — Manajemen Daftar Kontak (Bisa block/allow AI reply, Assign persona, Tag Sales ID)
- `/knowledge` — Upload Dokumen Produk untuk RAG / Ekstraksi Informasi AI
- `/promos` — Manajemen Promosi
- `/group-analysis` — Analisis percakapan Group Chat
- `/settings` — Halaman Pengaturan Aplikasi Dasar

---

## 8. Directory Structure (Aktual)

```text
/var/www/audit_wa/
├── package.json
├── backend/
│   ├── server.js               # Main entry Express.js
│   ├── whatsapp.js             # Integrasi Baileys WhatsApp Client
│   ├── scheduler.js            # Node-cron schedule workers
│   ├── chatbotHandler.js       # Fallback & AI Chatbot Response processing (RAG + Prompt)
│   ├── middleware/             # auth.js (JWT)
│   ├── routes/                 # Endpoint logic (auth.js, users.js, contacts.js, biRaport.js, dll)
│   ├── prisma/
│   │   └── schema.prisma       # Definisi Database (26 Models)
│   ├── uploads/                # Media lokal
│   └── (utilities & helpers seperti formatter.js, contactController.js, dsb)
├── frontend/
│   ├── src/
│   │   ├── main.jsx
│   │   ├── App.jsx             # React Routes config
│   │   ├── index.css           # Tailwind utilities
│   │   ├── components/         # Layout.jsx
│   │   └── pages/              # 19 Screen / Komponen SPA Halaman
└── AI_AGENT_PRD.md             # Dokumen ini
```

---

## 9. Build & Deployment

```bash
# Development backend + frontend
npm run dev

# Production Build
cd frontend && npm run build
pm2 restart 11

# DB Migration setelah ubah schema.prisma
cd backend
npx prisma migrate dev --name <migration_name>
npx prisma generate
pm2 restart 11
```

---

## 10. Aturan Kritis untuk AI Agent

### ⚠️ A. WhatsApp LID (Long ID) Normalization
Gunakan pola `getNumber` dari JID agar sinkron dalam tabel saat parsing pesan.

### ⚠️ B. Frontend Flexbox — `min-w-0` WAJIB
Untuk menghindari container membesar keluar batas pada flex layout berisi string panjang, `min-w-0` harus dipasang.

### ⚠️ C. Status Message Filtering
Tampilkan query UI tanpa WhatsApp Status (`isStatus: false`).

### ⚠️ D. Timezone Handling (WIB)
Semua fungsi Scheduler & DateRange menggunakan TimeZone Asia/Jakarta (WIB) walau disimpan dalam bentuk UTC.

### ⚠️ E. Excluded Chat Enforcement
Berlaku pada proses intercept monitoring. Fitur yang memproses notifikasi dan alert HARUS cek terhadap excluded list.

### ⚠️ F. Chatbot & RAG (Retrieval-Augmented Generation)
Fitur `KnowledgeManager` & `chatbotHandler` memproses data dari `ProductKnowledge` untuk konteks AI. Saat mengubah prompt chatbot atau logika pembalasan, pertimbangkan efisiensi jumlah *context tokens* LLM, serta validasi bahwa file parsing berhasil dilakukan.

### ⚠️ G. Multiple Database Sync (Data Master ERP)
Aplikasi menyimpan local snapshot data ERP (`Customer`, `OutstandingAr`). Proses upsert berjalan otomatis via scheduler task di backend. JANGAN asal truncate atau mengubah constraint unik pada schema-schema ini tanpa review logika sync di routes/controllers agar tidak bentrok.

### ⚠️ H. Broadcast Queueing
Broadcast ke WA dilakukan secara batch atau melalui queue logic (`Broadcast` dan `BroadcastRecipient`). JANGAN merubah antrean tanpa jeda inter-message yang aman (delay 5-15 detik) untuk mencegah nomor terblokir spam oleh WhatsApp.

### ⚠️ I. PrismaClient Instantiation
Gunakan singleton untuk koneksi Prisma, atau integrasikan penggunaan ke 1 global instance agar tak kehabisan connection-pool. (Technical debt yang belum ter-refactor sempurna).

### ⚠️ J. JID & ChatName Normalization
Penyimpanan pesan ke dalam tabel `Message` **HARUS** menggunakan nomor telepon bersih (tanpa akhiran `@s.whatsapp.net`) untuk field `chatName`, `sender`, dan `receiver`. Hal ini memastikan pesan masuk dan pesan keluar dari satu nomor yang sama tergabung dalam satu thread percakapan (Chat Grouping) di UI Frontend.

### ⚠️ K. OneTalk API Payload & Fallback
Saat membalas menggunakan **OneTalk Webhook Custom Chatbot API**, payload tipe file harus dideklarasikan sebagai `type: "document"` (bukan `type: "file"`). Apabila pengiriman dokumen gagal, sistem harus memiliki *graceful fallback* (misalnya mengirimkan URL dokumen sebagai pesan teks).

### ⚠️ L. Path Resolving (Uploads)
Pastikan semua file hasil *generate* (seperti PDF Laporan) selalu di-resolve mutlak (absolute path) ke direktori `backend/uploads/` sehingga file dapat diakses publik melalui endpoint Express HTTP static server.

---

## 11. Known Issues & Technical Debt

1. **Multiple PrismaClient instances**: Terlalu banyak instance di route terpisah.
2. **Sync messages limitations**: Baileys tidak memiliki built-in method get-history yang real-time sinkron; perlu menunggu background proses history dari HP induk.
3. **Pagination & Caching**: List API yang besar (`/api/messages`, `/api/contacts`) memerlukan virtualized scroll/paginasi dan REDIS jika load-scale membesar.
4. **Chatbot Overload**: Logika fallback Auto-Reply menembak API Groq pada setiap inbound chat bagi pengguna di Whitelist. Rate limit LLM perlu dipantau.
