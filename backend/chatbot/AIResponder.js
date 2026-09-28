// backend/chatbot/AIResponder.js
const { PrismaClient } = require('@prisma/client');
const { OpenAI } = require('openai');
const prisma = new PrismaClient();
require('dotenv').config();

const { getCompletion, getModelForRole, openai } = require('../utils/Orchestrator');

const { getCompanyProfile, getCompanyProfileString } = require('../utils/settingsHelper');
const { INTERNAL_TOOLS, EXTERNAL_TOOLS } = require('../tools/queryTools');
const { getMemory, addToMemory } = require('./MemoryManager');
const { recordRateLimit, recordLLMSuccess } = require('./MemoryManager');
const ActionHandler = require('./ActionHandler');

const SALES_ACTION_RULES = `ATURAN ANALISA & TINDAKAN (SOP PENAGIHAN KHUSUS UNTUK DATA PIUTANG/AR):
Saat menganalisa data piutang toko, perhatikan kolom riwayat keterlambatan (overdue/OVD) atau data yang ada, lalu berikan rekomendasi berikut di akhir pesan:
1. RISIKO RENDAH (Hanya ada OVD On-Time / OVD < 10 hari): 
   - Action: Berikan lampu hijau untuk SO baru, namun ingatkan Sales untuk tetap memonitor tanggal jatuh tempo terdekat.
2. RISIKO MENENGAH (Ada OVD 11-30 Hari atau Sering Mencicil):
   - Action: Sarankan Sales untuk MENAHAN (HOLD) SO baru secara penuh atau minta toko melakukan DP/Pelunasan faktur tertua terlebih dahulu sebelum barang dikirim.
3. RISIKO TINGGI / RED FLAG (Ada OVD > 30 Hari atau Bad Debt > 0):
   - Action: INSTRUKSIKAN BLOKIR TRANSAKSI. Minta Sales untuk segera lapor ke SPV dan jadwalkan kunjungan fisik ke toko untuk penagihan hard-collection. Jangan terima order baru dalam bentuk apa pun.
JANGAN tampilkan rekomendasi di atas jika pengguna hanya menanyakan informasi harga barang atau stok.

5. [KHUSUS ANALISA PIUTANG/TOKO SAJA]: Setelah rincian angka piutang, selalu tambahkan bagian "🚨 REKOMENDASI TINDAKAN:" dan jelaskan langkah apa yang harus dilakukan Sales berdasarkan SOP di atas. JANGAN gunakan aturan ini jika pengguna hanya mencari harga barang/katalog.

Contoh Tampilan Ideal di WhatsApp:
📋 ANALISA PIUTANG: CANVAS ONLINE (0761)
💰 Sisa Tagihan: Rp 15.000.000
📈 Riwayat Telat: Terdapat 2 faktur telat lebih dari 15 hari.

🚨 REKOMENDASI TINDAKAN (ACTION PLAN):
Toko ini masuk dalam kategori Risiko Menengah.

Tindakan Sales: Harap TAHAN (HOLD) semua pengajuan Sales Order (SO) baru hari ini.

Syarat Buka Hold: Hubungi PIC Toko dan minta mereka melunasi 2 faktur tertua yang sudah lewat jatuh tempo tersebut sebelum orderan baru bisa diproses oleh gudang.`;

const BASE_SYSTEM_RULES = `ATURAN SAPAAN DAN GAYA BAHASA:
1. Anda TIDAK MENGETAHUI gender lawan bicara Anda.
2. DILARANG KERAS menggunakan sapaan berbasis gender seperti "Pak", "Bapak", "Bu", atau "Ibu".
3. Gunakan sapaan netral seperti "Kak", atau langsung jawab pertanyaannya tanpa menggunakan kata ganti sapaan (contoh SALAH: "Iya, Pak! Sisa piutang...", contoh BENAR: "Iya, Kak! Sisa piutang..." atau "Siap! Sisa piutang...").
4. Tetap pertahankan nada yang ramah, sopan, dan menggunakan emoji secukupnya.
5. Analisa gaya bahasa pengirim pesan (apakah mereka formal, santai, dsb) dan balas dengan gaya yang MIRIP/NATURAL namun profesional.
6. Gunakan memory percakapan sebelumnya untuk menjawab pertanyaan lanjutan (misal: jika menanyakan toko 0977 lalu bertanya 'kalau bulan lalu berapa?', asumsikan itu toko 0977).
7. Jangan memberikan data palsu. Jika butuh data, gunakan tools yang tersedia.
8. Format angka uang dalam Rupiah (Rp) dengan pemisah ribuan titik (contoh: Rp 1.500.000).
9. Jika Anda perlu berpikir atau membuat draft, Anda WAJIB membungkusnya di dalam tag <think> dan </think>. Apapun di luar tag tersebut harus berupa HASIL AKHIR yang siap dikirim.
11. DILARANG KERAS memunculkan proses berpikir (reasoning), monolog internal (seperti "We need to...", "Let's craft..."), atau kata-kata pengantar seperti "Okay", "Berikut datanya:" di luar tag <think>.
12. LANGSUNG KELUARKAN JAWABAN AKHIR tanpa basa-basi. Jika menampilkan daftar, langsung mulai dengan judul atau emoji (contoh: 📋 *ANALISA SALESMAN*).
53. ATURAN PENGGUNAAN TOOL: Jika Anda perlu menggunakan tool, JANGAN MENULIS TEKS PENJELASAN APAPUN. DILARANG KERAS menulis nama fungsi seperti "search_product_price('Pop Ice')" di dalam teks balasan. LANGSUNG gunakan fitur tool calling (function call API) secara sistem. JANGAN menjelaskan bahwa Anda akan memanggil tool, jangan menulis "Let's call...", langsung panggil tool-nya saja.
54. GUNAKAN BAHASA INDONESIA. Jangan menggunakan bahasa Inggris sama sekali.
15. ATURAN GAMBAR/MEDIA & PROMO: Jika data yang dikembalikan tool memiliki field 'mediaUrl', Anda WAJIB menyertakannya di akhir teks jawaban Anda persis dengan format ini (jangan diubah): [IMAGE: url_media_tersebut]. DILARANG KERAS berhalusinasi atau menebak isi gambar (misal menyebut produk sabun/shampoo jika tidak tertulis di deskripsi). Cukup sampaikan judul dan deskripsi persis seperti yang diberikan tool.
16. ROTASI KATA (DYNAMIC WORDING): Selalu variasikan kalimat sapaan pembuka (Halo, Hai, Selamat pagi/siang/sore/malam, dsb) SESUAIKAN DENGAN WAKTU SAAT INI, dan variasikan kalimat penutup di setiap balasan agar tidak 100% sama setiap saat. Hal ini penting agar pesan terlihat dinamis dan natural layaknya manusia.
17. NADA RESPON & KEBIJAKAN: DILARANG KERAS menyebutkan atau mengancam adanya denda, penalti, biaya tambahan, pemblokiran, atau hal lain yang terkesan menekan. Perusahaan TIDAK memiliki kebijakan denda atau biaya tambahan untuk keterlambatan pembayaran. Pastikan nada balasan selalu positif dan solutif.
57. MENGAKHIRI PERCAKAPAN: Jika pesan pengguna hanya berupa konfirmasi singkat (contoh: "Baik", "Ok", "Sip") atau ucapan terima kasih (contoh: "Terima kasih", "Makasih"), Anda CUKUP membalas dengan ucapan sama-sama yang sopan (contoh: "Sama-sama, Kak! Jika ada yang bisa dibantu lagi, silakan tanyakan."). DILARANG KERAS memanggil tool atau mengulangi/menampilkan kembali data yang sudah diberikan sebelumnya.
58. KESADARAN KONTEKS BERKELANJUTAN: Jangan mengulang sapaan pembuka (seperti 'Halo', 'Selamat Pagi') jika Anda sedang berada di tengah-tengah percakapan yang terus berlanjut. Balaslah dengan natural dan langsung ke inti pesan.
59. PENANGANAN BAHASA DAERAH: Jika pengguna membalas menggunakan bahasa daerah (seperti Bahasa Sunda, Jawa, dll) atau logat yang tidak Anda pahami, TETAP gunakan Bahasa Indonesia. Sampaikan permohonan maaf dengan sopan bahwa Anda kurang memahami bahasa tersebut, dan mohon kepada pengguna untuk menggunakan Bahasa Indonesia agar Anda bisa memberikan bantuan dan solusi yang terbaik.

ATURAN ANTI HALUSINASI PRODUK & PROMO (WAJIB DIPATUHI):
1. DILARANG KERAS menyebutkan nama barang/produk yang tidak ada di dalam database atau tidak dikembalikan oleh tool (contoh: jangan pernah sebut Kopi Kapal Api, Mie Sedaap, dll jika memang tidak ada datanya).
2. DILARANG KERAS memberikan informasi promo apapun yang tidak dikembalikan oleh tool. Jika tool mengatakan tidak ada promo untuk periode/produk yang ditanyakan, JAWAB DENGAN JUJUR bahwa tidak ada promo. Jangan mengarang sendiri promosinya.
3. Promo yang diinformasikan HARUS SESUAI dengan periode waktu yang ditanyakan pengguna (contoh: bulan ini atau bulan depan). Selalu panggil tool pencarian promo terlebih dahulu sebelum menjawab tentang promo.

ATURAN FORMAT OUTPUT WHATSAPP (SANGAT PENTING):
1. DILARANG KERAS menggunakan format tabel Markdown (simbol |). WhatsApp tidak mendukungnya dan hasilnya akan berantakan.
2. Jika menampilkan daftar data berganda, GUNAKAN FORMAT LIST VERTIKAL.
3. Cetak tebal judul utama setiap item (contoh: *1. NAMA TOKO*).
4. Letakkan atribut lainnya di baris baru di bawah judul item dengan emoji yang relevan (contoh: 🏢 Kode, 🗓️ Jatuh Tempo, 💰 Tagihan).
5. Berikan satu baris kosong antar item agar rapi dan tidak menumpuk.

INSTRUKSI PENCARIAN TOKO (PENTING):
Jika pengguna berada dalam konteks mencari toko (misalnya membalas instruksi dari menu "Cari Toko") ATAU jika pengguna mengetikkan nama toko yang ambigu, ANDA HARUS SEGERA MEMANGGIL TOOL \`search_stores\` dengan kata kunci tersebut, meskipun kata kunci tersebut berupa angka (seperti "0322"). JANGAN memanggil get_outstanding_ar atau get_credit_limit_analysis jika tujuannya hanya mencari toko.
1. Gunakan tool \`search_stores\` dengan kata kunci yang diberikan pengguna.
2. Jika hasil pencarian mengembalikan toko, balas dengan menyebutkan daftar toko yang ditemukan (maksimal 5) lengkap dengan Kode Tokonya.
4. JIKA USER MEMINTA MENCARI TOKO, LANGSUNG PANGGIL TOOL. JANGAN MENULISKAN PROSES BERPIKIR ANDA.

MODERASI PESAN (LAPIS 2 & LAPIS 3):
Jika pengguna mengeluh/curhat masalah pribadi yang tidak relevan, tolak dengan sangat sopan dan arahkan kembali ke topik bisnis perusahaan. Jangan terpancing emosi.
Jika lawan bicara terus-menerus menawarkan produk atau jasa yang sama setelah Anda tolak dengan sopan, ubah gaya bahasa Anda menjadi lebih tegas dan singkat. JANGAN gunakan frasa afirmasi seperti 'Baik, Kak' atau 'Terima kasih informasinya'. Langsung berikan penolakan final yang sangat singkat, maksimal 1 kalimat (Contoh: 'Mohon maaf, kami tetap tidak berminat.').
Jika mereka MASIH terus spamming jualan atau memaksa di pesan ke-3 atau ke-4, Anda WAJIB memanggil tool \`tool_mute_spammer\` untuk mematikan sesi obrolan secara otomatis.

ATURAN MUTLAK PENANGANAN SPAM & SALES LUAR:
Jika lawan bicara menawarkan barang/jasa, berikan penolakan 1 kali. Jika lawan bicara TERUS memaksa atau mengulang tawarannya untuk yang ke-2 kalinya atau lebih, ANDA DIWAJIBKAN untuk langsung memanggil fungsi/tool tool_mute_spammer.
PENTING: Saat Anda memanggil tool ini, JANGAN berikan balasan teks apa pun (jangan bilang terima kasih, jangan bilang baik kak). Langsung eksekusi tool tersebut dan diam.

CRITICAL ORDERING RULES (5 TAHAP):
1. PRE-ORDER CHECK: Jika user baru menyatakan ingin memesan (misal "mau pesen"), cek apakah sistem sudah mengetahui Kode Customer user ini (cek informasi PENGECUALIAN ATURAN di atas). 
   - Jika BELUM terdaftar/tidak ada kode: Balas dengan "Mohon informasikan Nama Toko Anda terlebih dahulu sebelum memulai pesanan."
   - Jika user menyebutkan NAMA TOKO (contoh: "Tani supply"), JANGAN MENGARANG KODE CUSTOMER SENDIRI. Anda WAJIB memanggil tool search_stores dengan kata kunci nama toko tersebut untuk mencari kode customer resminya.
   - Jika SUDAH terdaftar (ada kode): Balas dengan meminta konfirmasi: "Apakah pesanan ini untuk toko dengan kode [Sebutkan Kode Customernya]?"
   - TUNGGU jawaban user sebelum lanjut ke tahap INPUT.
2. OPENING: Setelah user memberikan kode atau mengonfirmasi kodenya, persilakan mereka menyebutkan pesanan.
3. INPUT: Saat user menyebut barang, gunakan tool extract_and_check_order. BALAS SINGKAT SAJA (misal: "Oke, 1 dus Pop Ice dicatat. Ada lagi?"). DILARANG memunculkan total harga atau Cart Summary di tahap ini.
4. SUMMARY: Jika user bilang "sudah", "selesai", atau "itu aja", gunakan tool view_cart_summary untuk mengambil ringkasan pesanan. Tampilkan CART SUMMARY lengkap dan minta konfirmasi final (misal: "Apakah pesanan ini sudah benar dan mau diproses sekarang?").
5. CHECKOUT: Jika user berkata "Iya", "Lanjut", "Proses", atau "Setuju" setelah melihat Summary, Anda WAJIB memanggil tool checkout_order.
NEVER calculate total prices or subtotals yourself. You are terrible at math.`;

async function processWithLLM(userMessage, remoteJid) {
  let model = 'meta-llama/llama-3.3-70b-instruct';
  try {
    const chatbotModel = await prisma.appSetting.findUnique({ where: { key: 'chatbot_model' } });
    if (chatbotModel && chatbotModel.value) {
      model = chatbotModel.value;
    } else {
      const defaultModel = await prisma.appSetting.findUnique({ where: { key: 'default_ai_model' } });
      if (defaultModel && defaultModel.value) model = defaultModel.value;
    }
  } catch (e) {
    console.error('[Chatbot] Failed to fetch AI model setting:', e);
  }

  let activeSystemPrompt = "";
  let activeTools = [];
  let toolAccessMode = 'EXTERNAL'; 
  let contact = null;

  try {
    const phoneNumber = remoteJid.split('@')[0];

    let existingContact = await prisma.contact.findFirst({
      where: {
        OR: [
          { whatsappId: remoteJid },
          { whatsappId: phoneNumber + '@s.whatsapp.net' },
          { telegramId: phoneNumber },
          { phoneNumber: phoneNumber },
          { realPhoneNumber: phoneNumber }
        ]
      },
      include: { persona: true }
    });

    if (!existingContact) {
      const isTelegram = !remoteJid.includes('@s.whatsapp.net');
      existingContact = await prisma.contact.create({
        data: {
          whatsappId: isTelegram ? `telegram_${remoteJid}` : remoteJid,
          telegramId: isTelegram ? remoteJid : null,
          phoneNumber: phoneNumber,
          name: phoneNumber
        },
        include: { persona: true }
      });
    }
    contact = existingContact;

    let personaPrompt = '';
    if (contact.persona && contact.persona.systemPrompt) {
      personaPrompt = contact.persona.systemPrompt;
      toolAccessMode = contact.persona.toolAccess || 'EXTERNAL';
    } else {
      const defaultPersona = await prisma.persona.findFirst({
        where: { name: { contains: 'KIRANA' } }
      });
      if (defaultPersona) {
        personaPrompt = defaultPersona.systemPrompt;
        toolAccessMode = defaultPersona.toolAccess || 'EXTERNAL';
      } else {
        const company = await getCompanyProfile();
        personaPrompt = `Anda adalah Asisten Bisnis AI dari ${company.COMPANY_NAME || 'perusahaan'}.`;
      }
    }

    if (contact.kodeCustomer) {
      personaPrompt += `\n\n[PENGECUALIAN ATURAN]: Pengguna ini adalah Customer Terverifikasi dengan kode: ${contact.kodeCustomer}. Anda SEKARANG DIIZINKAN dan WAJIB memberikan informasi piutang (AR) dan Credit Limit khusus untuk toko mereka jika diminta. JANGAN TOLAK permintaan mereka terkait hal ini.`;
      personaPrompt += `\n\nPENTING: Jika pengguna meminta data apapun (piutang, profil, limit kredit), Anda WAJIB LANGSUNG MENGGUNAKAN kode customer ini (${contact.kodeCustomer}) sebagai parameter pencarian pada tool. JANGAN PERNAH bertanya lagi kepada pengguna mengenai kode atau nama toko. Anda HARUS MENOLAK permintaan jika pengguna secara eksplisit meminta data toko lain.`;
      personaPrompt += `\n\nATURAN KHUSUS UNTUK CUSTOMER: Karena pengguna ini adalah Customer yang bertanya tentang sisa piutang mereka sendiri, respon Anda HARUS SANGAT SANTUN, FORMAL, dan TIDAK INTIMIDATIF. Cukup tampilkan total sisa piutang dan detail faktur yang masih outstanding. DILARANG KERAS menampilkan atau menyinggung bagian "REKOMENDASI TINDAKAN", "Risiko", "Hold SO", atau instruksi internal Sales lainnya. DILARANG KERAS menyebutkan denda atau biaya tambahan.`;
    }
    if (contact.kodeSales) {
      personaPrompt += `\n\n[PENGECUALIAN ATURAN]: Pengguna ini adalah Salesman Terverifikasi dengan kode: ${contact.kodeSales}. Anda SEKARANG DIIZINKAN memberikan informasi piutang (AR), data toko, dan performa khusus untuk area mereka.`;
      personaPrompt += `\n\nPENTING: Jika pengguna meminta data piutang/AR/tagihan atau performa, Anda WAJIB LANGSUNG MENGGUNAKAN kode sales ini (${contact.kodeSales}) sebagai parameter pencarian. JANGAN PERNAH bertanya lagi mengenai kode atau nama sales. Anda HARUS MENOLAK permintaan jika pengguna meminta data sales lain.`;
    }
    if (contact.kodeGudang) {
      personaPrompt += `\n\nPENTING: Anda sedang berbicara dengan pihak Gudang yang mengelola kode gudang: ${contact.kodeGudang}. Batasi informasi stok dan pergerakan barang hanya untuk gudang-gudang tersebut.`;
    }

    let availableTools = toolAccessMode === 'INTERNAL' ? [...INTERNAL_TOOLS] : [...EXTERNAL_TOOLS];

    if (contact.kodeCustomer) {
      const customerToolNames = ['get_outstanding_ar', 'get_credit_limit_analysis', 'get_store_profile_and_location', 'get_invoice_detail'];
      const customerTools = INTERNAL_TOOLS.filter(t => customerToolNames.includes(t.function.name));
      availableTools = [...EXTERNAL_TOOLS, ...customerTools];
    } else if (contact.kodeSales) {
      const forbiddenNames = ['get_outstanding_ar_summary_per_salesman'];
      if (toolAccessMode === 'EXTERNAL') {
        const salesToolNames = ['get_outstanding_ar_by_salesman', 'get_bad_debt_or_overdue_stores', 'get_sales_performance_report'];
        const salesTools = INTERNAL_TOOLS.filter(t => salesToolNames.includes(t.function.name));
        availableTools = [...EXTERNAL_TOOLS, ...salesTools];
      } else {
        availableTools = availableTools.filter(t => !forbiddenNames.includes(t.function.name));
      }
    }

    const seenTools = new Set();
    activeTools = availableTools.filter(t => {
      if (seenTools.has(t.function.name)) return false;
      seenTools.add(t.function.name);
      return true;
    });

    let activeRules = BASE_SYSTEM_RULES;
    if (!contact || !contact.kodeCustomer) {
      activeRules = SALES_ACTION_RULES + '\n\n' + activeRules;
    }

    const companyProfile = await getCompanyProfile();
    const companyName = companyProfile.COMPANY_NAME || '';
    const companyProfileStr = await getCompanyProfileString();
    const currentWIB = new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta', dateStyle: 'full', timeStyle: 'long' });
    const companyNameRule = companyName
      ? `\n\n[ATURAN NAMA PERUSAHAAN]:\nNama perusahaan resmi Anda HANYA "${companyName}". DILARANG KERAS menyebutkan nama perusahaan lain atau menambahkan nama perusahaan lama (termasuk dilarang menyebut PT Padma Sari Pangan).`
      : '';
    activeSystemPrompt = `PERAN ANDA:\n${personaPrompt}\n\n[INFO SISTEM]\nWaktu saat ini: ${currentWIB}. PASTIKAN sapaan Anda (pagi/siang/sore/malam) sesuai dengan waktu ini.\n\n${companyProfileStr}${companyNameRule}\n\n${activeRules}`;
  } catch (error) {
    const companyProfileStr = await getCompanyProfileString().catch(() => '');
    const currentWIB = new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta', dateStyle: 'full', timeStyle: 'long' });
    console.error('[Chatbot] Error handling dynamic persona:', error);
    activeSystemPrompt = `PERAN ANDA:\nAnda adalah Asisten Bisnis AI.\n\n[INFO SISTEM]\nWaktu saat ini: ${currentWIB}. PASTIKAN sapaan Anda (pagi/siang/sore/malam) sesuai dengan waktu ini.\n\n${companyProfileStr}\n\n${BASE_SYSTEM_RULES}`;
    activeTools = EXTERNAL_TOOLS;
  }

  const conversationHistory = getMemory(remoteJid);
  let finalUserMessage = userMessage;
  if (contact && contact.kodeCustomer) {
    finalUserMessage += `\n\n(Catatan Sistem: Kode toko pengguna ini adalah "${contact.kodeCustomer}". Tolong langsung gunakan kode toko ini untuk memanggil tool pencarian data tanpa bertanya lagi.)`;
  } else if (contact && contact.kodeSales) {
    finalUserMessage += `\n\n(Catatan Sistem: Kode sales pengguna ini adalah "${contact.kodeSales}". Tolong langsung gunakan kode sales ini untuk memanggil tool pencarian data tanpa bertanya lagi.)`;
  }

  const messages = [
    { role: 'system', content: activeSystemPrompt },
    ...conversationHistory,
    { role: 'user', content: finalUserMessage },
  ];

  try {
    // TAHAP 1: ROUTING (Triage)
    // Walaupun kita punya pipeline, untuk menjaga kecepatan dan kompatibilitas tool calling, 
    // kita akan menggunakan model ANALYTICAL untuk proses tool calling, dan PERSONA untuk text generation
    const analyticalModel = await getModelForRole('ANALYTICAL');
    
    console.log(`[Chatbot] Sending to LLM (ANALYTICAL: ${analyticalModel}), history: ${conversationHistory.length} msgs`);

    const payload = {
      model: analyticalModel,
      messages,
      max_tokens: 1024,
      temperature: 0.7,
    };

    if (activeTools && activeTools.length > 0) {
      payload.tools = activeTools;
      payload.tool_choice = 'auto';

      if (contact && contact.kodeCustomer) {
        const isClosingPhrase = /^(baik|ok|oke|sip|terima kasih|makasih|thanks|tq|ya)[\s.,!]*$/i.test(userMessage.trim()) || /(terima kasih|makasih|thanks|tq)/i.test(userMessage);
        
        if (!isClosingPhrase) {
          if (/piutang|\bar\b|tagihan|outstanding|sisa|hutang/i.test(userMessage)) {
            payload.tool_choice = { type: 'function', function: { name: 'get_outstanding_ar' } };
          } else if (/limit|\bocl\b|kapasitas/i.test(userMessage)) {
            payload.tool_choice = { type: 'function', function: { name: 'get_credit_limit_analysis' } };
          }
        }
      }
    }

    let assistantMessage = null;

    const response = await openai.chat.completions.create(payload);
    assistantMessage = response.choices[0]?.message;
    console.log(`[Chatbot] Raw LLM Response:`, JSON.stringify(assistantMessage));

    // Fallback parser for OpenRouter models that dump tool call JSON into content
    if ((!assistantMessage.tool_calls || assistantMessage.tool_calls.length === 0) && assistantMessage.content) {
      try {
        let contentStr = assistantMessage.content.trim();
        // Extract JSON object if it's embedded in text
        const jsonMatch = contentStr.match(/\{[\s\S]*"name"[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          if (parsed.name && parsed.arguments) {
            console.log(`[Chatbot] Rescued tool call from content: ${parsed.name}`);
            assistantMessage.tool_calls = [{
              id: 'call_' + Math.random().toString(36).substring(7),
              type: 'function',
              function: {
                name: parsed.name,
                arguments: typeof parsed.arguments === 'string' ? parsed.arguments : JSON.stringify(parsed.arguments)
              }
            }];
            assistantMessage.content = null; // Clear content since it's a tool call
          }
        }
      } catch (parseErr) {
        console.error('[Chatbot] Fallback parse failed:', parseErr.message, 'Content was:', assistantMessage.content);
      }
    }

    if (assistantMessage.tool_calls && assistantMessage.tool_calls.length > 0) {
      console.log(`[Chatbot] LLM requested ${assistantMessage.tool_calls.length} tool call(s)`);

      messages.push(assistantMessage);

      for (const toolCall of assistantMessage.tool_calls) {
        const functionName = toolCall.function.name;
        const args = JSON.parse(toolCall.function.arguments);

        console.log(`[Chatbot] Executing tool: ${functionName}(${JSON.stringify(args)})`);

        let toolResult;
        let isAllowed = true;

        if (contact.kodeCustomer && ['get_outstanding_ar', 'get_credit_limit_analysis', 'get_store_profile_and_location'].includes(functionName)) {
          const allowedCodes = contact.kodeCustomer.split(',').map(c => c.replace(/["']/g, '').trim().toUpperCase());
          if (!args.kode_toko && allowedCodes.length > 0) {
            args.kode_toko = allowedCodes[0];
          }
          const requestedCode = args.kode_toko ? args.kode_toko.replace(/["']/g, '').trim().toUpperCase() : '';

          if (!allowedCodes.includes(requestedCode)) {
            isAllowed = false;
            toolResult = JSON.stringify({ error: `Akses Ditolak: Karena alasan privasi dan keamanan, Customer hanya diizinkan mengakses data untuk kode customer mereka sendiri (${allowedCodes.join(', ')}). Beritahu pengguna secara sopan.` });
          }
        }

        if (contact.kodeSales && ['get_outstanding_ar_by_salesman', 'get_bad_debt_or_overdue_stores', 'get_sales_performance_report'].includes(functionName)) {
          const allowedCodes = contact.kodeSales.split(',').map(c => c.replace(/["']/g, '').trim().toUpperCase());
          if (!args.keyword && allowedCodes.length > 0) {
            args.keyword = allowedCodes[0];
          }
          const requestedCode = args.keyword ? args.keyword.replace(/["']/g, '').trim().toUpperCase() : '';

          if (!allowedCodes.includes(requestedCode)) {
            isAllowed = false;
            toolResult = JSON.stringify({ error: `Akses Ditolak: Anda hanya diizinkan mengakses data untuk kode sales Anda sendiri (${allowedCodes.join(', ')}). Beritahu pengguna secara sopan.` });
          }
        }

        if (contact.kodeSales && functionName === 'get_outstanding_ar_summary_per_salesman') {
          isAllowed = false;
          toolResult = JSON.stringify({ error: `Akses Ditolak: Anda tidak diizinkan melihat rekap seluruh salesman.` });
        }

        if (isAllowed) {
          if (functionName === 'get_outstanding_ar') {
            toolResult = await ActionHandler.executeGetOutstandingAr(args.kode_toko);
          } else if (functionName === 'get_credit_limit_analysis') {
            toolResult = await ActionHandler.executeGetCreditLimitAnalysis(args.kode_toko);
          } else if (functionName === 'get_outstanding_ar_by_salesman') {
            toolResult = await ActionHandler.executeGetOutstandingArBySalesman(args.keyword, args.limit);
          } else if (functionName === 'get_outstanding_ar_summary_per_salesman') {
            toolResult = await ActionHandler.executeGetOutstandingArSummaryPerSalesman();
          } else if (functionName === 'search_stores') {
            toolResult = await ActionHandler.executeSearchStores(args.keyword);
          } else if (functionName === 'get_invoice_detail') {
            toolResult = await ActionHandler.executeGetInvoiceDetail(args.nomor_faktur);
          } else if (functionName === 'get_store_profile_and_location') {
            toolResult = await ActionHandler.executeGetStoreProfile(args.kode_toko);
          } else if (functionName === 'check_payment_receipts') {
            toolResult = await ActionHandler.executeCheckPaymentReceipts(args.nominal, args.kata_kunci);
          } else if (functionName === 'request_human_agent') {
            // Kita butuh phone number untuk mengidentifikasi kontak yang akan dialihkan statusnya
            toolResult = await ActionHandler.executeRequestHumanAgent(contact.phoneNumber);
          } else if (functionName === 'get_bad_debt_or_overdue_stores') {
            toolResult = await ActionHandler.executeGetBadDebtStores(args.keyword);
          } else if (functionName === 'get_sales_performance_report') {
            toolResult = await ActionHandler.executeGetSalesPerformance(args.keyword);
          } else if (functionName === 'search_product_price' || functionName === 'get_product_catalog') {
            toolResult = await ActionHandler.executeSearchProductPrice(args.keyword);
          } else if (functionName === 'search_promo') {
            toolResult = await ActionHandler.executeSearchPromo(args.keyword);
          } else if (functionName === 'tool_mute_spammer' || functionName === 'tool_ignore_user') {
            toolResult = await ActionHandler.executeIgnoreUser(args.reason, contact.phoneNumber);
          } else if (functionName === 'extract_and_check_order') {
            toolResult = await ActionHandler.executeExtractAndCheckOrder(contact.id, args.items || []);
          } else if (functionName === 'view_cart_summary') {
            toolResult = await ActionHandler.executeViewCartSummary(contact.id);
          } else if (functionName === 'clear_cart') {
            toolResult = await ActionHandler.executeClearCart(contact.id);
          } else if (functionName === 'checkout_order') {
            toolResult = await ActionHandler.executeCheckoutOrder(contact.id);
          } else if (functionName === 'search_daily_deliveries') {
            toolResult = await ActionHandler.executeSearchDailyDeliveries(args.nopfi);
          } else {
            toolResult = JSON.stringify({ error: `Unknown tool: ${functionName}` });
          }

        }

        messages.push({
          role: 'tool',
          tool_call_id: toolCall.id,
          content: toolResult,
        });
      }

      const finalMessages = [
        ...messages,
        {
          role: 'system',
          content: `PENTING: JANGAN tampilkan proses berpikir, monolog, atau draft (seperti "We need to...", "Let's craft..."). JIKA perlu berpikir gunakan tag <think>. Berikan HANYA hasil akhir berbahasa Indonesia yang siap dikirim ke pengguna. JIKA tool mengembalikan pesan error, Anda WAJIB menyampaikan error tersebut ke pengguna dengan bahasa yang sopan dan DILARANG KERAS mengarang/menjawab bahwa proses berhasil.`
        }
      ];

      const personaModel = await getModelForRole('PERSONA');
      const finalResponse = await openai.chat.completions.create({
        model: personaModel,
        messages: finalMessages,
        max_tokens: 1024,
        temperature: 0.7,
      });

      let finalText = finalResponse.choices[0]?.message?.content || 'Maaf, saya tidak bisa memproses permintaan Anda saat ini.';

      finalText = finalText.replace(/<think>[\s\S]*?(?:<\/think>|$)/gi, '').trim();
      if (!finalText) finalText = 'Maaf, proses menghasilkan jawaban gagal. Mohon ulangi pertanyaan Anda.';

      const isLeakingReasoningFinal =
        finalText.includes('<tool_call>') ||
        finalText.includes('{"name":') ||
        finalText.includes('We need to') ||
        finalText.includes('So we need to') ||
        finalText.includes('The user wants') ||
        finalText.includes('search_product_price') ||
        finalText.includes('get_product_catalog') ||
        finalText.toLowerCase().includes('tool call');

      if (isLeakingReasoningFinal) {
        console.log('[Chatbot] Caught raw reasoning/tool call leak in final text. Overriding with fallback.');
        finalText = "Mohon maaf, format instruksi belum sepenuhnya dipahami oleh sistem atau data terlalu rumit.\n\nSilakan coba lagi dengan format yang lebih spesifik. Contoh perintah:\n- *Piutang [Nama Toko/Sales]* (Mengecek sisa tagihan)\n- *Limit [Nama Toko]* (Mengecek analisa kredit)\n- *Analisa [Nama Salesman]* (Mengecek rekap per salesman)\n\nAtau ketik *menu* untuk kembali.";
      }

      addToMemory(remoteJid, 'user', userMessage);
      addToMemory(remoteJid, 'assistant', finalText);
      recordLLMSuccess();

      return finalText;
    }

    let directText = assistantMessage.content || 'Maaf, saya tidak bisa memproses permintaan Anda saat ini.';
    directText = directText.replace(/<think>[\s\S]*?(?:<\/think>|$)/gi, '').trim();
    if (!directText) directText = 'Maaf, proses menghasilkan jawaban gagal. Mohon ulangi pertanyaan Anda.';

    const isLeakingReasoning =
      directText.includes('<tool_call>') ||
      directText.includes('{"name":') ||
      directText.includes('We need to') ||
      directText.includes('So we need to') ||
      directText.includes('The user wants') ||
      directText.includes('search_product_price') ||
      directText.includes('get_product_catalog') ||
      directText.toLowerCase().includes('tool call');

    if (isLeakingReasoning) {
      console.log('[Chatbot] Caught raw reasoning/tool call leak in direct text. Overriding with fallback.');
      directText = "Mohon maaf, format instruksi belum sepenuhnya dipahami oleh sistem atau data terlalu rumit.\n\nSilakan coba lagi dengan format yang lebih spesifik. Contoh perintah:\n- *Piutang [Nama Toko/Sales]* (Mengecek sisa tagihan)\n- *Limit [Nama Toko]* (Mengecek analisa kredit)\n- *Analisa [Nama Salesman]* (Mengecek rekap per salesman)\n\nAtau ketik *menu* untuk kembali.";
    }

    addToMemory(remoteJid, 'user', userMessage);
    addToMemory(remoteJid, 'assistant', directText);
    recordLLMSuccess();

    return directText;
  } catch (error) {
    console.error('[Chatbot] LLM Error:', error.message || error);

    const errMsg = (error.message || '').toLowerCase();
    if (
      error.status === 429 || 
      errMsg.includes('429') || 
      error.status === 402 || 
      errMsg.includes('credit') || 
      errMsg.includes('billing')
    ) {
      recordRateLimit();
      const err = new Error("LLM_RATE_LIMIT_ERROR");
      err.code = 'LLM_RATE_LIMIT_ERROR';
      throw err;
    }

    if (
      error.message?.includes('tool') ||
      error.message?.includes('function') ||
      error.status === 400
    ) {
      console.log('[Chatbot] Tool calling may not be supported by this model, retrying without tools...');
      try {
        const fallbackMessages = [
          ...messages,
          {
            role: 'system',
            content: 'PENTING: JANGAN tampilkan proses berpikir, monolog, atau draft (seperti "We need to...", "Let\'s craft..."). JIKA perlu berpikir gunakan tag <think>. Berikan HANYA hasil akhir berbahasa Indonesia yang siap dikirim ke pengguna.'
          }
        ];
        const fallbackModel = await getModelForRole('PERSONA');
        const fallbackResponse = await openai.chat.completions.create({
          model: fallbackModel,
          messages: fallbackMessages,
          max_tokens: 1024,
          temperature: 0.7,
        });

        let fallbackText = fallbackResponse.choices[0]?.message?.content || 'Maaf, saya tidak bisa memproses permintaan Anda saat ini.';

        fallbackText = fallbackText.replace(/<think>[\s\S]*?(?:<\/think>|$)/gi, '').trim();
        if (!fallbackText) fallbackText = 'Maaf, proses menghasilkan jawaban gagal. Mohon ulangi pertanyaan Anda.';

        addToMemory(remoteJid, 'user', userMessage);
        addToMemory(remoteJid, 'assistant', fallbackText);

        return fallbackText;
      } catch (fallbackError) {
        console.error('[Chatbot] Fallback LLM Error:', fallbackError.message);
      }
    }

    return 'Maaf, terjadi kesalahan saat memproses pesan Anda. Silakan coba lagi nanti. 🙏';
  }
}

module.exports = {
  processWithLLM,
};
