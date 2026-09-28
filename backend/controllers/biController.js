const { PrismaClient, Prisma } = require('@prisma/client');
const prisma = new PrismaClient();
const { getModelForRole, getOrchestrationTier, openai } = require('../utils/Orchestrator');
const { recordRateLimit, recordLLMSuccess } = require('../chatbot/MemoryManager');

const handleBiChat = async (req, res) => {
  let model = req.body.model;
  try {
    let { userMessage, chatHistory = [] } = req.body;

    const analyticalModel = await getModelForRole('ANALYTICAL');
    const tier = await getOrchestrationTier();
    const isPremium = tier === 'PAID';
    const personaModel = await getModelForRole('PERSONA');
    model = analyticalModel; // Default logging model

    if (!userMessage) {
      return res.status(400).json({ message: "userMessage is required" });
    }

    console.log("================ BI CHAT TRACE START ================");
    console.log(`[1] INCOMING REQUEST - Model: ${model}`);
    console.log(`[1] USER MESSAGE: ${userMessage}`);

    // ==========================================
    // STEP 0.5: Role-Based Access Control & Router (RAG)
    // ==========================================
    let userRole = 'customer'; // Default
    let identifier = req.body.phoneNumber || 'unknown';

    if (req.user) {
      userRole = req.user.role; 
      identifier = req.user.username;
    } else if (req.body.phoneNumber) {
      const contact = await prisma.contact.findFirst({
        where: { phoneNumber: req.body.phoneNumber }
      });
      if (contact && contact.group && contact.group.trim() !== '') {
        userRole = contact.group; 
      }
    }

    let securityRules = "";
    if (userRole === 'customer' || userRole === 'USER') {
      securityRules = `
CRITICAL SECURITY RULE: The user asking this query is an EXTERNAL CUSTOMER (Identifier: ${identifier}).
1. You MUST NOT allow access to internal data such as profit margins, costs, internal staff chats, or other customers' data.
2. ALWAYS filter the query to only return data relevant to this specific customer.
3. If the user asks for sensitive data, return a query that yields 0 rows or a safe message, DO NOT expose internal tables.`;
    }

    const models = Prisma.dmmf.datamodel.models;
    const catalogForRouter = models.map(m => {
        return `- ${m.dbName || m.name}: ${m.fields.map(f => f.name).join(', ')}`;
    }).join('\\n');

    const routerPrompt = `You are a database router. Given the user's question, identify which tables from the schema catalog are required to answer it.
Catalog:
${catalogForRouter}

User Question: ${userMessage}
Return ONLY a JSON object with a 'tables' array containing the names of the required tables. Maximum 3 tables. Example: {"tables": ["messages", "sessions"]}`;

    let selectedTables = ["messages", "sessions", "outstandingar", "analisacreditlimit", "customers"]; // Default fallback

    // ── Smart Complain Detector: Override router untuk skenario komplain percakapan ──
    const complainKeywords = [
      'komplain', 'dispute', 'tidak akui', 'tidak terima barang', 'tidak punya piutang',
      'barang tidak sampai', 'barang belum sampai', 'tidak menerima', 'tidak mengakui',
      'ar dispute', 'gr dispute', 'komplain cicilan', 'komplain barang', 'complaint'
    ];
    const isComplainQuery = complainKeywords.some(kw => userMessage.toLowerCase().includes(kw));
    if (isComplainQuery) {
      selectedTables = ['messages', 'sessions', 'contacts', 'customers', 'outstandingar'];
      console.log("[0.5] COMPLAIN QUERY DETECTED — forcing tables:", selectedTables);
    } else {
      try {
        console.log("[0.5] RUNNING ROUTER LLM...");
        const routerCompletion = await openai.chat.completions.create({
          messages: [{ role: "user", content: routerPrompt }],
          model: model,
          temperature: 0,
          response_format: { type: "json_object" }
        });
        const parsedRouter = JSON.parse(routerCompletion.choices[0].message.content);
        if (parsedRouter.tables && Array.isArray(parsedRouter.tables) && parsedRouter.tables.length > 0) {
          selectedTables = parsedRouter.tables;
        }
        console.log("[0.5] ROUTER SELECTED TABLES:", selectedTables);
      } catch(e) {
        console.log("[0.5] ROUTER ERROR (using fallback):", e.message);
      }
    }

    const selectedModels = models.filter(m => selectedTables.includes(m.dbName || m.name));
    if (selectedModels.length === 0) {
      selectedModels.push(...models.filter(m => ["messages", "outstandingar", "customers"].includes(m.dbName || m.name)));
    }

    const dynamicSchemaStr = selectedModels.map(m => {
      let str = `Table: ${m.dbName || m.name}\\nColumns:\\n`;
      m.fields.forEach(f => {
         str += `- ${f.dbName || f.name} (${f.type})\\n`;
      });
      return str;
    }).join('\n');

    // ==========================================
    // STEP 1: Natural Language to SQL
    // ==========================================
    const sqlGenerationSystemPrompt = `You are an automated PostgreSQL query generator. You have direct and full access to the database. Your ONLY job is to convert the user's question into a valid SQL SELECT query. 
Here is the schema:
${dynamicSchemaStr}
${securityRules}

INFO TAMBAHAN TENTANG PENGGUNA YANG BERTANYA SAAT INI:
- Role/Peran: ${userRole}
- Username/Nomor: ${identifier}
(Gunakan info di atas jika pengguna menanyakan tentang dirinya sendiri atau jika kamu butuh memfilter data berdasarkan pengirim).

RULES:
1. ONLY return the raw SQL string. Absolutely NO conversational text, NO "ganti menjadi", NO alternative queries.
2. NO explanations, NO markdown formatting, NO \`\`\`sql blocks. Stop immediately after the semicolon.
3. ONLY use SELECT statements.
4. When asked for AR/piutang/tagihan, use the "balance" column.
5. If your query results in an 'interval' data type (such as date differences or AGE()), you MUST cast it to a string (e.g., CAST(AGE(...) AS VARCHAR) or (CURRENT_DATE - duedate)::VARCHAR).
6. ALWAYS base your SQL on the LATEST user message. Use previous messages ONLY for context.
7. CRITICAL: If the user asks to modify the previous result (e.g., "sort it by name", "filter only X"), you MUST reconstruct the previous query logic as a Subquery or CTE, and apply the new modification on the outer query. DO NOT just write a simple query that loses the previous constraints!
8. STRICT RULES for SQL generation: If the user asks for data 'per store', 'totals', or 'top N', you MUST use the GROUP BY clause (e.g., GROUP BY kdcust, nmcust) and SUM(balance) as balance. ORDER BY the sum descending if asking for 'top'. Never return individual invoices if the user asks for a summary.
9. DO NOT invent or hallucinate column names. For credit limit, use old_cl and newcl. DO NOT use cl, new_cl, or limit. You MUST strictly use the columns defined in the schema!
10. IF the user asks for a specific customer or store, you MUST filter using WHERE nmcust ILIKE '%<NAME>%' OR kdcust = '<CODE>'. IF the user asks for a specific salesman, you MUST filter using WHERE nmsls ILIKE '%<NAME>%' OR kdsls = '<CODE>'. Do not guess that a customer is a channel.
11. IF the user mentions hypothetical values like "SO", "Order Baru", "Over Limit", or a specific SO amount (e.g., "nilai SO 11400000"), DO NOT include these values in your SQL WHERE clause. These values are used for the final analysis phase, not for filtering the database. ONLY filter by customer, salesman, or channel.
12. IF the user asks to check the customer table for a specific phone number (e.g. "085780444021" or "6285780444021"), YOU MUST query the "customers" table. Use the ILIKE operator with '%' to match the end of the number to ignore '0' or '62' prefixes. Example: WHERE phone ILIKE '%85780444021%'.
13. IF the user asks to analyze conversations, messages, or chats on a specific device, YOU MUST join the "messages" table with the "sessions" table on session_id, and filter by sessions.name (for device name).
13. IF the user asks to analyze a specific chat or group (e.g., "grup X", "kontak Y"), filter using messages.chat_name ILIKE '%<NAME>%' or sender/receiver. When extracting <NAME>, DO NOT include prefixes like "id", "group", "grup", or "chat" inside the ILIKE string. (e.g. for "group id Toko", use '%Toko%').
14. When querying messages for analysis, return sender, receiver, chat_name, message_body, and timestamp. ALWAYS ORDER BY timestamp ASC to maintain conversation flow. LIMIT the results to ${isPremium ? '500' : '150'} to prevent token overflow.
15. IF the user asks about "pesanan", "order", "beli", "pembelian", OR uses words like "periksa percakapan", "analisa percakapan", "percakapan", or "chat", YOU MUST query the "messages" table (not outstandingar) to find the conversation. Example: SELECT sender, receiver, chat_name, message_body, timestamp FROM messages WHERE DATE(timestamp) = '<DATE>' ORDER BY timestamp ASC LIMIT 150;
16. For data queries (e.g., top stores), IF the user asks for a specific limit (e.g. "200 toko"), use LIMIT up to ${isPremium ? '250' : '15'}. DO NOT exceed this maximum limit.
17. CRITICAL: DO NOT REFUSE. You are an automated SQL generator. You MUST generate the SQL query.
18. IMPORTANT FOR SUMMARIES: If the user asks you to "summarize" or "analyze" a conversation, DO NOT attempt to summarize it yet, and DO NOT say you don't have the data. Your ONLY job in this step is to write the SQL query to FETCH the data. Another system will do the summarizing later. Just output the SQL!
18. IMPORTANT FOR DATES: When extracting a year or month from a date, DO NOT output syntax like "extract"(...) which causes a column not found error. Use standard PostgreSQL functions correctly: EXTRACT(YEAR FROM tglpfi) or DATE_PART('year', tglpfi).
19. IMPORTANT FOR TIME COMPARISONS: If the user asks to compare data across different periods (e.g., this year vs last year), DO NOT use complex CROSS JOINs. Instead, write a single simple query with a GROUP BY (e.g., GROUP BY tahun, bulan) and use a WHERE clause to select both periods (e.g., WHERE tahun IN (2023, 2024)). Return the raw rows; the next system will format them.
20. PREFER PRE-AGGREGATED TABLES: For any question about monthly or yearly piutang, sales, or collection ratio summaries (e.g. "bandingkan piutang bulan ini dan tahun lalu"), ALWAYS prefer querying the rasiopiutangpersales table instead of outstandingar, as it is already pre-aggregated by tahun and bulan.
21. ANALISA KOMPLAIN CICILAN/AR DARI PERCAKAPAN (AR Dispute): Jika pengguna meminta analisa komplain cicilan atau piutang dari percakapan suatu device, buat query gabungan yang mencakup SEMUA langkah berikut dalam SATU query menggunakan CTE:
    (a) Ambil percakapan dari device yang disebutkan: SELECT m.sender, m.chat_name, m.message_body, m.timestamp FROM messages m JOIN sessions s ON m.session_id = s.session_id WHERE s.name ILIKE '%<device>%' AND m.timestamp >= NOW() - INTERVAL '<N> days' ORDER BY m.timestamp ASC LIMIT 200.
    (b) Dari sender di percakapan, cocokkan ke tabel contacts menggunakan: contacts.phone_number ILIKE '%<8-digit-akhir>%' OR contacts.real_phone_number ILIKE '%<8-digit-akhir>%'.
    (c) Jika contacts.kode_customer IS NOT NULL: gunakan kode_customer sebagai filter ke outstandingar.kdcust.
    (d) Jika contacts.kode_customer IS NULL atau tidak ada record di contacts: fallback ke customers WHERE customers.phone ILIKE '%<8-digit-akhir>%' untuk mendapatkan kdcust dan nmcust.
    (e) Query outstandingar WHERE kdcust = '<kdcust>' untuk menampilkan semua invoice aktif (nopfi, tglpfi, duedate, balance > 0).
    CONTOH QUERY AKHIR (gabungkan dalam satu WITH): WITH msgs AS (SELECT DISTINCT m.sender, m.chat_name, m.message_body, m.timestamp FROM messages m JOIN sessions s ON m.session_id = s.session_id WHERE s.name ILIKE '%OneTalk%' AND m.timestamp >= NOW() - INTERVAL '7 days' AND (m.message_body ILIKE '%cicilan%' OR m.message_body ILIKE '%tagihan%' OR m.message_body ILIKE '%piutang%') ORDER BY m.timestamp ASC LIMIT 100), cust_lookup AS (SELECT COALESCE(con.kode_customer, cus.kdcust) AS kdcust, COALESCE(cus.nmcust, con.name) AS nmcust, msgs.sender, msgs.chat_name, msgs.message_body, msgs.timestamp FROM msgs LEFT JOIN contacts con ON con.phone_number ILIKE '%' || RIGHT(REGEXP_REPLACE(msgs.sender, '@.*', ''), 10) || '%' OR con.real_phone_number ILIKE '%' || RIGHT(REGEXP_REPLACE(msgs.sender, '@.*', ''), 10) || '%' LEFT JOIN customers cus ON cus.phone ILIKE '%' || RIGHT(REGEXP_REPLACE(msgs.sender, '@.*', ''), 10) || '%') SELECT cl.kdcust, cl.nmcust, cl.sender, cl.chat_name, cl.timestamp, cl.message_body, ar.nopfi, ar.tglpfi, ar.duedate, ar.balance FROM cust_lookup cl LEFT JOIN outstandingar ar ON ar.kdcust = cl.kdcust AND ar.balance > 0 ORDER BY cl.timestamp ASC, ar.tglpfi DESC;
22. NORMALISASI NOMOR HP UNTUK MATCHING: Saat mencocokkan nomor HP dari messages.sender (format: '628xxx@s.whatsapp.net' atau '628xxx'), contacts.phone_number / contacts.real_phone_number, dan customers.phone (format: '08xx' atau '628xx'):
    SELALU gunakan RIGHT(REGEXP_REPLACE(sender_column, '@.*', ''), 10) untuk mengambil 10 digit terakhir nomor dari sender.
    Gunakan ILIKE '%' || RIGHT(...) || '%' untuk matching yang toleran terhadap variasi prefix '0' vs '62'.
    Jangan hardcode format nomor; gunakan RIGHT() untuk ambil digit terakhir secara dinamis.
23. ANALISA KOMPLAIN BARANG TIDAK DITERIMA (GR Dispute): Jika pengguna mencari komplain toko yang menyatakan tidak menerima barang padahal mendapat notifikasi penerimaan:
    (a) Query messages JOIN sessions untuk device yang disebutkan.
    (b) Filter message_body yang mengandung: ILIKE '%tidak terima%' OR ILIKE '%belum terima%' OR ILIKE '%tidak sampai%' OR ILIKE '%belum sampai%' OR ILIKE '%tidak menerima%'.
    (c) Dari sender pesan tersebut, lakukan lookup ke contacts (phone_number/real_phone_number) lalu ke customers (phone) untuk mendapatkan kdcust dan nmcust.
    (d) Query outstandingar WHERE kdcust = '<kdcust>' AND DATE(tglpfi) BETWEEN (MIN(timestamp_komplain) - INTERVAL '30 days') AND MAX(timestamp_komplain) untuk cek faktur yang mungkin terkait kiriman yang dikomplain.
24. CUSTOMER TANPA KODE DI CONTACTS (Fallback Wajib): Jika result dari join contacts tidak menghasilkan kode_customer (NULL), WAJIB sertakan kolom dari tabel customers dalam SELECT: customers.kdcust AS kdcust, customers.nmcust AS nmcust. Ini memastikan AI NLG selalu menerima identitas toko meski customer belum terdaftar di contacts dengan kode_customer.`;

    const sqlMessages = [
      { role: "system", content: sqlGenerationSystemPrompt },
      ...chatHistory.filter(m => m.role === 'user'),
      { role: "user", content: `${userMessage}\n\n[CRITICAL REMINDER: You MUST output ONLY a valid SQL SELECT query to fetch the requested data. DO NOT reply with conversational text. DO NOT refuse to read messages. Just give me the raw SQL.]` }
    ];

    const sqlCompletion = await openai.chat.completions.create({
      messages: sqlMessages,
      model: analyticalModel,
      temperature: 0,
      max_tokens: 2048,
    });

    let sqlString = sqlCompletion.choices[0]?.message?.content || "";
    sqlString = sqlString.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();

    // Safe fallback: Clean up markdown if the LLM hallucinates it despite instructions.
    if (sqlString.startsWith("```sql")) {
      sqlString = sqlString.replace(/^```sql/, '').replace(/```$/, '').trim();
    } else if (sqlString.startsWith("```")) {
      sqlString = sqlString.replace(/^```/, '').replace(/```$/, '').trim();
    }

    // Fallback regex to extract ONLY the SQL query if the AI hallucinated conversational text
    const sqlMatch = sqlString.match(/(?:SELECT|WITH)[\s\S]*?(?:;|$)/i);
    if (sqlMatch) {
      sqlString = sqlMatch[0];
    }

    console.log("GENERATED SQL:", sqlString);

    if (!sqlString) {
      return res.status(500).json({ message: "Failed to generate SQL query from the prompt." });
    }

    // ==========================================
    // STEP 2: Strict Security & Execution
    // ==========================================
    const forbiddenKeywords = ['DROP', 'DELETE', 'UPDATE', 'INSERT', 'ALTER', 'TRUNCATE', 'GRANT'];
    const sqlUpper = sqlString.toUpperCase();

    // Regex check for forbidden keywords
    const hasForbidden = forbiddenKeywords.some(keyword => {
      const regex = new RegExp(`\\b${keyword}\\b`, 'i');
      return regex.test(sqlUpper);
    });

    // Enforce that it's only a SELECT or WITH operation
    if (hasForbidden || !(sqlUpper.startsWith('SELECT') || sqlUpper.startsWith('WITH'))) {
      throw new Error("Unauthorized database operation detected");
    }

    let dbResult = null;
    let sqlExecutionError = null;
    try {
      dbResult = await prisma.$queryRawUnsafe(sqlString);
    } catch (error) {
      console.error("First DB Query Error:", error.message);
      sqlExecutionError = error.message;
    }

    // --- SELF CORRECTION LOOP ---
    if (sqlExecutionError) {
      console.log("Attempting SQL self-correction...");
      const correctionMessages = [
        ...sqlMessages,
        { role: "assistant", content: sqlString },
        { role: "user", content: `The SQL query failed with error: ${sqlExecutionError}\nFix the query using ONLY the provided schema columns. Return ONLY the raw corrected SQL string without any explanation or conversational text.` }
      ];
      const correctionCompletion = await openai.chat.completions.create({
        messages: correctionMessages,
        model: analyticalModel,
        temperature: 0.1,
        max_tokens: 2048
      });
      let correctedSqlString = correctionCompletion.choices[0]?.message?.content || "";
      correctedSqlString = correctedSqlString.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
      if (correctedSqlString.startsWith("```sql")) {
        correctedSqlString = correctedSqlString.replace(/^```sql/, '').replace(/```$/, '').trim();
      } else if (correctedSqlString.startsWith("```")) {
        correctedSqlString = correctedSqlString.replace(/^```/, '').replace(/```$/, '').trim();
      }
      const correctedSqlMatch = correctedSqlString.match(/(?:SELECT|WITH)[\s\S]*?(?:;|$)/i);
      if (correctedSqlMatch) {
        correctedSqlString = correctedSqlMatch[0];
      }
      console.log("CORRECTED SQL:", correctedSqlString);
      
      try {
        dbResult = await prisma.$queryRawUnsafe(correctedSqlString);
      } catch (finalError) {
        console.error("Final Database Query Error:", finalError);
        return res.status(500).json({ 
          message: "Failed to execute generated SQL query. The AI might have hallucinated a column.", 
          error: finalError.message 
        });
      }
    }

    // ==========================================
    // STEP 3: Natural Language Generation (NLG)
    // ==========================================
    const nlgSystemPrompt = `You are an expert Data Analyst & Business Intelligence Assistant. You are presenting data to the user.
${securityRules}
Rules for "chart":
You are a Professional Business Analyst. You will receive a User Question and a Database Result.
Your task is to provide the final response in JSON format.
You are strictly forbidden from writing Python code, Matplotlib code, ASCII art, or raw data tables if a chart is requested.

Output EXACTLY this JSON structure:
{
  "text": "Your textual explanation, analysis, and markdown tables. Keep it clear and natural.",
  "chart": {
    "type": "line", // or "bar", "pie"
    "data": [
      { "label": "Bulan 1", "value": 363307542 },
      { "label": "Bulan 2", "value": 645717489 }
    ],
    "xAxis": "label",
    "yAxis": "value"
  }
}

Rules for "chart":
- ONLY generate a chart if the user EXPLICITLY asks for a "grafik", "chart", "diagram", "visualisasi", or "plot".
- IF the Database Result has more than 20 rows, DO NOT generate a chart unless explicitly requested. Set "chart": null.
- IF the user asks for a "tabel" (table), DO NOT generate a chart. Set "chart": null.
- For "data", map the rows from the Database Result. Combine year and month if needed for the "label". Use the numeric amount for "value".
- If no chart is requested, set "chart": null.

Rules for "text":
- Provide a helpful, natural language summary and analysis answering the User's Question based on the Database Result.
- If the user asks for a table ("tabel"), you MUST present the data as a Markdown table in this "text" field.
- DO NOT attempt to recalculate, deduplicate, or fix the database JSON results. Present the data EXACTLY as provided.
- DO NOT include your internal monologue or reasoning (e.g., 'Ternyata ada duplikat, mari kita ganti...').
- CRITICAL FOR TABLES: Since you are outputting a JSON object, you MUST use explicit escaped newlines (\\n) at the end of EVERY markdown table row. Example: | Col 1 | Col 2 |\\n|---|---|\\n| Data | Data |
- If a chart is generated, you can still provide a short natural language summary in the "text" field explaining what the chart shows.
- ATURAN KETAT UNTUK TABEL: Jika Anda membuat tabel menggunakan Markdown, Anda WAJIB memberikan baris baru (ENTER / \\n) di setiap akhir baris tabel. Jangan pernah menggabungkan seluruh tabel ke dalam satu baris teks panjang.
- BATASAN TABEL: Jika Database Result memiliki sangat banyak baris (>\${isPremium ? '250' : '10'} baris), tampilkan HANYA \${isPremium ? '250' : '10'} baris pertama di tabel, dan tambahkan kalimat: "*Hanya menampilkan \${isPremium ? '250' : '10'} data teratas untuk efisiensi.*" \${isPremium ? 'Karena ini mode Premium, Anda BISA dan WAJIB menampilkan seluruh data yang diminta pengguna secara penuh hingga 250 baris di dalam tabel.' : ''}

ATURAN KHUSUS UNTUK ANALISA PERCAKAPAN (MESSAGES):
Jika Database Result berisi data percakapan (chat/messages), tugas Anda adalah menganalisa percakapan tersebut secara menyeluruh (seperti seorang CS/Admin). 
1. KONTEKS PESANAN BARANG: Jika pengguna menanyakan tentang "pesanan", "order", atau "beli", carilah indikasi transaksi seperti:
   - Penyebutan nama barang beserta jumlah/kuantitas (contoh: "1 dus", "2 pcs", "pelastik", "top es").
   - Pertanyaan ketersediaan ("ada ga", "ready") yang diikuti dengan pemesanan.
   - Konfirmasi pengiriman ("kiriman nya kapan").
   Bahkan jika tidak ada kata "pesan" secara eksplisit, jika konteksnya adalah meminta dikirimkan barang dengan jumlah tertentu, itu WAJIB DIHITUNG SEBAGAI PESANAN.
2. ALUR PERCAKAPAN & TANGGAL: Analisa kapan percakapan dimulai dan diakhiri berdasarkan urutan 'timestamp'. WAJIB GUNAKAN nilai dari kolom 'timestamp' sebagai 'Tanggal Pesan' atau tanggal kejadian sebenarnya. JANGAN MENGGUNAKAN tanggal yang tertulis di dalam teks 'message_body' jika berbeda dengan 'timestamp'.
3. KESIMPULAN: Jika ditanya apakah ada pesanan, jawab dengan tegas dan rincikan: siapa yang memesan (chat_name / sender), apa yang dipesan, dan ringkasan percakapannya. Gunakan bahasa natural.

ATURAN KHUSUS UNTUK ANALISA KOMPLAIN PERCAKAPAN (CICILAN / BARANG TIDAK DITERIMA):
Jika Database Result berisi kolom gabungan yang mencakup data percakapan (sender, message_body, chat_name, timestamp) SEKALIGUS data piutang (nopfi, tglpfi, duedate, balance) dan/atau data identitas toko (kdcust, nmcust), ini adalah skenario analisa komplain. WAJIB ikuti format template berikut:

SKENARIO 1 — Komplain Cicilan / AR Dispute (customer tidak mengakui cicilan/piutang):
Gunakan format ini PERSIS untuk setiap customer/toko yang terdeteksi komplain:

---
**📋 IDENTITAS TOKO**\\n
- **Nama Toko:** [nmcust dari kolom nmcust, atau chat_name jika nmcust NULL]\\n
- **Kode Toko (kdcust):** [kdcust] — jika NULL, tulis "Belum Terdaftar di Contacts" dan sebutkan kdcust dari tabel customers jika ada\\n
- **Nomor HP / ID Pengirim:** [sender atau chat_name dari pesan komplain]\\n
- **Sumber Data Identitas:** [tulis "Dari tabel contacts" ATAU "Dari lookup tabel customers berdasarkan nomor HP" sesuai asal data]\\n

**⚠️ DATA PIUTANG YANG DITEMUKAN**\\n
[Jika ada baris dengan nopfi tidak NULL]:
| No Faktur | Tanggal Faktur | Jatuh Tempo | Sisa Piutang |\\n
|-----------|----------------|-------------|--------------|\\n
| [nopfi]   | [tglpfi]       | [duedate]   | Rp [balance] |\\n
[Jika TIDAK ADA data piutang (semua balance NULL atau 0)]: Tulis "❌ Tidak ditemukan piutang aktif atas nama toko ini di sistem."\\n

**💡 KESIMPULAN ANALISA**\\n
[Jika ada piutang]: "✅ Komplain TIDAK VALID — Customer memiliki [N] faktur piutang aktif dengan total sisa Rp [total]. Notifikasi tagihan yang diterima customer SESUAI dengan data di sistem."\\n
[Jika tidak ada piutang]: "🔴 Komplain VALID — Tidak ada data piutang atas nama toko ini. Notifikasi yang dikirim kemungkinan SALAH SASARAN. Perlu investigasi lebih lanjut."\\n
---

SKENARIO 2 — Komplain Barang Tidak Diterima / GR Dispute:
Gunakan format ini untuk setiap toko yang mengirim komplain tidak terima barang:

---
**📋 IDENTITAS TOKO**\\n
- **Nama Toko:** [nmcust atau chat_name]\\n
- **Kode Toko (kdcust):** [kdcust] — jika NULL, sebutkan kdcust dari customers jika ditemukan\\n
- **Nomor HP / ID Pengirim:** [sender]\\n
- **Tanggal Komplain:** [timestamp dari pesan pertama yang berisi komplain]\\n

**📦 FAKTUR TERKAIT (±30 hari dari tanggal komplain)**\\n
[Jika ada faktur terkait]:
| No Faktur | Tanggal Faktur | Jatuh Tempo | Sisa Piutang |\\n
|-----------|----------------|-------------|--------------|\\n
| [nopfi]   | [tglpfi]       | [duedate]   | Rp [balance] |\\n
[Jika tidak ada faktur]: "❌ Tidak ada faktur tercatat pada periode terkait untuk toko ini."\\n

**💡 REKOMENDASI TINDAK LANJUT**\\n
"🔍 Perlu eskalasi ke tim gudang/pengiriman untuk konfirmasi apakah DO (Delivery Order) sudah ditandai 'diterima' di sistem secara akurat."\\n
---

PENTING: Jika Database Result mengandung BANYAK BARIS dengan sender yang berbeda-beda (multiple customers complain), buat satu blok analisa (---) untuk SETIAP sender unik yang berbeda. Kelompokkan dahulu berdasarkan sender/kdcust sebelum menulis analisa.



ATURAN KHUSUS UNTUK ANALISA CREDIT LIMIT (OCL):
LAKUKAN EVALUASI LOGIKA BERIKUT SECARA INTERNAL SEBELUM MENJAWAB:
JIKA pengguna memberikan nilai SO / Order Baru / OCL Khusus:
1. Bandingkan nilai {SO} dengan data {avgtrx} dari database.
2. Jika SO <= (avgtrx * 1.2): Order wajar (Kapasitas Sesuai).
3. Jika SO > (avgtrx * 1.5): Order ANOMALI / LONJAKAN (Risiko Spekulasi).
4. Tentukan Rekomendasi:
   - [DISETUJUI]: Order wajar DAN riwayat disiplin (tidak ada Red Flag).
   - [BERSYARAT - DP / LUNASI FAKTUR LAMA]: Order anomali TETAPI riwayat bayar disiplin.
   - [DITOLAK]: Riwayat buruk (ada Red Flag).
5. Hitung Simulasi: Over Limit = SO - old_cl. Sales (60%), SPV (20%), KA Bag (15%).

JIKA TIDAK ADA nilai SO / Order Baru:
- [DISETUJUI]: Tidak ada Red Flag dan avgtrx memadai.
- [DITAHAN / REJECT]: Ada Red Flag atau baddebt > 0.
- [BERSYARAT]: pola_cicil = PERNAH_CICIL tetapi avgtrx tinggi.

SETELAH MELAKUKAN EVALUASI DI ATAS, ANDA WAJIB MENJAWAB DENGAN TEMPLATE BERIKUT SECARA KETAT (Gunakan \\n\\n untuk baris baru):

Analisa Pengajuan Over Credit Limit: [nmcust] ([kdcust])\\n1. 📊 RINGKASAN PENGAJUAN\\n- Limit Berjalan (Old CL): Rp [old_cl]\\n- Usulan Baru (New CL) / SO: Rp [newcl / nilai SO]\\n- Rata-rata Transaksi (avgtrx): Rp [avgtrx]\\n- Sales / Channel: [nmsls] / [channel]\\n2. ⚠️ RAPOR PEMBAYARAN & RISIKO\\nToko ini memiliki rekam jejak pembayaran dengan risiko [TINGGI / MENENGAH / RENDAH]:\\n- Pola Pembayaran: [pola_ontime] dan [pola_cicil].\\n- Riwayat Keterlambatan: Terdapat [x] keterlambatan ringan (ovdontime), [x] ovd3n10, [x] ovd11n18, [x] ovd19n30, [x] ovdmt30, [x] baddebt.\\nCatatan Risiko: [Jelaskan apakah order ini wajar atau anomali berdasarkan rasio SO dan avgtrx, serta sebutkan Red Flag jika ada]\\n3. 💡 REKOMENDASI KEPUTUSAN AI\\n- [SEBUTKAN SATU KEPUTUSAN SAJA DARI HASIL EVALUASI]: [Berikan alasan singkat].\\nSIMULASI TANGGUNGAN RISIKO (Jika Keputusan Disetujui/Bersyarat, tuliskan nilai Rupiahnya. Jika Ditolak, tulis N/A):\\n- Tanggungan Sales (60%): Rp [nilai]\\n- Tanggungan SPV (20%): Rp [nilai]\\n- Tanggungan KA Bag (15%): Rp [nilai]`;

    // ==========================================
    // STEP 2.5: Optimize Data for Token Saving
    // ==========================================
    let stringifiedResult = "No data returned.";
    
    if (Array.isArray(dbResult) && dbResult.length > 0) {
      // 1. Dynamic Column Pruning: Remove columns where ALL values are null/empty
      let allKeys = Object.keys(dbResult[0]);
      const keysToDrop = allKeys.filter(key => {
        return dbResult.every(row => row[key] === null || row[key] === undefined || row[key] === '');
      });

      if (keysToDrop.length > 0) {
        dbResult = dbResult.map(row => {
          const newRow = { ...row };
          keysToDrop.forEach(k => delete newRow[k]);
          return newRow;
        });
        console.log(`[OPT] Dropped empty columns: ${keysToDrop.join(', ')}`);
        allKeys = allKeys.filter(key => !keysToDrop.includes(key));
      }

      // 2. Format to CSV instead of JSON to save tokens
      const csvHeaders = allKeys.join(',');
      const csvRows = dbResult.map(row => {
        return allKeys.map(header => {
          let val = row[header];
          if (val === null || val === undefined) return "";
          if (typeof val === 'bigint') return val.toString();
          if (val instanceof Date) return val.toISOString().split('T')[0];
          
          if (typeof val === 'number') {
            val = Math.round(val);
          } else if (val && typeof val.toNumber === 'function') {
            val = Math.round(val.toNumber());
          }
          
          let str = String(val).trim();
          if (str.includes(',') || str.includes('"') || str.includes('\n')) {
            str = '"' + str.replace(/"/g, '""') + '"';
          }
          return str;
        }).join(',');
      });
      stringifiedResult = [csvHeaders, ...csvRows].join('\n');
    } else if (dbResult && !Array.isArray(dbResult)) {
      stringifiedResult = JSON.stringify(dbResult, (key, value) =>
        typeof value === 'bigint' ? value.toString() : value
      );
    }

    // Prevent prompt from exceeding context limit
    // Increase limit significantly for Premium mode to allow large table rendering
    const maxResultChars = isPremium ? 40000 : 6000;
    if (stringifiedResult.length > maxResultChars) {
      stringifiedResult = stringifiedResult.substring(0, maxResultChars) + '\\n... [TRUNCATED DUE TO SIZE]';
    }

    console.log(`[2] DB QUERY RESULT (stringified, length ${stringifiedResult.length}):\n${stringifiedResult}`);

    const recentChatHistory = chatHistory.slice(-5); // Keep only last 5 messages to save context

    const nlgMessages = [
      { role: "system", content: nlgSystemPrompt },
      ...recentChatHistory,
      { 
        role: "user", 
        content: `User Question: ${userMessage}\n\nDatabase Result:\n${stringifiedResult}\n\nCRITICAL: Your output MUST be ONLY a valid JSON object. Start with '{' and end with '}'. Format: {"text": "...", "chart": {"type": "line", "data": [{"label": "...", "value": ...}], "xAxis": "label", "yAxis": "value"}}` 
      }
    ];

    const finalCompletion = await openai.chat.completions.create({
      messages: nlgMessages,
      model: model,
      temperature: 0.1, // lowered temperature for stricter JSON adherence
      max_tokens: isPremium ? 8192 : 1024,
      response_format: { type: "json_object" }
    });

    let finalAiText = finalCompletion.choices[0]?.message?.content || "{}";
    finalAiText = finalAiText.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
    console.log(`[3] RAW LLM JSON OUTPUT:\n${finalAiText}`);
    
    // Safely parse JSON by extracting the object
    let parsedResponse = { text: "Tidak ada respons dari AI.", chart: null };
    try {
      const firstBrace = finalAiText.indexOf('{');
      const lastBrace = finalAiText.lastIndexOf('}');
      if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
        const jsonString = finalAiText.substring(firstBrace, lastBrace + 1);
        parsedResponse = JSON.parse(jsonString);
      } else {
        parsedResponse.text = finalAiText;
      }
    } catch (e) {
      console.error("Failed to parse LLM JSON response:", finalAiText);
      // Fallback: Attempt to extract "text" manually if JSON is truncated due to token limits
      try {
        const textRegex = /"text"\s*:\s*"([\s\S]*)/;
        const match = finalAiText.match(textRegex);
        if (match && match[1]) {
          let ext = match[1];
          // Remove chart section if it started generating it
          const chartIdx = ext.indexOf('",\n  "chart"');
          if (chartIdx !== -1) ext = ext.substring(0, chartIdx);
          else {
            const chartIdx2 = ext.indexOf('","chart"');
            if (chartIdx2 !== -1) ext = ext.substring(0, chartIdx2);
          }
          // Remove trailing quotes if cut off
          ext = ext.replace(/"$/, '');
          // Unescape characters
          ext = ext.replace(/\\n/g, '\n').replace(/\\"/g, '"').replace(/\\\\/g, '\\');
          parsedResponse.text = ext + "\n\n*(Catatan: Respons terpotong karena batas maksimal teks AI).*";
        } else {
          parsedResponse.text = finalAiText;
        }
      } catch (fallbackErr) {
        parsedResponse.text = finalAiText; 
      }
    }

    // Fix Llama's tendency to output markdown tables improperly
    if (parsedResponse.text) {
      console.log(`[4] PARSED TEXT BEFORE REGEX:\n${parsedResponse.text}`);
      
      // 1. Break flattened rows into multiple lines
      // FIXED: The previous regex /\\|(\\s*)\\|/g broke valid empty cells like '| |'.
      // Changed to only break on exact '||' without spaces to be safer if Llama flattens tables.
      parsedResponse.text = parsedResponse.text.replace(/\|\|/g, "|\n|");
      
      // 2. Ensure a blank line exists before the table to satisfy remark-gfm parser
      // Matches a non-newline char, a single newline, the header row, and the delimiter row
      parsedResponse.text = parsedResponse.text.replace(/([^\n])\n(\|.*\|\n\|(?:\s*-+\s*\|)+)/g, "$1\n\n$2");

      console.log(`[5] PARSED TEXT AFTER REGEX:\n${parsedResponse.text}`);
    }
    console.log("================ BI CHAT TRACE END ================");

    recordLLMSuccess();
    // Return the final response
    return res.status(200).json({ reply: parsedResponse.text, chart: parsedResponse.chart });

  } catch (error) {
    console.error("Error in BI Chat processing:", error);
    
    // Catch the specific security error thrown manually
    if (error.message === "Unauthorized database operation detected") {
      return res.status(403).json({ 
        success: false,
        errorType: 'UNAUTHORIZED_QUERY',
        modelName: model,
        error: 'Akses Ditolak',
        details: 'Operasi database yang tidak sah terdeteksi.',
        action: 'RETRY'
      });
    }

    // Classify error for meaningful user-facing messages
    const status = error.status || error.code;
    const errMsg = (error.error?.message || error.message || '').toLowerCase();

    if (status === 402 || errMsg.includes('credit') || errMsg.includes('afford') || errMsg.includes('billing')) {
      recordRateLimit();
      return res.status(402).json({
        success: false,
        errorType: 'INSUFFICIENT_CREDITS',
        modelName: model,
        error: 'Saldo kredit OpenRouter tidak mencukupi',
        details: 'Akun OpenRouter Anda kehabisan kredit. Silakan top-up di openrouter.ai/settings/credits, atau pilih model AI gratis (tandai ":free") di pengaturan BI Analysis.',
        action: 'TOP_UP_OR_CHANGE_MODEL'
      });
    }

    if (status === 429 || errMsg.includes('rate limit') || errMsg.includes('too many requests') || errMsg.includes('ratelimit')) {
      recordRateLimit();
      return res.status(429).json({
        success: false,
        errorType: 'RATE_LIMIT',
        modelName: model,
        error: 'Terlalu banyak permintaan ke AI (Rate Limit)',
        details: 'Model AI sedang membatasi jumlah permintaan. Tunggu beberapa detik lalu coba lagi, atau pilih model AI yang berbeda di pengaturan BI Analysis.',
        action: 'RETRY_LATER'
      });
    }

    if (
      errMsg.includes('context') || errMsg.includes('token') ||
      errMsg.includes('max_tokens') || errMsg.includes('too long') ||
      errMsg.includes('length') || errMsg.includes('context_length_exceeded') ||
      status === 413 || status === 'context_length_exceeded'
    ) {
      return res.status(413).json({
        success: false,
        errorType: 'CONTEXT_TOO_LONG',
        modelName: model,
        error: 'Konteks atau percakapan terlalu panjang untuk model ini',
        details: 'Model AI tidak dapat memproses konteks sebanyak ini. Silakan pilih rentang pencarian yang lebih spesifik atau gunakan model dengan kapasitas konteks lebih besar.',
        action: 'REDUCE_CONTEXT'
      });
    }

    if (status === 401 || errMsg.includes('invalid api key') || errMsg.includes('unauthorized') || errMsg.includes('authentication')) {
      return res.status(401).json({
        success: false,
        errorType: 'INVALID_API_KEY',
        modelName: model,
        error: 'API Key OpenRouter tidak valid atau sudah kadaluarsa',
        details: 'Periksa kembali OPENROUTER_API_KEY di pengaturan server, atau buat API Key baru di openrouter.ai/settings/keys.',
        action: 'CHECK_API_KEY'
      });
    }

    // Generic error fallback
    console.error("Uncaught exception in BI Chat:", error.stack);
    return res.status(500).json({ 
      success: false,
      errorType: 'UNKNOWN',
      modelName: model,
      error: 'Terjadi kesalahan pada server saat memproses analisis',
      details: error.message || "Pastikan prompt atau instruksi sesuai.",
      action: 'RETRY'
    });
  }
};

module.exports = {
  handleBiChat
};
