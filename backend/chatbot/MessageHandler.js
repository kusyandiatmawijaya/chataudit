// backend/chatbot/MessageHandler.js
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const http  = require('http');
const https = require('https');
// const { getAggregateVotesInPollMessage } = require('@whiskeysockets/baileys');
const { formatOutstandingAR } = require('../utils/formatter');

const { 
  pollCache, userState, STATE_WAITING_AR, STATE_FALLBACK_MENU, 
  STATE_WAITING_REGISTER_INFO, STATE_WAITING_OTP, registrationSessions,
  getUserState, setUserState, clearUserState, 
  getMemory, addToMemory, clearMemory,
  getRateLimitInfo,
} = require('./MemoryManager');

const { processWithLLM } = require('./AIResponder');
const ActionHandler = require('./ActionHandler');
const SopirWorkflow = require('./workflows/SopirWorkflow');
const SalesWorkflow = require('./workflows/SalesWorkflow');
const { getActiveWebUsers } = require('../utils/ioTracker');
const { getActiveUsers } = require('../utils/activeUserTracker');
const { handleReturFlow } = require('./ReturnBotHandler');

// Emoji number mapping for menu display
const EMOJI_NUMS = ['', '1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣'];

// ─────────────────────────────────────────────────
//  FALLBACK MENU CONFIGURATION PER GROUP
// ─────────────────────────────────────────────────

/**
 * Returns the fallback menu config for a given contact.
 * Each item has: { num, label, desc, available }
 * - available: true  → the backend can handle it in manual mode
 * - available: false → dummy item, responds with "dalam pengembangan"
 */
function getFallbackMenuConfig(contact) {
  const group = contact?.group || null;

  const ALL_MENUS = {
    'Customer': {
      title: 'Customer',
      items: [
        { num: 1, label: 'Profil Toko',                   desc: 'Informasi detail toko',              available: true  },
        { num: 2, label: 'Cek Outstanding AR',             desc: 'Lihat sisa piutang toko',            available: true  },
        { num: 3, label: 'Cek Riwayat Pelunasan Piutang', desc: 'Daftar pembayaran',                  available: false },
        { num: 4, label: 'Cek Riwayat Kiriman Barang',    desc: 'Status pengiriman barang',           available: false },
        { num: 5, label: 'Jadwal Kunjungan Sales',         desc: 'Jadwal kunjungan ke toko Anda',     available: false },
      ],
    },
    'Salesman': {
      title: 'Salesman',
      items: [
        { num: 1, label: 'Profil Salesman',                desc: 'Informasi profil Anda',              available: false },
        { num: 2, label: 'Cek Outstanding AR',             desc: 'Lihat piutang toko area Anda',      available: true  },
        { num: 3, label: 'Laporan Omset',                  desc: 'Ringkasan penjualan',                available: false },
        { num: 4, label: 'Jadwal Kunjungan Sales Besok',   desc: 'Rencana kunjungan besok',           available: false },
        { num: 5, label: 'Jadwal Kunjungan Sales Hari Ini',desc: 'Rencana kunjungan hari ini',        available: false },
      ],
    },
    'Sopir': {
      title: 'Sopir/Driver',
      items: [
        { num: 1, label: 'Penarikan Retur Barang', desc: 'Proses penarikan barang retur SPV Approved via Mini App', available: true },
        { num: 2, label: 'Cetak Struk Retur', desc: 'Cetak struk retur barang via Mini App', available: true },
      ],
    },
    'Supervisor Sales': {
      title: 'Supervisor Sales',
      items: [
        { num: 1, label: 'Rekap AR Tim Sales',       desc: 'Ringkasan piutang seluruh tim',           available: false },
        { num: 2, label: 'Target vs Realisasi',      desc: 'Perbandingan target & pencapaian',         available: false },
        { num: 3, label: 'Toko Bermasalah',          desc: 'Daftar toko dengan AR menunggak',          available: false },
        { num: 4, label: 'Jadwal Visit Tim',         desc: 'Jadwal kunjungan anggota tim',             available: false },
        { num: 5, label: 'Approval Retur Sales',     desc: 'Cek, edit, dan approve retur salesman via Mini App', available: true },
      ],
    },
    'Direktur/Owner': {
      title: 'Direktur/Owner',
      items: [
        { num: 1, label: 'Dashboard Ringkasan',      desc: 'Overview bisnis hari ini',                 available: false },
        { num: 2, label: 'Laporan Keuangan',         desc: 'Rekap keuangan periodik',                  available: false },
        { num: 3, label: 'Analisa Performa Sales',   desc: 'Performa tim penjualan',                   available: false },
      ],
    },
    'Asisten Sales Manager': {
      title: 'Asisten Sales Manager',
      items: [
        { num: 1, label: 'Rekap AR Semua Sales',     desc: 'Ringkasan piutang seluruh salesman',      available: false },
        { num: 2, label: 'Laporan Target Penjualan', desc: 'Progres target vs realisasi',              available: false },
        { num: 3, label: 'Analisa Toko Potensial',   desc: 'Data toko dengan potensi tinggi',          available: false },
      ],
    },
    'Kasir': {
      title: 'Kasir',
      items: [
        { num: 1, label: 'Konfirmasi Pembayaran',                            desc: 'Verifikasi pembayaran masuk',              available: false },
        { num: 2, label: 'Riwayat Transaksi',                                desc: 'Daftar transaksi hari ini',                available: false },
        { num: 3, label: 'Laporan Kas',                                      desc: 'Ringkasan posisi kas',                     available: false },
        { num: 4, label: 'Ringkasan Percakapan Barang Diterima/Tidak Terima Barang', desc: 'Rekap konfirmasi penerimaan barang', available: true  },
      ],
    },
    'Admin Sales/EDP': {
      title: 'Admin Sales/EDP',
      items: [
        { num: 1, label: 'Data Toko',                desc: 'Informasi master data toko',               available: false },
        { num: 2, label: 'Rekap Pesanan (SO)',        desc: 'Daftar sales order masuk',                available: false },
        { num: 3, label: 'Cek Piutang Toko',         desc: 'Status AR per toko',                      available: false },
      ],
    },
    'Kolektor': {
      title: 'Kolektor',
      items: [
        { num: 1, label: 'Daftar Tagihan Hari Ini',  desc: 'AR yang harus ditagih hari ini',          available: false },
        { num: 2, label: 'Konfirmasi Kunjungan',     desc: 'Catat hasil kunjungan penagihan',          available: false },
        { num: 3, label: 'Riwayat Penagihan',        desc: 'Histori penagihan sebelumnya',             available: false },
      ],
    },
    'IT': {
      title: 'IT',
      items: [
        { num: 1, label: 'Status Sistem',                                    desc: 'Cek status server, AI model & kesehatan sistem', available: true  },
        { num: 2, label: 'Panduan Reset Password',                           desc: 'Langkah reset password akun sistem',             available: true  },
        { num: 3, label: 'Cara Request Akses',                               desc: 'Prosedur pengajuan akses sistem baru',           available: true  },
        { num: 4, label: 'Hubungi Tim IT',                                   desc: 'Nomor & jalur eskalasi IT support',              available: true  },
        { num: 5, label: 'Panduan Teknis Lanjutan',                          desc: 'Dokumentasi & SOP teknis (dalam pengemb.)',      available: false },
        { num: 6, label: 'Ringkasan Percakapan Barang Diterima/Tidak Terima Barang', desc: 'Rekap konfirmasi penerimaan barang', available: true  },
      ],
    },
    'Accounting/Finance Staff': {
      title: 'Accounting/Finance Staff',
      items: [
        { num: 1, label: 'Rekap Pembayaran',         desc: 'Daftar pembayaran diterima',               available: false },
        { num: 2, label: 'Laporan AR',               desc: 'Outstanding piutang keseluruhan',          available: false },
        { num: 3, label: 'Invoice Jatuh Tempo',      desc: 'Faktur yang akan segera jatuh tempo',      available: false },
      ],
    },
    'Accounting/Finance Manager': {
      title: 'Accounting/Finance Manager',
      items: [
        { num: 1, label: 'Dashboard Keuangan',       desc: 'Overview posisi keuangan',                 available: false },
        { num: 2, label: 'Laporan Bulanan',          desc: 'Rekap keuangan bulan ini',                 available: false },
        { num: 3, label: 'Analisa Risiko Kredit',    desc: 'Toko berpotensi gagal bayar',              available: false },
      ],
    },
    'HRD': {
      title: 'HRD',
      items: [
        { num: 1, label: 'Data Karyawan',            desc: 'Informasi karyawan aktif',                 available: false },
        { num: 2, label: 'Jadwal & Absensi',         desc: 'Rekap kehadiran karyawan',                 available: false },
        { num: 3, label: 'Laporan HR',               desc: 'Ringkasan laporan SDM',                    available: false },
      ],
    },
    'Admin Gudang': {
      title: 'Admin Gudang',
      items: [
        { num: 1, label: 'Stok Barang',              desc: 'Informasi ketersediaan stok',              available: false },
        { num: 2, label: 'Jadwal Pengiriman',        desc: 'DO yang harus dikirim hari ini',           available: false },
        { num: 3, label: 'Riwayat Kiriman',          desc: 'Histori pengiriman barang',                available: false },
      ],
    },
    'Prinsiple': {
      title: 'Prinsiple',
      items: [
        { num: 1, label: 'Laporan Distribusi',       desc: 'Performa distribusi produk',               available: false },
        { num: 2, label: 'Performa Sales',           desc: 'Analisa tim penjualan',                    available: false },
        { num: 3, label: 'Coverage Area',            desc: 'Peta sebaran toko aktif',                  available: false },
      ],
    },
    'Driver/Kenek': {
      title: 'Driver/Kenek',
      items: [
        { num: 1, label: 'Jadwal Antar Hari Ini',    desc: 'Daftar DO yang harus diantar',             available: false },
        { num: 2, label: 'Konfirmasi Pengiriman',    desc: 'Catat status pengiriman',                  available: false },
        { num: 3, label: 'Rute Perjalanan',          desc: 'Urutan toko yang dikunjungi',              available: false },
      ],
    },
    'Checker/Helper Gudang': {
      title: 'Checker/Helper Gudang',
      items: [
        { num: 1, label: 'Cek DO Hari Ini',          desc: 'Delivery order yang perlu dicek',          available: false },
        { num: 2, label: 'Konfirmasi Barang',        desc: 'Konfirmasi kelengkapan barang',            available: false },
        { num: 3, label: 'Laporan Checker',          desc: 'Rekap hasil pengecekan hari ini',          available: false },
      ],
    },
  };

  // Default menu for contacts with no group or unrecognised group
  const defaultMenu = {
    title: null,
    items: [
      { num: 1, label: 'Cek Outstanding AR', desc: 'Lihat piutang toko', available: true },
      { num: 2, label: 'Keluar',             desc: 'Kembali ke mode AI', available: true },
    ],
  };

  return ALL_MENUS[group] || defaultMenu;
}

/**
 * Builds the fallback menu text string to be sent via WhatsApp.
 */
function buildFallbackMenuText(config, personaName) {
  const groupLabel = config.title ? `*${config.title}*` : 'Anda';
  const personaInfo = personaName ? ` via persona *${personaName}*` : '';

  let text = `⚠️ *Sistem AI sedang sibuk.* Pindah ke mode manual.\n\n`;
  text += `Berikut daftar menu ${groupLabel}${personaInfo}. Silahkan balas dengan mengetikkan angka sesuai menu yang Anda inginkan:\n\n`;

  for (const item of config.items) {
    const emoji = EMOJI_NUMS[item.num] || `${item.num}.`;
    text += `${emoji} *${item.label}* - ${item.desc}\n`;
  }

  return text.trim();
}

// ─────────────────────────────────────────────────
//  IT STATUS: Real-time system check
// ─────────────────────────────────────────────────

/**
 * Ping a URL via HTTP/HTTPS.
 * Resolves { ok: true, statusCode, ms } or { ok: false, error, ms }.
 */
function pingUrl(url, timeoutMs = 5000) {
  return new Promise((resolve) => {
    const start = Date.now();
    const lib   = url.startsWith('https') ? https : http;
    const req   = lib.get(url, { timeout: timeoutMs }, (res) => {
      res.resume(); // drain
      resolve({ ok: res.statusCode < 500, statusCode: res.statusCode, ms: Date.now() - start });
    });
    req.on('timeout', () => {
      req.destroy();
      resolve({ ok: false, error: 'timeout', ms: Date.now() - start });
    });
    req.on('error', (err) => {
      resolve({ ok: false, error: err.message, ms: Date.now() - start });
    });
  });
}

/** Format elapsed time as "X menit lalu" / "X jam lalu" / etc. */
function timeAgo(date) {
  if (!date) return null;
  const diffMs  = Date.now() - new Date(date).getTime();
  const diffSec = Math.floor(diffMs / 1000);
  if (diffSec < 60)  return `${diffSec} detik lalu`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60)  return `${diffMin} menit lalu`;
  const diffHr  = Math.floor(diffMin / 60);
  return `${diffHr} jam ${diffMin % 60} menit lalu`;
}

/**
 * Builds the live system-status text for IT menu item 2.
 * Checks: backend HTTP, frontend (nginx), AI model & rate-limit state.
 */
async function buildSystemStatusText() {
  const BACKEND_PORT  = process.env.PORT || 3013;
  const BACKEND_URL   = `http://localhost:${BACKEND_PORT}/`;
  const FRONTEND_URL  = 'http://localhost:80/';

  // Run all checks in parallel
  const [backendPing, frontendPing] = await Promise.all([
    pingUrl(BACKEND_URL),
    pingUrl(FRONTEND_URL),
  ]);

  // AI Model from DB
  let currentModel = 'Tidak diketahui';
  try {
    const modelSetting = await prisma.appSetting.findUnique({ where: { key: 'chatbot_model' } });
    if (modelSetting?.value) {
      currentModel = modelSetting.value;
    } else {
      const defaultModel = await prisma.appSetting.findUnique({ where: { key: 'default_ai_model' } });
      if (defaultModel?.value) currentModel = defaultModel.value;
    }
  } catch (_) { /* ignore */ }

  // Rate-limit info from in-memory tracker
  const { lastRateLimitAt, rateLimitCount, lastSuccessAt } = getRateLimitInfo();
  const now = Date.now();
  const msSinceRateLimit = lastRateLimitAt ? now - new Date(lastRateLimitAt).getTime() : null;

  // Determine AI status
  let aiStatus, aiEmoji;
  if (msSinceRateLimit !== null && msSinceRateLimit < 5 * 60 * 1000) {
    // Rate-limited in the last 5 minutes
    aiEmoji  = '🔴';
    aiStatus = `Rate Limit aktif (terakhir: ${timeAgo(lastRateLimitAt)})`;
  } else if (msSinceRateLimit !== null && msSinceRateLimit < 30 * 60 * 1000) {
    // Rate-limited 5–30 minutes ago — possibly recovering
    aiEmoji  = '🟡';
    aiStatus = `Memulihkan diri (rate limit terakhir: ${timeAgo(lastRateLimitAt)})`;
  } else if (lastSuccessAt) {
    aiEmoji  = '🟢';
    aiStatus = `Normal (respons sukses terakhir: ${timeAgo(lastSuccessAt)})`;
  } else {
    aiEmoji  = '⚪';
    aiStatus = 'Belum ada aktivitas sejak server start';
  }

  // ── Active users: JWT-based (works on all pages) ──────────
  const activeUsers = getActiveUsers(); // cleans up stale entries automatically
  let userSection;
  if (activeUsers.length === 0) {
    // Fallback to Socket.IO count if no JWT activity recorded yet
    const socketCount = getActiveWebUsers();
    if (socketCount && socketCount > 0) {
      userSection = `👤 *${socketCount}* koneksi aktif (Dashboard Socket.IO)`;
    } else {
      userSection = '⚪ Tidak ada user yang terdeteksi aktif saat ini';
    }
  } else {
    const roleIcon = (role) => {
      if (role === 'DEVELOPER')     return '🔧';
      if (role === 'ADMINISTRATOR') return '👑';
      return '👤';
    };
    const lines30min = activeUsers.map(u => {
      const diffMin = Math.round((Date.now() - u.lastSeen.getTime()) / 60000);
      const lastSeenStr = diffMin === 0 ? 'baru saja' : `${diffMin} mnt lalu`;
      return `${roleIcon(u.role)} *${u.username}* (${u.role}) — ${lastSeenStr}`;
    });
    userSection = `*${activeUsers.length} user aktif (30 mnt terakhir):*\n` + lines30min.join('\n');
  }

  const tsWIB = new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta', hour12: false });

  const lines = [
    `🖥️ *STATUS SISTEM APLIKASI*`,
    `📅 Diperiksa: ${tsWIB} WIB`,
    ``,
    `*1. Server Backend (API)*`,
    backendPing.ok
      ? `✅ Online — HTTP ${backendPing.statusCode} (${backendPing.ms}ms)`
      : `🔴 Offline / Tidak merespons (${backendPing.error || backendPing.statusCode})`,
    ``,
    `*2. Server Frontend (Nginx)*`,
    frontendPing.ok
      ? `✅ Online — HTTP ${frontendPing.statusCode} (${frontendPing.ms}ms)`
      : `🔴 Offline / Tidak merespons (${frontendPing.error || frontendPing.statusCode})`,
    ``,
    `*3. AI Model / LLM Engine*`,
    `${aiEmoji} ${aiStatus}`,
    `🤖 Model aktif: \`${currentModel}\``,
    rateLimitCount > 0
      ? `⚠️ Total rate limit sejak server start: ${rateLimitCount}x`
      : `✅ Tidak ada rate limit sejak server start`,
    ``,
    `*4. User Aktif di Aplikasi*`,
    userSection,
    ``,
    `💬 Ketik deskripsi masalah Anda atau ketik *menu* untuk kembali.`,
  ];

  return lines.join('\n');
}

/**
 * Generates the "Ringkasan Percakapan Barang Diterima/Tidak Terima Barang" report
 * and sends it directly to remoteJid via the provided clientAdapter (with caseId bound).
 * Mirrors the Enesis report pattern — self-contained, no dependency on scheduler's send logic.
 */
async function generateAndSendBarangReport(clientAdapter, remoteJid) {
  const BARANG_REPORT_ID = '14b88369-314e-4df1-b93a-299b357a38a4';
  const path = require('path');
  const fs   = require('fs');
  const { OpenAI } = require('openai');
  const { marked } = require('marked');
  const { getModelForRole } = require('../utils/Orchestrator');

  // 1. Load schedule config (prompt, period, sessionId)
  const schedule = await prisma.reportSchedule.findUnique({ where: { id: BARANG_REPORT_ID } });
  if (!schedule) throw new Error('Konfigurasi laporan tidak ditemukan.');

  // 2. Calculate date range (last_2_days)
  const endWib   = new Date(Date.now() + 7 * 3600 * 1000);
  const startWib = new Date(Date.now() + 7 * 3600 * 1000);
  startWib.setUTCDate(startWib.getUTCDate() - 2);
  startWib.setUTCHours(0, 0, 0, 0);
  const start = new Date(startWib.getTime() - 7 * 3600 * 1000);
  const end   = new Date(endWib.getTime()   - 7 * 3600 * 1000);

  // 3. Fetch messages for this session
  const messages = await prisma.message.findMany({
    where: { sessionId: schedule.sessionId, timestamp: { gte: start, lte: end }, isStatus: false },
    orderBy: { timestamp: 'asc' }
  });

  if (messages.length === 0) {
    await clientAdapter.sendMessage(remoteJid, '📭 Tidak ada percakapan yang ditemukan dalam 2 hari terakhir.');
    return;
  }

  // 4. Build transcript
  const transcript = messages.map(m => {
    const person = m.isFromMe ? 'Me' : (m.authorName || m.sender);
    return `${person} [${m.timestamp.toISOString()}]: ${m.messageBody || '[Media]'}`;
  }).join('\n');

  // 5. Call AI
  const openai = new OpenAI({ baseURL: 'https://openrouter.ai/api/v1', apiKey: process.env.OPENROUTER_API_KEY });
  const selectedModel = await getModelForRole('ANALYTICAL');
  const promptText = `Instruction: ${schedule.prompt}\n\nHere is the chat transcript:\n${transcript}`;

  const chatCompletion = await openai.chat.completions.create({
    messages: [{ role: 'user', content: promptText }],
    model: selectedModel,
  });

  let reportContent = chatCompletion.choices[0]?.message?.content || 'Tidak ada konten yang dihasilkan.';

  // 6. Prepend timestamp
  const now = new Date();
  const dateStr = now.toLocaleDateString('id-ID', { timeZone: 'Asia/Jakarta', year: 'numeric', month: 'long', day: 'numeric' });
  const timeStr = now.toLocaleTimeString('id-ID', { timeZone: 'Asia/Jakarta', hour: '2-digit', minute: '2-digit' });
  reportContent = `*Laporan Dihasilkan Pada: ${dateStr} pukul ${timeStr}*\n\n---\n\n` + reportContent;

  // 7. Generate PDF
  const puppeteer = require('puppeteer');
  const UPLOADS_DIR = path.join(__dirname, '..', 'uploads');
  if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });

  const filename  = `BarangDiterima_${Date.now()}.pdf`;
  const filepath  = path.join(UPLOADS_DIR, filename);
  const htmlContent = marked.parse(reportContent);
  // NOTE: Tidak ada external resource (Google Fonts dll) agar tidak timeout di networkidle0
  const fullHtml = `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>
    body { font-family: Helvetica, Arial, sans-serif; color: #333; line-height: 1.6; margin: 40px; font-size: 13px; }
    h1,h2,h3 { color: #1a1a2e; margin-top: 20px; }
    table { border-collapse: collapse; width: 100%; margin-bottom: 16px; }
    td,th { border: 1px solid #ddd; padding: 8px; text-align: left; font-size: 12px; }
    th { background: #f4f4f4; font-weight: 600; }
    p { margin: 8px 0; }
    ul,ol { padding-left: 20px; }
    strong { font-weight: 700; }
  </style></head><body>${htmlContent}</body></html>`;

  const browser = await puppeteer.launch({ args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  const page    = await browser.newPage();
  await page.setContent(fullHtml, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.pdf({ path: filepath, format: 'A4', printBackground: true, margin: { top: '20px', right: '20px', bottom: '20px', left: '20px' } });
  await browser.close();

  // 8. Send PDF directly to the requesting client via their caseId
  const caption = `📊 Ringkasan Percakapan Barang Diterima/Tidak Terima Barang — Periode 2 Hari Terakhir.`;
  await clientAdapter.sendDocument(remoteJid, filepath, filename, caption, 'application/pdf');
  console.log(`[BarangReport] PDF sent to ${remoteJid}`);
}

/**
 * Executes the actual backend action for an available fallback menu item.
 */
async function executeFallbackAction(clientAdapter, remoteJid, contact, itemNum) {
  const group = contact?.group || null;

  // ── Customer ──────────────────────────────────────────────
  if (group === 'Customer') {
    const targetKode = contact.kodeCustomer
      ? contact.kodeCustomer.split(',')[0].replace(/['"]/g, '').trim()
      : '';

    if (itemNum === 1) {
      // Profil Toko
      if (!targetKode) {
        await clientAdapter.sendMessage(remoteJid, 'Data toko tidak ditemukan pada kontak Anda.');
        return;
      }
      await clientAdapter.sendMessage(remoteJid, 'Sedang mengambil data profil toko Anda... ⏳');
      const profileStr = await ActionHandler.executeGetStoreProfile(targetKode);
      try {
        const profileData = JSON.parse(profileStr);
        if (profileData.found) {
          await clientAdapter.sendMessage(remoteJid, `*PROFIL TOKO*\n\n🏢 *Kode Toko:* ${profileData.Kode_Toko}\n🏪 *Nama Toko:* ${profileData.Nama_Toko}`,);
        } else {
          await clientAdapter.sendMessage(remoteJid, 'Data toko tidak ditemukan pada database.');
        }
      } catch (e) {
        await clientAdapter.sendMessage(remoteJid, 'Terjadi kesalahan saat memproses data profil toko.');
      }
      return;
    }

    if (itemNum === 2) {
      // Cek Outstanding AR
      if (!targetKode) {
        await clientAdapter.sendMessage(remoteJid, 'Data toko tidak ditemukan pada kontak Anda.');
        return;
      }
      await clientAdapter.sendMessage(remoteJid, 'Sedang mengambil data piutang untuk toko Anda... ⏳');
      const arData = await ActionHandler.executeGetOutstandingAr(targetKode);
      await clientAdapter.sendMessage(remoteJid, formatOutstandingAR(arData));
      return;
    }
  }

  // ── Salesman ───────────────────────────────────────────────
  if (group === 'Salesman') {
    if (itemNum === 2) {
      // Cek Outstanding AR by Salesman
      const targetKode = contact.kodeSales
        ? contact.kodeSales.split(',')[0].replace(/['"]/g, '').trim()
        : '';
      if (!targetKode) {
        await clientAdapter.sendMessage(remoteJid, 'Kode sales tidak ditemukan pada kontak Anda.');
        return;
      }
      await clientAdapter.sendMessage(remoteJid, `Sedang mengambil data piutang untuk area Anda (${targetKode})... ⏳`);
      const arDataStr = await ActionHandler.executeGetOutstandingArBySalesman(targetKode, 10);
      let messageToSend = 'Tidak ada data piutang untuk area Anda.';
      try {
          const parsed = JSON.parse(arDataStr);
          if (parsed.Data_Ditemukan) {
              messageToSend = `📊 *LAPORAN PIUTANG AREA*\n\n👤 *Sales:* ${parsed.Nama_Sales}\n`;
              const ringkasan = parsed.Ringkasan_Seluruh_Piutang_Salesman;
              if (ringkasan) {
                  messageToSend += `*Total Faktur:* ${ringkasan.Total_Semua_Faktur}\n*Total Tagihan:* Rp ${Number(ringkasan.Total_Nominal_Tagihan).toLocaleString('id-ID')}\n*Sisa Saldo:* Rp ${Number(ringkasan.Total_Sisa_Saldo).toLocaleString('id-ID')}\n\n`;
              }
              if (parsed.Daftar_Toko && parsed.Daftar_Toko.length > 0) {
                  messageToSend += `🏢 *Top ${parsed.Menampilkan_Jumlah_Toko} Toko (Sisa Tagihan Terbesar):*\n`;
                  parsed.Daftar_Toko.forEach((toko, idx) => {
                      messageToSend += `\n${idx + 1}. *${toko.Nama_Toko}* (${toko.Kode_Toko})\n   Faktur: ${toko.Total_Faktur}\n   Tagihan: Rp ${Number(toko.Total_Tagihan_Toko).toLocaleString('id-ID')}\n   Sisa: Rp ${Number(toko.Sisa_Tagihan_Toko).toLocaleString('id-ID')}\n`;
                      if (toko.Jatuh_Tempo_Terdekat) messageToSend += `   Jatuh Tempo Terdekat: ${toko.Jatuh_Tempo_Terdekat}\n`;
                  });
              }
          } else {
              messageToSend = parsed.message || parsed.error || messageToSend;
          }
      } catch (e) {
          messageToSend = arDataStr || messageToSend;
      }
      await clientAdapter.sendMessage(remoteJid, messageToSend);
      return;
    }
  }

  // ── Supervisor Sales ───────────────────────────────────────
  if (group === 'Supervisor Sales' || (group && (group.toUpperCase().includes('SUPERVISOR') || group.toUpperCase().includes('SPV')))) {
    if (itemNum === 5) {
      const { getTelegramBot } = require('../telegram');
      const bot = getTelegramBot(clientAdapter.sessionId);
      const miniAppUrl = `${process.env.MINI_APP_URL || 'https://auditwa.padmasaripangan.co.id/api/twa'}?mode=list_today&sessionId=${encodeURIComponent(clientAdapter.sessionId)}`;
      
      const spvMsg = `📋 *APPROVAL & CEK RETUR SALESMAN*\n\nSilakan klik tombol di bawah ini untuk membuka halaman verifikasi dan approval retur:\n• Cek inputan retur dari salesman\n• Edit jumlah barang jika ada ketidaksesuaian\n• Setujui (Approve) atau Tolak (Reject) retur`;
      
      if (bot) {
        await bot.sendMessage(remoteJid, spvMsg, {
          reply_markup: {
            inline_keyboard: [
              [{ text: '📋 Buka Approval Retur Sales', web_app: { url: miniAppUrl } }]
            ]
          }
        });
      } else {
        await clientAdapter.sendMessage(remoteJid, `${spvMsg}\n\n👉 Buka tautan: ${miniAppUrl}`);
      }
      return;
    }
  }

  // ── Sopir / Driver ─────────────────────────────────────────
  if (group === 'Sopir' || (group && (group.toUpperCase().includes('SOPIR') || group.toUpperCase().includes('DRIVER')))) {
    if (itemNum === 1 || itemNum === 2) {
      const { getTelegramBot } = require('../telegram');
      const bot = getTelegramBot(clientAdapter.sessionId);
      const miniAppUrl = `${process.env.MINI_APP_URL || 'https://auditwa.padmasaripangan.co.id/api/twa'}?mode=list_today&sessionId=${encodeURIComponent(clientAdapter.sessionId)}`;
      
      const driverMsg = `🚚 *PENARIKAN & CETAK RETUR (DRIVER/KENEK)*\n\nSilakan klik tombol di bawah untuk membuka daftar retur yang sudah disetujui oleh Supervisor Sales:\n• Tarik barang retur fisik di toko\n• Sesuaikan jumlah barang jika berbeda\n• Cetak struk retur (All, Good, Bad)`;
      
      if (bot) {
        await bot.sendMessage(remoteJid, driverMsg, {
          reply_markup: {
            inline_keyboard: [
              [{ text: '🚚 Buka Penarikan & Cetak Retur', web_app: { url: miniAppUrl } }]
            ]
          }
        });
      } else {
        await clientAdapter.sendMessage(remoteJid, `${driverMsg}\n\n👉 Buka tautan: ${miniAppUrl}`);
      }
      return;
    }
  }

  // ── Kasir ──────────────────────────────────────────────────
  if (group === 'Kasir') {
    if (itemNum === 4) {
      await clientAdapter.sendMessage(remoteJid, '⏳ Sedang memproses Ringkasan Percakapan Barang Diterima/Tidak Terima Barang... Mohon tunggu.');
      try {
        await generateAndSendBarangReport(clientAdapter, remoteJid);
      } catch (err) {
        console.error('[MenuHandler] Error running barang report (Kasir):', err);
        await clientAdapter.sendMessage(remoteJid, '❌ Terjadi kesalahan saat memproses laporan. Silakan coba lagi.');
      }
      return;
    }
  }

  // ── IT ───────────────────────────────────────────────────────
  if (group === 'IT') {
    if (itemNum === 1) {
      // Status Sistem — real-time check
      await clientAdapter.sendMessage(remoteJid, '🔍 Sedang memeriksa status sistem... ⏳');
      const statusText = await buildSystemStatusText();
      await clientAdapter.sendMessage(remoteJid, statusText);
      return;
    }
    if (itemNum === 2) {
      // Panduan Reset Password
      await clientAdapter.sendMessage(remoteJid, `🔐 *PANDUAN RESET PASSWORD SISTEM*

Berikut langkah-langkah reset password akun sistem internal:

*1. Reset Password Aplikasi Web (Audit WA/Dashboard)*
🔹 Hubungi Admin IT atau Superadmin
🔹 Berikan username akun Anda
🔹 Admin akan melakukan reset via panel Administrator
🔹 Password baru akan dikirimkan melalui jalur aman

*2. Reset Password Windows/PC*
🔹 Hubungi IT Support langsung atau via WA ini
🔹 Siapkan: Nama, Jabatan, No. PC/Laptop
🔹 IT Support akan remote atau datang langsung

*3. Reset Password Email Perusahaan*
🔹 Hubungi IT Support dengan menyertakan NIK dan nama lengkap

⚠️ Jangan pernah membagikan password kepada siapapun, termasuk tim IT.

💬 Ketik pertanyaan teknis Anda atau ketik *menu* untuk kembali ke daftar menu.`,);
      return;
    }
    if (itemNum === 3) {
      // Cara Request Akses
      await clientAdapter.sendMessage(remoteJid, `📋 *PROSEDUR REQUEST AKSES SISTEM*

Untuk mengajukan akses ke sistem internal, ikuti langkah berikut:

*Step 1 — Siapkan Informasi*
🔹 Nama Lengkap & NIK
🔹 Jabatan & Divisi
🔹 Sistem/Aplikasi yang dibutuhkan aksesnya
🔹 Level akses yang dibutuhkan (hanya baca / edit / admin)
🔹 Alasan kebutuhan akses

*Step 2 — Persetujuan Atasan*
🔹 Dapatkan persetujuan dari Supervisor/Manager langsung Anda
🔹 Lampirkan bukti persetujuan (pesan WA/email) saat mengajukan

*Step 3 — Ajukan ke IT*
🔹 Kirim informasi di atas ke tim IT melalui chat ini
🔹 Atau email ke: it-support@padmasaripangan.co.id
🔹 Estimasi proses: 1-2 hari kerja

💬 Ketik pertanyaan Anda atau ketik *menu* untuk kembali.`,);
      return;
    }
    if (itemNum === 4) {
      // Hubungi Tim IT
      await clientAdapter.sendMessage(remoteJid, `📞 *KONTAK & ESKALASI IT SUPPORT*

*Jalur Pertama — IT Support Harian*
💬 Chat WA ini (KITA Assistant)
⏰ Jam kerja: Senin-Jumat, 08.00-17.00 WIB

*Jalur Kedua — Eskalasi Langsung*
📱 Hubungi IT Support via WA/telepon internal
🏢 Kunjungi ruangan IT (lantai/gedung IT)

*Jalur Ketiga — Tiket IT (Urgent/Kritis)*
📧 it-support@padmasaripangan.co.id
📌 Subject: [URGENT] Deskripsi singkat masalah

⚠️ *Untuk gangguan kritis* (sistem down, data hilang, keamanan) — hubungi langsung via telepon, jangan hanya via chat.

💬 Ketik masalah Anda atau ketik *menu* untuk kembali.`,);
      return;
    }
    if (itemNum === 6) {
      await clientAdapter.sendMessage(remoteJid, '⏳ Sedang memproses Ringkasan Percakapan Barang Diterima/Tidak Terima Barang... Mohon tunggu.');
      try {
        await generateAndSendBarangReport(clientAdapter, remoteJid);
      } catch (err) {
        console.error('[MenuHandler] Error running barang report (IT):', err);
        await clientAdapter.sendMessage(remoteJid, '❌ Terjadi kesalahan saat memproses laporan. Silakan coba lagi.');
      }
      return;
    }
  }

  // ── Default (no group) — menu item 1 is Cek Outstanding AR ─
  if (!group) {
    if (itemNum === 1) {
      if (contact && contact.kodeCustomer) {
        const targetKode = contact.kodeCustomer.split(',')[0].replace(/['"]/g, '').trim();
        await clientAdapter.sendMessage(remoteJid, 'Sedang mengambil data piutang untuk toko Anda... ⏳');
        const arData = await ActionHandler.executeGetOutstandingAr(targetKode);
        await clientAdapter.sendMessage(remoteJid, formatOutstandingAR(arData));
      } else {
        setUserState(remoteJid, STATE_WAITING_AR);
        await clientAdapter.sendMessage(remoteJid, 'Silakan ketik KODE TOKO (contoh: 0761):');
      }
      return;
    }
    if (itemNum === 2) {
      await clientAdapter.sendMessage(remoteJid, 'Telah keluar dari mode manual. Anda kembali terhubung dengan AI.');
      return;
    }
  }

  // Fallback — action exists but not yet handled (shouldn't normally reach here)
  await clientAdapter.sendMessage(remoteJid, '⚙️ Fitur ini belum tersedia di mode manual. Silakan coba lagi saat AI sudah aktif.');
}

// ─────────────────────────────────────────────────
//  UTILITY FUNCTIONS
// ─────────────────────────────────────────────────

function normalizePhoneNumber(phone) {
  if (!phone) return '';
  let num = phone.toString().split('@')[0];
  num = num.replace(/[\s\-\+]/g, '');
  num = num.split(':')[0];
  if (num.startsWith('0')) {
    num = '62' + num.substring(1);
  }
  return num;
}

async function isChatbotEnabled(sessionId) {
  try {
    const setting = await prisma.appSetting.findUnique({
      where: { key: 'chatbot_enabled_sessions' },
    });
    if (!setting || !setting.value) return false;
    const enabledSessions = JSON.parse(setting.value);
    return Array.isArray(enabledSessions) && enabledSessions.includes(sessionId);
  } catch (error) {
    console.error('[Chatbot] Error checking if chatbot is enabled:', error);
    return false;
  }
}

async function isNumberAllowed(sessionId, senderNumber, pushName) {
  try {
    const modeSetting = await prisma.appSetting.findUnique({
      where: { key: 'chatbot_whitelist_mode' },
    });
    const mode = modeSetting?.value || 'all';
    if (mode === 'all') return true;

    const normalizedSender = normalizePhoneNumber(senderNumber);
    const whitelistEntries = await prisma.chatbotWhitelist.findMany({
      where: { isActive: true },
    });

    let isWhitelisted = false;
    let matchType = 'none';

    const allowedContact = await prisma.contact.findFirst({
      where: {
        OR: [
          { whatsappId: senderNumber },
          { whatsappId: senderNumber + '@s.whatsapp.net' },
          { telegramId: senderNumber },
          { phoneNumber: normalizedSender },
          { realPhoneNumber: normalizedSender }
        ],
        isAllowed: true
      }
    });

    if (allowedContact) {
      isWhitelisted = true;
      matchType = 'contact_allowed';
    }

    if (!isWhitelisted) {
      isWhitelisted = whitelistEntries.some((entry) => {
        const normalizedEntry = normalizePhoneNumber(entry.phoneNumber);
        return normalizedSender === normalizedEntry;
      });
      if (isWhitelisted) matchType = 'phone';
    }

    if (!isWhitelisted && pushName) {
      isWhitelisted = whitelistEntries.some((entry) => {
        return entry.name && entry.name.toLowerCase().trim() === pushName.toLowerCase().trim();
      });
      if (isWhitelisted) matchType = 'name';
    }

    console.log(`[Chatbot] Whitelist check: sender=${senderNumber} name="${pushName}" whitelisted=${isWhitelisted} (matched by ${matchType})`);
    return isWhitelisted;
  } catch (error) {
    console.error('[Chatbot] Error checking whitelist:', error);
    return false;
  }
}

async function sendMainMenu(clientAdapter, remoteJid, contact) {
  try {
    let menuText = `Okay! Starting fresh. 😊\nSilakan pilih menu di bawah ini:\n\n1️⃣ *Cek Outstanding AR* - Lihat piutang toko\n2️⃣ *Analisa Credit Limit* - Cek kapasitas order toko\n3️⃣ *Lihat Semua Toko* - Daftar seluruh toko pelanggan\n4️⃣ *Cari Toko* - Cari kode/nama toko\n5️⃣ *Help* - Bantuan penggunaan sistem\n\nSilakan ketik nomor menu (1-5) atau langsung ketik nama/kode toko jika sudah tahu. Contoh: 1, 0977, TOKO MAKMUR, atau Cari toko.`;

    if (contact && contact.group) {
      // Generate menu dynamically from getFallbackMenuConfig for all groups
      const config = getFallbackMenuConfig(contact);
      if (config) {
        menuText = `Berikut daftar menu *${config.title}*. Silahkan balas dengan mengetikkan angka sesuai menu yang Anda inginkan:\n\n`;
        for (const item of config.items) {
          const emoji = EMOJI_NUMS[item.num] || `${item.num}.`;
          menuText += `${emoji} *${item.label}* - ${item.desc}\n`;
        }
      }
    }

    const { getTelegramBot } = require('../telegram');
    const bot = getTelegramBot(clientAdapter.sessionId);
    const miniAppUrl = `${process.env.MINI_APP_URL || 'https://auditwa.padmasaripangan.co.id/api/twa'}?mode=list_today&sessionId=${encodeURIComponent(clientAdapter.sessionId)}`;

    if (bot && contact?.group && (contact.group.toUpperCase().includes('SOPIR') || contact.group.toUpperCase().includes('DRIVER'))) {
      menuText = `Berikut daftar menu *Sopir/Driver*. Silakan pilih menu di bawah ini:`;
      const inlineMenu = [
         [{ text: '👤 Lihat Profil', callback_data: 'MAIN_PROFILE' }],
         [{ text: '🚚 Penarikan & Cetak Retur', web_app: { url: miniAppUrl } }],
         [{ text: '🖨️ Cetak Struk', callback_data: 'MAIN_CETAK' }, { text: '🔄 Reprint Struk', callback_data: 'MAIN_REPRINT' }],
         [{ text: '🤖 Ke PadmaSariPangan Bot', url: 'https://t.me/padmasaripangan_bot' }]
      ];
      
      // Remove persistent reply keyboard (bottom of screen)
      await bot.sendMessage(remoteJid, 'Menampilkan Menu Utama...', { 
        reply_markup: { 
          remove_keyboard: true
        } 
      });
      // Send the actual inline menu
      await bot.sendMessage(remoteJid, menuText, { reply_markup: { inline_keyboard: inlineMenu } });
    } else if (bot && contact?.group && contact.group.toUpperCase().includes('GUDANG')) {
      menuText = `Berikut daftar menu *Gudang*. Silakan pilih menu di bawah ini:`;
      const inlineMenu = [
         [{ text: '👤 Lihat Profil', callback_data: 'MAIN_PROFILE' }],
         [{ text: '✏️ Edit Retur', web_app: { url: miniAppUrl } }],
         [{ text: '🖨️ Cetak Struk', callback_data: 'MAIN_CETAK' }, { text: '🔄 Reprint Struk', callback_data: 'MAIN_REPRINT' }],
         [{ text: '🤖 Ke PadmaSariPangan Bot', url: 'https://t.me/padmasaripangan_bot' }]
      ];
      
      await bot.sendMessage(remoteJid, 'Menampilkan Menu Utama...', { 
        reply_markup: { remove_keyboard: true } 
      });
      await bot.sendMessage(remoteJid, menuText, { reply_markup: { inline_keyboard: inlineMenu } });
    } else if (bot && contact?.group && (contact.group.toUpperCase().includes('SUPERVISOR') || contact.group.toUpperCase().includes('SPV'))) {
      menuText = `Berikut daftar menu *Supervisor Sales*. Silakan pilih menu di bawah ini:`;
      const inlineMenu = [
         [{ text: '👤 Lihat Profil', callback_data: 'MAIN_PROFILE' }],
         [{ text: '📋 Approval Retur Sales', web_app: { url: miniAppUrl } }],
         [{ text: '🤖 Ke PadmaSariPangan Bot', url: 'https://t.me/padmasaripangan_bot' }]
      ];
      
      await bot.sendMessage(remoteJid, 'Menampilkan Menu Utama...', { 
        reply_markup: { remove_keyboard: true } 
      });
      await bot.sendMessage(remoteJid, menuText, { reply_markup: { inline_keyboard: inlineMenu } });
    } else if (bot) {
      // Remove persistent reply keyboard (bottom of screen)
      await bot.sendMessage(remoteJid, 'Menampilkan Menu Utama...', { 
        reply_markup: { 
          remove_keyboard: true
        } 
      });
      
      let inlineMenu = [
        [{ text: '👤 Lihat Profil', callback_data: 'MAIN_PROFILE' }]
      ];
      if (contact?.group === 'Salesman') {
        inlineMenu.push([{ text: '📝 Input Detail Retur', web_app: { url: miniAppUrl } }]);
      } else if (contact?.group && (contact.group.toUpperCase().includes('SUPERVISOR') || contact.group.toUpperCase().includes('SPV'))) {
        inlineMenu.push([{ text: '📋 Approval Retur Sales', web_app: { url: miniAppUrl } }]);
      }
      inlineMenu.push([{ text: '🤖 Ke PadmaSariPangan Bot', url: 'https://t.me/padmasaripangan_bot' }]);

      // Send the text menu
      await bot.sendMessage(remoteJid, menuText.trim(), {
        reply_markup: {
          inline_keyboard: inlineMenu
        }
      });
    } else {
      await clientAdapter.sendMessage(remoteJid, menuText.trim());
    }
    console.log(`[Chatbot] Main menu text sent to ${remoteJid}`);
  } catch (error) {
    console.error('[Chatbot] Error sending main menu text:', error);
  }
}

// ─────────────────────────────────────────────────
//  MAIN MESSAGE HANDLER
// ─────────────────────────────────────────────────

async function handleIncomingMessage(normalizedMsg, sessionId, clientAdapter, options = {}) {
  const { botType = 'MAIN' } = options;
  try {
    if (!normalizedMsg) return; // Adapter rejected or ignored the message
    
    // Unpack normalized message
    const { platform, senderId, senderNumber, senderName, text, phoneNumber, messageId, rawMessage } = normalizedMsg;
    
    let textMessage = text || '';
    const remoteJid = senderId; // Kept for variable compatibility downwards
    
    // For WhatsApp Poll updates (Disabled for TapTalk integration as payload differs)
    /*
    if (platform === 'whatsapp' && rawMessage.message?.pollUpdateMessage) {
      const pollCreationMessageKey = rawMessage.message.pollUpdateMessage.pollCreationMessageKey;
      const originalMsg = pollCache.get(pollCreationMessageKey.id);
      if (originalMsg) {
        const pollVotes = getAggregateVotesInPollMessage({ message: rawMessage, pollCreationMessage: originalMsg.message });
        const selectedOptions = pollVotes.filter(v => v.voters.length > 0);
        if (selectedOptions.length > 0) {
          textMessage = selectedOptions[0].name;
          console.log(`[Chatbot] Decoded poll vote: ${textMessage}`);
        } else {
          return;
        }
      } else {
        console.log('[Chatbot] Poll update received but original message not in cache.');
        return;
      }
    }
    */
    
    if (textMessage === 'share_contact') {
      textMessage = `register ${senderName}, ${phoneNumber},`;
    }

    if (!textMessage || textMessage.trim().length === 0) return;

    const isEnabled = await isChatbotEnabled(sessionId);
    if (!isEnabled) {
      console.log(`[Chatbot] Session ${sessionId} is NOT enabled, skipping all AI functions.`);
      return;
    }

    // Map Reply Keyboard texts to commands
    if (textMessage === '📦 Buat Retur Baru' || textMessage === '📦 Menu Retur (Sopir)') textMessage = '/retur';
    else if (textMessage === '🖨️ Cetak Struk') textMessage = '/cetak';
    else if (textMessage === '🔄 Reprint Struk') textMessage = '/reprint';
    else if (textMessage === '☰ Menu Utama') textMessage = '/menu';

    let lowerText = textMessage.toLowerCase().trim();
    let currentState = getUserState(remoteJid);

    // Map specific callbacks back to text menu inputs for legacy handlers
    if (lowerText === 'callback:main_jadwal_kirim') {
        textMessage = '1';
        lowerText = '1';
    } else if (lowerText === 'callback:main_update_kirim') {
        textMessage = '2';
        lowerText = '2';
    }

    if (lowerText === '/start' || lowerText === '/menu' || lowerText === 'menu' || lowerText === 'batal') {
        clearUserState(remoteJid);
        currentState = null;
    }

    // -- Handle Fallback Retur Sopir --
    if (lowerText === '/retur' || lowerText === 'retur' || lowerText === '/cetak' || lowerText === 'cetak' || lowerText === '/reprint' || lowerText === 'reprint' || lowerText.startsWith('callback:') || (currentState && currentState.startsWith('RETUR_'))) {
       const isReturHandled = await handleReturFlow(normalizedMsg, sessionId, clientAdapter);
       if (isReturHandled) return;
    }

    if (lowerText === '/start') {
      lowerText = 'register';
      textMessage = 'register';
    }
    const pushName = senderName || '';

    // (Clear logic moved below contact fetching)

    const isAllowed = await isNumberAllowed(sessionId, senderNumber, pushName);
    currentState = getUserState(remoteJid); // Re-fetch in case changed
    if (lowerText.startsWith('register ') || lowerText.startsWith('daftar ')) {
      currentState = STATE_WAITING_REGISTER_INFO;
      textMessage = textMessage.substring(textMessage.indexOf(' ') + 1);
    }
    const isRegistering = lowerText.startsWith('register') || lowerText.startsWith('daftar') || 
                          currentState === STATE_WAITING_REGISTER_INFO || 
                          currentState === STATE_WAITING_OTP;

    if (!isAllowed && !isRegistering) {
      console.log(`[Chatbot] Number ${senderNumber} (Name: ${pushName}) is NOT in whitelist, skipping.`);
      return;
    }

    // Fetch contact — include persona for persona-aware fallback messages
    const pureSenderNumber = normalizePhoneNumber(senderNumber);
    let contact = await prisma.contact.findFirst({
      where: {
        OR: [
          { whatsappId: remoteJid }, 
          { whatsappId: senderNumber + '@s.whatsapp.net' }, 
          { telegramId: senderId }, 
          { phoneNumber: pureSenderNumber },
          { phoneNumber: phoneNumber },
          { realPhoneNumber: pureSenderNumber }
        ],
        group: { not: null }
      },
      include: { persona: true }
    });

    if (!contact) {
      contact = await prisma.contact.findFirst({
        where: {
          OR: [
            { whatsappId: remoteJid }, 
            { whatsappId: senderNumber + '@s.whatsapp.net' }, 
            { telegramId: senderId }, 
            { phoneNumber: senderNumber },
            { phoneNumber: phoneNumber },
            { realPhoneNumber: senderNumber }
          ]
        },
        include: { persona: true }
      });
    }

    // Allow users to clear their conversation history
    if (lowerText === 'clear' || lowerText === 'reset' || lowerText === 'restart') {
      const { clearMemory } = require('./MemoryManager');
      clearMemory(remoteJid);
      
      if (contact) {
        try {
          await prisma.cart.deleteMany({ where: { contactId: contact.id } });
        } catch (err) {
          console.error('[MessageHandler] Failed to clear cart:', err);
        }
      }
      
      await clientAdapter.sendMessage(remoteJid, "Sesi percakapan Anda telah di-reset. Ingatan AI dan keranjang belanja Anda telah dihapus.");
      return;
    }

    if (botType === 'SOPIR') {
      if (!contact) contact = { group: 'Sopir', name: pushName };
      else if (!contact.group) contact.group = 'Sopir';
    } else if (botType === 'SALESMAN') {
      if (!contact) contact = { group: 'Salesman', name: pushName };
      else if (!contact.group) contact.group = 'Salesman';
    }

    if (lowerText === 'callback:main_profile' || lowerText === '/profile' || lowerText === 'profil') {
        let profileMsg = `👤 *PROFIL ANDA*\n\n`;
        if (contact) {
            profileMsg += `*Nama:* ${contact.name || '-'}\n`;
            profileMsg += `*Jabatan/Grup:* ${contact.group || '-'}\n`;
            profileMsg += `*No. HP:* ${contact.realPhoneNumber || contact.phoneNumber || '-'}\n`;
            if (contact.kodeCustomer) profileMsg += `*Kode Customer:* ${contact.kodeCustomer}\n`;
            if (contact.kodeSales) profileMsg += `*Kode Sales:* ${contact.kodeSales}\n`;
        } else {
            profileMsg += `Data kontak belum terdaftar sepenuhnya.`;
        }
        await clientAdapter.sendMessage(remoteJid, profileMsg);
        return;
    }

    // ── Global commands ────────────────────────────────────────
    if (lowerText === 'reset' || lowerText === 'mulai baru' || lowerText === '/reset') {
      clearMemory(remoteJid);
      clearUserState(remoteJid);
      await clientAdapter.sendMessage(remoteJid, "🔄 *Percakapan telah di-reset.*\n\nKonteks sebelumnya telah dihapus. Silakan ketik *menu* untuk melihat opsi yang tersedia.");
      return;
    }

    if (lowerText === 'menu' || lowerText === '/menu' || lowerText === 'bantuan' || lowerText === '/help' || lowerText === 'help') {
      clearMemory(remoteJid);
      clearUserState(remoteJid);
      await sendMainMenu(clientAdapter, remoteJid, contact);
      return;
    }

    if (lowerText === 'register' || lowerText === 'daftar') {
      if (contact && contact.realPhoneNumber) {
        await clientAdapter.sendMessage(remoteJid, "Anda sudah terdaftar. Proses pendaftaran dilewati.");
        await sendMainMenu(clientAdapter, remoteJid, contact);
      } else {
        setUserState(remoteJid, STATE_WAITING_REGISTER_INFO);
        if (platform === 'telegram') {
            await clientAdapter.requestContact(remoteJid, "Silakan klik tombol *Kirim Kontak* di bawah ini untuk membagikan nomor Anda, lalu balas dengan format:\n*Nama Anda, Kode* (jika ada)\nContoh: Budi, CUST01");
        } else {
            await clientAdapter.requestContact(remoteJid, "Silakan masukkan data pendaftaran Anda dengan format:\n\n*Nama, NomorHP, Kode*\n\nContoh jika ada kode: Budi, 08123456789, CUST01\nContoh jika tidak ada kode: Budi, 08123456789,");
        }
      }
      return;
    }

    // ── STATE: Waiting for AR store code ─────────────────────
    if (currentState === STATE_WAITING_AR) {
      clearUserState(remoteJid);
      let kodeToko = textMessage.trim();
      if (contact && contact.group === 'Customer' && contact.kodeCustomer) {
        kodeToko = contact.kodeCustomer.split(',')[0].replace(/['"]/g, '').trim();
      }
      await clientAdapter.sendMessage(remoteJid, `Sedang mengambil data piutang untuk kode "${kodeToko}"... ⏳`);
      const arData = await ActionHandler.executeGetOutstandingAr(kodeToko);
      const formattedReply = formatOutstandingAR(arData);
      await clientAdapter.sendMessage(remoteJid, formattedReply);
      return;
    }

    if (currentState === STATE_WAITING_REGISTER_INFO) {
      if (lowerText === 'batal') {
        clearUserState(remoteJid);
        registrationSessions.delete(remoteJid);
        await clientAdapter.sendMessage(remoteJid, "Pendaftaran dibatalkan.");
        return;
      }
      const parts = textMessage.split(',').map(p => p.trim());
      if (parts.length < 2) {
        await clientAdapter.sendMessage(remoteJid, "Format salah. Silakan kirim dengan format:\n*Nama, NomorHP, Kode*\nContoh: Budi, 08123456789, CUST01");
        return;
      }
      const [name, phone, code] = parts;
      const realPhone = normalizePhoneNumber(phone);
      if (!realPhone || realPhone.length < 10) {
        await clientAdapter.sendMessage(remoteJid, "Nomor HP tidak valid. Silakan coba lagi.");
        return;
      }
      
      const otp = Math.floor(100000 + Math.random() * 900000).toString();
      registrationSessions.set(remoteJid, {
        name,
        realPhone,
        code: code || '',
        otp,
        timestamp: Date.now()
      });
      
      try {
        if (platform === 'telegram') {
            const { sendWhatsAppMessage } = require('../services/taptalk.service');
            try {
                await sendWhatsAppMessage(realPhone, `Kode OTP Pendaftaran Anda adalah: *${otp}*`);
            } catch (waErr) {
                console.warn("[MessageHandler] WhatsApp sending failed for telegram registration:", waErr.message);
            }
            setUserState(remoteJid, STATE_WAITING_OTP);
            await clientAdapter.sendMessage(remoteJid, `Kode OTP Pendaftaran Anda adalah: *${otp}*\n\n(Kami juga mencoba mengirimkannya via WhatsApp ke nomor ${realPhone}).\n\nSilakan balas pesan ini dengan kode OTP tersebut untuk verifikasi.`);
        } else {
            await clientAdapter.sendMessage(realPhone + '@s.whatsapp.net', `Kode OTP Pendaftaran Anda adalah: *${otp}*`);
            setUserState(remoteJid, STATE_WAITING_OTP);
            await clientAdapter.sendMessage(remoteJid, `Kode OTP 6 digit telah dikirim ke nomor ${realPhone}.\n\nSilakan balas pesan ini dengan kode OTP tersebut untuk verifikasi.`);
        }
      } catch (err) {
        console.error("Gagal mengirim OTP:", err);
        await clientAdapter.sendMessage(remoteJid, "Gagal mengirim OTP ke nomor tersebut. Pastikan nomor terdaftar di WhatsApp. Silakan ulangi pendaftaran.");
        clearUserState(remoteJid);
        registrationSessions.delete(remoteJid);
      }
      return;
    }

    if (currentState === STATE_WAITING_OTP) {
      if (lowerText === 'batal') {
        clearUserState(remoteJid);
        registrationSessions.delete(remoteJid);
        await clientAdapter.sendMessage(remoteJid, "Pendaftaran dibatalkan.");
        return;
      }

      const session = registrationSessions.get(remoteJid);
      if (!session) {
        await clientAdapter.sendMessage(remoteJid, "Sesi pendaftaran tidak ditemukan atau sudah kadaluarsa. Silakan ketik *register* ulang.");
        clearUserState(remoteJid);
        return;
      }

      if (textMessage.trim() !== session.otp) {
        await clientAdapter.sendMessage(remoteJid, "Kode OTP salah. Silakan coba lagi atau ketik *batal*.");
        return;
      }

      let isCustomer = false;
      let isSales = false;
      
      if (session.code) {
        const custCheck = await prisma.customer.findUnique({ where: { kdcust: session.code }});
        if (custCheck) isCustomer = true;
        else isSales = true;
      }

      try {
        let existingContact = (contact && contact.id) ? contact : null;
        if (!existingContact) {
            existingContact = await prisma.contact.findFirst({
                where: {
                    OR: [
                        { phoneNumber: session.realPhone },
                        { realPhoneNumber: session.realPhone },
                        { whatsappId: session.realPhone + '@s.whatsapp.net' },
                        { whatsappId: session.realPhone }
                    ]
                }
            });
        }

        if (existingContact) {
          await prisma.contact.update({
            where: { id: existingContact.id },
            data: {
              ...(platform === 'telegram' ? { telegramId: remoteJid } : { whatsappId: remoteJid }),
              realPhoneNumber: session.realPhone,
              name: session.name,
              ...(isCustomer && session.code ? { kodeCustomer: session.code } : {}),
              ...(isSales && session.code ? { kodeSales: session.code } : {})
            }
          });
        } else {
          await prisma.contact.create({
            data: {
              whatsappId: platform === 'whatsapp' ? remoteJid : `telegram_${remoteJid}`,
              telegramId: platform === 'telegram' ? remoteJid : null,
              phoneNumber: senderNumber,
              realPhoneNumber: session.realPhone,
              name: session.name,
              isAllowed: true,
              ...(isCustomer && session.code ? { kodeCustomer: session.code } : {}),
              ...(isSales && session.code ? { kodeSales: session.code } : {})
            }
          });
        }

        clearUserState(remoteJid);
        registrationSessions.delete(remoteJid);
        await clientAdapter.sendMessage(remoteJid, "Pendaftaran berhasil dan sedang diproses aktifasinya.");
      } catch (err) {
        console.error("Gagal update kontak:", err);
        await clientAdapter.sendMessage(remoteJid, "Terjadi kesalahan sistem saat menyimpan pendaftaran. Silakan coba lagi.");
      }
      return;
    }

    // ── STATE: Fallback menu (AI rate limit / busy) ───────────
    if (currentState === STATE_FALLBACK_MENU) {
      const menuConfig = getFallbackMenuConfig(contact);
      const trimmed = textMessage.trim();

      // Detect which menu number the user selected
      let selectedNum = null;
      for (const item of menuConfig.items) {
        const numEmoji = EMOJI_NUMS[item.num] || '';
        if (
          trimmed === String(item.num) ||
          (numEmoji && trimmed.startsWith(numEmoji)) ||
          lowerText === String(item.num) ||
          lowerText.includes(item.label.toLowerCase())
        ) {
          selectedNum = item.num;
          break;
        }
      }

      if (selectedNum !== null) {
        const selectedItem = menuConfig.items.find(i => i.num === selectedNum);
        clearUserState(remoteJid);

        if (!selectedItem.available) {
          // Dummy menu — inform user it's under development
          await clientAdapter.sendMessage(remoteJid, `🔧 *${selectedItem.label}*\n\nFitur ini masih dalam pengembangan di mode manual.\n\nAnda telah keluar dari mode manual dan kembali terhubung dengan AI. Silakan ketik pertanyaan Anda secara langsung atau ketik *menu* untuk melihat opsi yang tersedia.`,);
        } else {
          // Execute the real action
          await executeFallbackAction(clientAdapter, remoteJid, contact, selectedNum);
        }
      } else {
        // Not a recognized menu selection — exit fallback mode
        clearUserState(remoteJid);
        await clientAdapter.sendMessage(remoteJid, 'Telah keluar dari mode manual. Anda kembali terhubung dengan AI.');
      }
      return;
    }

    // ── Quick numeric menu shortcuts (when NOT in fallback) ───
    const trimmedMessage = textMessage.trim();
    const isMenu1 = trimmedMessage === '1' || trimmedMessage.startsWith('1️⃣');
    const isMenu2 = trimmedMessage === '2' || trimmedMessage.startsWith('2️⃣');
    const isMenu3 = trimmedMessage === '3' || trimmedMessage.startsWith('3️⃣');
    const isMenu4 = trimmedMessage === '4' || trimmedMessage.startsWith('4️⃣');
    const isMenu5 = trimmedMessage === '5' || trimmedMessage.startsWith('5️⃣');
    const isMenu6 = trimmedMessage === '6' || trimmedMessage.startsWith('6️⃣');
    const isMenu7 = trimmedMessage === '7' || trimmedMessage.startsWith('7️⃣');

    if (isMenu1 || isMenu2 || isMenu3 || isMenu4 || isMenu5 || isMenu6) {
      let menuName = '';
      let reply = '';

      if (contact && contact.group === 'Customer') {
        if (isMenu1) {
          menuName = 'Profil Toko';
          const targetKode = contact.kodeCustomer ? contact.kodeCustomer.split(',')[0].replace(/['"]/g, '').trim() : '';
          if (targetKode) {
            await clientAdapter.sendMessage(remoteJid, 'Sedang mengambil data profil toko Anda... ⏳');
            const profileStr = await ActionHandler.executeGetStoreProfile(targetKode);
            try {
              const profileData = JSON.parse(profileStr);
              if (profileData.found) {
                reply = `*PROFIL TOKO*\n\n🏢 *Kode Toko:* ${profileData.Kode_Toko}\n🏪 *Nama Toko:* ${profileData.Nama_Toko}`;
              } else {
                reply = 'Data toko tidak ditemukan pada database.';
              }
            } catch (e) {
              reply = 'Terjadi kesalahan saat memproses data profil toko.';
            }
          } else {
            reply = 'Data toko tidak ditemukan pada kontak Anda.';
          }
        } else if (isMenu2) {
          menuName = 'Cek Outstanding AR';
          const targetKode = contact.kodeCustomer ? contact.kodeCustomer.split(',')[0].replace(/['"]/g, '').trim() : '';
          if (targetKode) {
            await clientAdapter.sendMessage(remoteJid, 'Sedang mengambil data piutang Anda, mohon tunggu sebentar... ⏳');
            const arData = await ActionHandler.executeGetOutstandingAr(targetKode);
            reply = formatOutstandingAR(arData);
          } else {
            reply = 'Data toko tidak ditemukan pada kontak Anda.';
          }
        } else {
          menuName = 'Fitur Belum Tersedia';
          reply = '🔧 Fitur ini masih dalam pengembangan. Silakan coba tanyakan langsung ke AI kami.';
        }
      } else if (contact && contact.group === 'Salesman') {
        if (isMenu2) {
          menuName = 'Cek Outstanding AR';
          const rawKodeSales = contact.kodeSales || '';
          const targetKodes = rawKodeSales.split(/[:;,]/).map(k => k.replace(/['"]/g, '').trim()).filter(k => k);
          if (targetKodes.length > 0) {
            for (const targetKode of targetKodes) {
              await clientAdapter.sendMessage(remoteJid, `Sedang mengambil data piutang area Anda (${targetKode})... ⏳`);
              const arDataStr = await ActionHandler.executeGetOutstandingArBySalesman(targetKode, 10);
              let messageToSend = `Tidak ada data piutang untuk area Anda (${targetKode}).`;
              try {
                  const parsed = JSON.parse(arDataStr);
                  if (parsed.Data_Ditemukan) {
                      messageToSend = `📊 *LAPORAN PIUTANG AREA (${targetKode})*\n\n👤 *Sales:* ${parsed.Nama_Sales}\n`;
                      const ringkasan = parsed.Ringkasan_Seluruh_Piutang_Salesman;
                      if (ringkasan) {
                          messageToSend += `*Total Faktur:* ${ringkasan.Total_Semua_Faktur}\n*Total Tagihan:* Rp ${Number(ringkasan.Total_Nominal_Tagihan).toLocaleString('id-ID')}\n*Sisa Saldo:* Rp ${Number(ringkasan.Total_Sisa_Saldo).toLocaleString('id-ID')}\n\n`;
                      }
                      if (parsed.Daftar_Toko && parsed.Daftar_Toko.length > 0) {
                          messageToSend += `🏢 *Top ${parsed.Menampilkan_Jumlah_Toko} Toko (Sisa Tagihan Terbesar):*\n`;
                          parsed.Daftar_Toko.forEach((toko, idx) => {
                              messageToSend += `\n${idx + 1}. *${toko.Nama_Toko}* (${toko.Kode_Toko})\n   Faktur: ${toko.Total_Faktur}\n   Tagihan: Rp ${Number(toko.Total_Tagihan_Toko).toLocaleString('id-ID')}\n   Sisa: Rp ${Number(toko.Sisa_Tagihan_Toko).toLocaleString('id-ID')}\n`;
                              if (toko.Jatuh_Tempo_Terdekat) messageToSend += `   Jatuh Tempo Terdekat: ${toko.Jatuh_Tempo_Terdekat}\n`;
                          });
                      }
                  } else {
                      messageToSend = parsed.message || parsed.error || messageToSend;
                  }
              } catch (e) {
                  messageToSend = arDataStr || messageToSend;
              }
              await clientAdapter.sendMessage(remoteJid, messageToSend);
            }
            reply = null;
            addToMemory(remoteJid, 'user', `Pilih menu: ${menuName}`);
          } else {
            reply = 'Kode sales tidak ditemukan pada kontak Anda.';
          }
        } else {
          menuName = 'Fitur Belum Tersedia';
          reply = '🔧 Fitur ini masih dalam pengembangan. Silakan ketik pertanyaan Anda secara langsung.';
        }
      } else if (contact && contact.group) {
        // Other named groups — check available flag before responding
        const config = getFallbackMenuConfig(contact);
        const selectedNum = isMenu1 ? 1 : isMenu2 ? 2 : isMenu3 ? 3 : isMenu4 ? 4 : isMenu5 ? 5 : isMenu6 ? 6 : isMenu7 ? 7 : null;
        const selectedItem = selectedNum !== null ? config.items.find(i => i.num === selectedNum) : null;

        if (selectedItem && selectedItem.available) {
          // Real action available — execute it and return early
          await executeFallbackAction(clientAdapter, remoteJid, contact, selectedNum);
          addToMemory(remoteJid, 'user', `Pilih menu: ${selectedItem.label}`);
          return;
        } else {
          menuName = selectedItem ? selectedItem.label : 'Fitur';
          reply = `🔧 *${menuName}* masih dalam pengembangan. Silakan ketik pertanyaan Anda secara langsung ke AI kami.`;
        }
      } else {
        // No group — original generic menu
        if (isMenu1) {
          menuName = 'Cek Outstanding AR';
          if (contact && contact.kodeCustomer) {
            await clientAdapter.sendMessage(remoteJid, 'Sedang mengambil data piutang Anda, mohon tunggu sebentar... ⏳');
            const targetKode = contact.kodeCustomer.split(',')[0].replace(/['"]/g, '').trim();
            const arData = await ActionHandler.executeGetOutstandingAr(targetKode);
            reply = formatOutstandingAR(arData);
          } else {
            reply = 'Silakan balas dengan mengetik *KODE TOKO* atau *NAMA TOKO* yang spesifik agar saya bisa mengecek piutang toko tersebut.';
          }
        } else if (isMenu2) {
          menuName = 'Analisa Credit Limit';
          reply = 'Silakan balas dengan mengetik *KODE TOKO* atau *NAMA TOKO* yang spesifik agar saya bisa mengecek kapasitas order (credit limit) toko tersebut.';
        } else if (isMenu3) {
          menuName = 'Lihat Semua Toko';
          reply = 'Silakan balas dengan mengetik *KODE SALES* atau *NAMA SALES* untuk melihat rekap/semua toko dari salesman tersebut.';
        } else if (isMenu4) {
          menuName = 'Cari Toko';
          reply = 'Silakan ketik potongan kode atau nama toko yang ingin Anda cari.';
        } else if (isMenu5) {
          menuName = 'Help';
          reply = "Anda dapat mengetikkan nama toko atau kode toko secara langsung. Jika Anda ingin kembali melihat menu, ketik 'menu' atau 'bantuan'.";
        }
      }

      if (reply) {
        await clientAdapter.sendMessage(remoteJid, reply);
        addToMemory(remoteJid, 'user', `Pilih menu: ${menuName}`);
        addToMemory(remoteJid, 'assistant', reply);
      }
      return;
    }

    // ── DELEGASI WORKFLOW KHUSUS SOPIR ────────────────────────
    if (botType === 'SOPIR' || (contact && contact.group && (contact.group.toUpperCase().includes('SOPIR') || contact.group.toUpperCase().includes('DRIVER')))) {
      const isMenu1 = textMessage === '1' || textMessage.startsWith('1️⃣');
      const isMenu2 = textMessage === '2' || textMessage.startsWith('2️⃣');
      const isMenu3 = textMessage === '3' || textMessage.startsWith('3️⃣');
      
      if (isMenu1) {
        textMessage = '/retur';
        lowerText = '/retur';
        const { handleReturFlow } = require('./ReturnBotHandler');
        const isReturHandled = await handleReturFlow(normalizedMsg, sessionId, clientAdapter);
        if (isReturHandled) return;
      } else if (isMenu2) {
        const miniAppUrl = `${process.env.MINI_APP_URL || 'https://auditwa.padmasaripangan.co.id/api/twa'}?mode=list_today&sessionId=${encodeURIComponent(clientAdapter.sessionId)}`;
        await clientAdapter.sendMessage(remoteJid, `Silakan klik link berikut untuk mengisi detail retur:\n\n${miniAppUrl}`);
        return;
      } else if (isMenu3) {
        textMessage = '/cetak';
        lowerText = '/cetak';
        const { handleReturFlow } = require('./ReturnBotHandler');
        const isReturHandled = await handleReturFlow(normalizedMsg, sessionId, clientAdapter);
        if (isReturHandled) return;
      }
      
      await SopirWorkflow.handleMessage(normalizedMsg, sessionId, clientAdapter, contact);
      return;
    }

    // ── DELEGASI WORKFLOW KHUSUS SALESMAN ─────────────────────
    if (botType === 'SALESMAN' || (contact && contact.group === 'Salesman')) {
      await SalesWorkflow.handleMessage(normalizedMsg, sessionId, clientAdapter, contact);
      return;
    }

    // ── HARDCODED RESPONSES ───────────────────────────────────
    if (textMessage.trim().toUpperCase() === 'CICILAN SESUAI') {
      await clientAdapter.sendMessage(remoteJid, 'Terima kasih atas konfirmasinya.');
      return;
    }

    if (textMessage.trim().toUpperCase() === 'FAKTUR DITERIMA') {
      await clientAdapter.sendMessage(remoteJid, 'Terima kasih atas konfirmasinya.');
      return;
    }

    if (textMessage.trim().toUpperCase() === 'BARANG DITERIMA') {
      await clientAdapter.sendMessage(remoteJid, 'Terima kasih atas konfirmasinya.');
      return;
    }

    // ── Normal AI processing ──────────────────────────────────
    console.log(`[Chatbot] Processing message from ${senderNumber} on session ${sessionId}: "${textMessage.substring(0, 80)}"`);

    try {
      // 1. Tampilkan status typing (Human Jitter)
      if (clientAdapter.sendPresenceUpdate) {
        await clientAdapter.sendPresenceUpdate('composing', remoteJid);
      }
      
      // 2. Delay asinkron acak (3-8 detik) HANYA untuk Unofficial API demi keamanan (anti-ban)
      // TapTalk (Official API) dan Telegram tidak memerlukan delay ini.
      if (sessionId !== 'taptalk' && !sessionId.startsWith('telegram-')) {
        const jitterDelay = Math.floor(Math.random() * (8000 - 3000 + 1)) + 3000;
        await new Promise(resolve => setTimeout(resolve, jitterDelay));
      }

      let response = await processWithLLM(textMessage.trim(), remoteJid);
      
      // Matikan status typing
      if (clientAdapter.sendPresenceUpdate) {
        await clientAdapter.sendPresenceUpdate('paused', remoteJid);
      }
      if (response) {
        const imageRegex = /\[IMAGE:\s*(https?:\/\/[^\]]+)\]/gi;
        let images = [];
        let match;
        while ((match = imageRegex.exec(response)) !== null) {
          images.push(match[1]);
        }
        
        let cleanedResponse = response.replace(imageRegex, '').trim();

        if (images.length > 0) {
          for (let i = 0; i < images.length; i++) {
            try {
              if (i === images.length - 1) {
                await clientAdapter.sendImage(remoteJid, images[i], cleanedResponse || undefined);
              } else {
                await clientAdapter.sendImage(remoteJid, images[i], undefined);
              }
            } catch (imgError) {
              console.error(`[Chatbot] Failed to send image ${images[i]}:`, imgError.message);
              // Fallback to sending just the text if it's the last iteration (which contains the caption)
              if (i === images.length - 1 && cleanedResponse) {
                await clientAdapter.sendMessage(remoteJid, cleanedResponse);
              }
            }
          }
        } else {
          await clientAdapter.sendMessage(remoteJid, cleanedResponse);
        }
        console.log(`[Chatbot] Reply sent to ${senderNumber}`);
      }
    } catch (llmError) {
      if (llmError.code === 'LLM_RATE_LIMIT_ERROR') {
        console.log(`[Chatbot] Rate Limit hit for ${remoteJid}. Engaging Fallback Menu.`);
        setUserState(remoteJid, STATE_FALLBACK_MENU);

        // Build persona-aware, group-aware fallback menu text
        const menuConfig = getFallbackMenuConfig(contact);
        const personaName = contact?.persona?.name || null;
        const fallbackMsg = buildFallbackMenuText(menuConfig, personaName);

        await clientAdapter.sendMessage(remoteJid, fallbackMsg);
      } else {
        throw llmError;
      }
    }
  } catch (error) {
    console.error('[Chatbot] Error handling incoming message:', error);
  }
}

module.exports = {
  handleIncomingMessage,
  sendMainMenu,
};
