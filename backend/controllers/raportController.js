const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');
const { getCompanyProfileString } = require('../utils/settingsHelper');
const { getModelForRole, openai } = require('../utils/Orchestrator');
const { recordRateLimit, recordLLMSuccess } = require('../chatbot/MemoryManager');

const prisma = new PrismaClient();
const UPLOADS_DIR = path.join(__dirname, '../uploads');

const generatePDF = async (reportData, filepath) => {
  const browser = await puppeteer.launch({ args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  const page = await browser.newPage();

  let scoresHtml = '';
  try {
    const scores = JSON.parse(reportData.scores);
    scoresHtml = scores.map(s => `
      <div class="score-card">
        <div class="score-header">
          <h3>${s.category}</h3>
          <span class="grade grade-${s.grade.charAt(0)}">${s.grade}</span>
        </div>
        <div class="score-bar">
          <div class="score-fill" style="width: ${s.score}%"></div>
        </div>
        <p>${s.description}</p>
      </div>
    `).join('');
  } catch (e) {
    console.error('Error parsing scores', e);
  }

  let redFlagsHtml = '';
  if (reportData.redFlagCount > 0 && reportData.redFlags) {
    redFlagsHtml = `
      <div class="red-flags-page">
        <h2>⚠️ RADAR ANOMALI & DETEKSI RISIKO</h2>
        <div class="red-flags-content">
          ${require('marked').parse(reportData.redFlags)}
        </div>
      </div>
    `;
  }

  let galleryHtml = '';
  if (reportData.gallery) {
    try {
      const gallery = JSON.parse(reportData.gallery);
      if (gallery.length > 0) {
        galleryHtml = `
          <div class="gallery-page">
            <h2>📸 Galeri Bukti Visual</h2>
            <div class="gallery-grid">
              ${gallery.map(img => {
                let imgData = '';
                try {
                  const imgPath = path.join(UPLOADS_DIR, path.basename(img.mediaUrl));
                  if (fs.existsSync(imgPath)) {
                    const ext = path.extname(imgPath).toLowerCase().replace('.', '');
                    const base64 = fs.readFileSync(imgPath).toString('base64');
                    imgData = `data:image/${ext};base64,${base64}`;
                  }
                } catch(err) {
                   console.error('Error reading image', err);
                }
                
                if(!imgData) return '';

                return `
                <div class="gallery-item">
                  <img src="${imgData}" alt="Evidence" />
                  <p class="caption">${img.caption}</p>
                  ${img.relatedSection ? `<span class="section-badge">${img.relatedSection}</span>` : ''}
                </div>
              `}).join('')}
            </div>
          </div>
        `;
      }
    } catch (e) {
      console.error('Error parsing gallery', e);
    }
  }

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="UTF-8">
        <style>
          @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap');
          body { font-family: 'Inter', sans-serif; color: #1e293b; margin: 0; padding: 0; }
          .page { padding: 40px; page-break-after: always; position: relative; min-height: 1040px; box-sizing: border-box; }
          .cover { background: linear-gradient(135deg, #1e1b4b 0%, #4338ca 100%); color: white; text-align: center; display: flex; flex-direction: column; justify-content: center; align-items: center; }
          .cover h1 { font-size: 48px; margin-bottom: 10px; letter-spacing: -1px; }
          .cover .meta { font-size: 18px; opacity: 0.8; margin-bottom: 40px; }
          .overall-grade { background: rgba(255,255,255,0.1); border: 2px solid rgba(255,255,255,0.2); border-radius: 50%; width: 200px; height: 200px; display: flex; flex-direction: column; justify-content: center; align-items: center; }
          .overall-grade .grade { font-size: 72px; font-weight: bold; line-height: 1; }
          .overall-grade .score { font-size: 20px; opacity: 0.9; margin-top: 10px; }
          
          h2 { color: #334155; border-bottom: 2px solid #e2e8f0; padding-bottom: 10px; margin-top: 0; }
          .stats-bar { display: flex; justify-content: space-between; background: #f8fafc; padding: 15px 20px; border-radius: 8px; margin-bottom: 30px; }
          .stat-item { text-align: center; }
          .stat-item .value { font-size: 24px; font-weight: bold; color: #4338ca; }
          .stat-item .label { font-size: 12px; color: #64748b; text-transform: uppercase; letter-spacing: 1px; }

          .score-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
          .score-card { background: white; border: 1px solid #e2e8f0; border-radius: 8px; padding: 15px; box-shadow: 0 1px 3px rgba(0,0,0,0.05); }
          .score-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; }
          .score-header h3 { margin: 0; font-size: 16px; color: #334155; }
          .grade { font-weight: bold; font-size: 20px; }
          .grade-A { color: #10b981; }
          .grade-B { color: #84cc16; }
          .grade-C { color: #eab308; }
          .grade-D { color: #f97316; }
          .grade-F { color: #ef4444; }
          .score-bar { height: 6px; background: #e2e8f0; border-radius: 3px; margin-bottom: 10px; overflow: hidden; }
          .score-fill { height: 100%; background: #4338ca; border-radius: 3px; }
          .score-card p { font-size: 13px; color: #64748b; margin: 0; line-height: 1.5; }

          .markdown-content { font-size: 14px; line-height: 1.6; color: #334155; }
          .markdown-content h3 { color: #1e293b; margin-top: 20px; }

          .red-flags-page { background: linear-gradient(to bottom, #fef2f2, #fff); border-top: 8px solid #ef4444; }
          .red-flags-page h2 { color: #b91c1c; border-bottom-color: #fca5a5; }
          .red-flags-content { font-size: 15px; color: #7f1d1d; }
          .red-flags-content ul li { margin-bottom: 10px; }

          .gallery-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
          .gallery-item { border: 1px solid #e2e8f0; border-radius: 8px; padding: 10px; background: white; text-align: center; }
          .gallery-item img { max-width: 100%; max-height: 250px; object-fit: contain; border-radius: 4px; }
          .gallery-item .caption { font-size: 13px; color: #475569; margin: 10px 0 5px; font-style: italic; }
          .section-badge { display: inline-block; background: #e2e8f0; color: #475569; font-size: 11px; padding: 2px 8px; border-radius: 12px; }
        </style>
      </head>
      <body>
        <div class="page cover">
          <h1>BUKU RAPORT</h1>
          <div class="meta">
            ${reportData.scope === 'chat' ? `Chat: ${reportData.contactName || reportData.contactNumber}` : `Device: ${reportData.session.name}`}<br/>
            Periode: ${reportData.date.toLocaleDateString('id-ID', { timeZone: 'Asia/Jakarta', weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}<br/>
            Dibuat: ${reportData.generatedAt.toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })}
          </div>
          <div class="overall-grade">
            <div class="grade">${reportData.overallGrade}</div>
            <div class="score">${reportData.overallScore} / 100</div>
          </div>
        </div>

        <div class="page">
          <h2>📊 Ringkasan Eksekutif</h2>
          <div class="stats-bar">
            <div class="stat-item">
              <div class="value">${reportData.totalMessages}</div>
              <div class="label">Total Pesan</div>
            </div>
            ${reportData.scope === 'device' ? `
            <div class="stat-item">
              <div class="value">${reportData.totalChats}</div>
              <div class="label">Unique Chats</div>
            </div>
            ` : ''}
            <div class="stat-item">
              <div class="value">${reportData.totalMediaFiles}</div>
              <div class="label">Media Files</div>
            </div>
          </div>
          
          <div class="markdown-content">
            ${require('marked').parse(reportData.summary)}
          </div>
          
          ${reportData.highlights ? `
          <h3 style="margin-top: 30px;">✨ Highlights</h3>
          <div class="markdown-content">
            ${require('marked').parse(reportData.highlights)}
          </div>
          ` : ''}

          <h2 style="margin-top: 40px;">🎯 Detail Penilaian</h2>
          <div class="score-grid">
            ${scoresHtml}
          </div>
        </div>

        ${redFlagsHtml}
        ${galleryHtml}
      </body>
    </html>
  `;

  await page.setContent(html, { waitUntil: 'networkidle0' });
  await page.pdf({ 
    path: filepath, 
    format: 'A4',
    printBackground: true
  });
  
  await browser.close();
};

const getRaports = async (req, res) => {
  try {
    const { sessionId, year, month, type, scope } = req.query;
    const userId = req.user.id;
    const role = req.user.role;
    
    let sessionFilter = {};
    if (role === 'USER') {
      const userSessions = await prisma.user.findUnique({
        where: { id: userId },
        include: { sessions: true }
      });
      const sessionIds = userSessions.sessions.map(s => s.sessionId);
      if (sessionId && !sessionIds.includes(sessionId)) {
        return res.status(403).json({ error: 'Unauthorized to view this session' });
      }
      sessionFilter = sessionId ? { sessionId } : { sessionId: { in: sessionIds } };
    } else {
      if (sessionId) sessionFilter = { sessionId };
    }

    let dateFilter = {};
    if (year && month) {
      const startDate = new Date(year, month - 1, 1);
      const endDate = new Date(year, month, 0, 23, 59, 59, 999);
      dateFilter = {
        date: { gte: startDate, lte: endDate }
      };
    }

    const filter = {
      ...sessionFilter,
      ...dateFilter,
    };
    if (type) filter.type = type;
    if (scope) filter.scope = scope;

    const reports = await prisma.reportCard.findMany({
      where: filter,
      orderBy: { date: 'desc' },
      select: {
        id: true,
        sessionId: true,
        type: true,
        scope: true,
        contactNumber: true,
        contactName: true,
        date: true,
        overallGrade: true,
        overallScore: true,
        redFlagCount: true,
        generatedAt: true,
        session: { select: { name: true } }
      }
    });

    res.json(reports);
  } catch (error) {
    console.error('Error fetching raport list:', error);
    res.status(500).json({ error: 'Failed to fetch raport list' });
  }
};

const getHeatmap = async (req, res) => {
  try {
    const { sessionId, year, type = 'daily', scope = 'device', contactNumber } = req.query;
    if (!sessionId || !year) {
      return res.status(400).json({ error: 'sessionId and year are required' });
    }

    const startDate = new Date(year, 0, 1);
    const endDate = new Date(year, 11, 31, 23, 59, 59, 999);

    let whereClause = {
      sessionId,
      type,
      scope,
      date: { gte: startDate, lte: endDate }
    };

    if (scope === 'chat' && contactNumber) {
      whereClause.contactNumber = { contains: contactNumber };
    }

    const reports = await prisma.reportCard.findMany({
      where: whereClause,
      select: {
        id: true,
        date: true,
        overallGrade: true,
        overallScore: true,
        redFlagCount: true
      }
    });

    const heatmapData = reports.map(r => ({
      id: r.id,
      date: r.date.toISOString().split('T')[0],
      grade: r.overallGrade,
      score: r.overallScore,
      redFlags: r.redFlagCount
    }));

    res.json(heatmapData);
  } catch (error) {
    console.error('Error fetching heatmap data:', error);
    res.status(500).json({ error: 'Failed to fetch heatmap data' });
  }
};

const getDetail = async (req, res) => {
  if (req.params.id === 'heatmap' || req.params.id === 'generate') return;
  try {
    const report = await prisma.reportCard.findUnique({
      where: { id: req.params.id },
      include: { session: true }
    });

    if (!report) return res.status(404).json({ error: 'Report not found' });

    res.json(report);
  } catch (error) {
    console.error('Error fetching raport detail:', error);
    res.status(500).json({ error: 'Failed to fetch raport detail' });
  }
};

const downloadPdf = async (req, res) => {
  try {
    const report = await prisma.reportCard.findUnique({
      where: { id: req.params.id }
    });

    if (!report || !report.pdfUrl) return res.status(404).json({ error: 'PDF not found' });

    const filepath = path.join(UPLOADS_DIR, path.basename(report.pdfUrl));
    if (!fs.existsSync(filepath)) return res.status(404).json({ error: 'PDF file not found on disk' });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="Raport_${report.sessionId}_${report.date.toISOString().split('T')[0]}.pdf"`);
    fs.createReadStream(filepath).pipe(res);
  } catch (error) {
    console.error('Error serving PDF:', error);
    res.status(500).json({ error: 'Failed to serve PDF' });
  }
};

const generateRaport = async (req, res) => {
  try {
    const { sessionId, type = 'daily', scope = 'device', contactNumber = null, date } = req.body;
    
    if (!sessionId) return res.status(400).json({ error: 'sessionId is required' });

    const targetDate = date ? new Date(date) : new Date();
    const startWib = new Date(targetDate.getTime());
    const endWib = new Date(targetDate.getTime());
    
    if (type === 'daily') {
      startWib.setUTCHours(0, 0, 0, 0);
      endWib.setUTCHours(23, 59, 59, 999);
    } else if (type === 'weekly') {
      const day = startWib.getUTCDay();
      const diff = startWib.getUTCDate() - day + (day === 0 ? -6 : 1); 
      startWib.setUTCDate(diff);
      startWib.setUTCHours(0, 0, 0, 0);
      endWib.setUTCDate(diff + 6);
      endWib.setUTCHours(23, 59, 59, 999);
    }

    const start = new Date(startWib.getTime() - 7 * 3600 * 1000);
    const end = new Date(endWib.getTime() - 7 * 3600 * 1000);

    const messageWhere = {
      sessionId,
      isStatus: false,
      timestamp: { gte: start, lte: end }
    };
    
    if (scope === 'chat' && contactNumber) {
       messageWhere.OR = [
         { sender: contactNumber },
         { receiver: contactNumber }
       ];
    }

    if (scope === 'device') {
      const exclusions = await prisma.excludedChat.findMany({ where: { sessionId } });
      const excludedIds = exclusions.map(e => e.chatId.split('@')[0]);
      if (excludedIds.length > 0) {
        messageWhere.AND = [
          { sender: { notIn: excludedIds } },
          { receiver: { notIn: excludedIds } }
        ];
      }
    }

    const messages = await prisma.message.findMany({
      where: messageWhere,
      orderBy: { timestamp: 'asc' }
    });

    if (messages.length === 0) {
      return res.status(400).json({ error: 'No messages found for this period to analyze.' });
    }

    const totalMessages = messages.length;
    const uniqueChats = new Set();
    let totalMediaFiles = 0;
    const recentImageIds = new Set();
    const mediaUrls = [];
    
    for (const msg of messages) {
      if (msg.sender !== 'Me') uniqueChats.add(msg.sender);
      if (msg.receiver !== 'Me' && msg.receiver !== sessionId) uniqueChats.add(msg.receiver);
      
      if (msg.mediaUrl) {
        totalMediaFiles++;
        if (msg.mediaType && (msg.mediaType === 'image/jpeg' || msg.mediaType === 'image/png')) {
          const filename = path.basename(msg.mediaUrl);
          const filePath = path.join(UPLOADS_DIR, filename);
          if (fs.existsSync(filePath)) {
            recentImageIds.add(msg.id);
            mediaUrls.push({ id: msg.id, url: msg.mediaUrl, localPath: filePath });
          }
        }
      }
    }

    let transcriptLines = [];
    let imageContents = [];
    let attachedImageUrls = [];
    
    const maxMessages = 200;
    const msgsToProcess = messages.length > maxMessages ? messages.slice(-maxMessages) : messages;

    let imgIdx = 0;
    for (const msg of msgsToProcess) {
      const person = msg.isFromMe ? 'Me' : (msg.authorName || msg.sender);
      let text = `${person}: ${msg.messageBody}`;

      if (msg.mediaUrl && recentImageIds.has(msg.id)) {
          if (imageContents.length < 5) {
            try {
              const filePath = mediaUrls.find(m => m.id === msg.id).localPath;
              const imageBuffer = fs.readFileSync(filePath);
              const base64Image = imageBuffer.toString('base64');
              imageContents.push({
                type: 'image_url',
                image_url: { url: `data:${msg.mediaType};base64,${base64Image}` }
              });
              attachedImageUrls.push(msg.mediaUrl);
              text += `\n[Image Attached: img_index_${imgIdx}]`;
              imgIdx++;
            } catch (e) {
              console.error('Error attaching image', e);
            }
          } else {
             text += `\n[Image omitted (limit reached)]`;
          }
      }
      transcriptLines.push(text);
    }
    
    const transcript = transcriptLines.join('\n');

    const dictionaries = await prisma.dictionary.findMany();
    let dictionaryContext = "";
    if (dictionaries.length > 0) {
      dictionaryContext = "Here is the business jargon dictionary that you MUST use to understand the context:\n";
      dictionaries.forEach(d => {
        dictionaryContext += `- ${d.term}: ${d.definition}\n`;
      });
      dictionaryContext += "\n";
    }

    const analyticalModel = await getModelForRole('ANALYTICAL');

    const promptText = `Kamu adalah auditor bisnis profesional. Analisa transkrip chat WhatsApp berikut dan buat JURNAL ANALISA (BUKU RAPORT) dengan format JSON yang KETAT.

TUGAS:
1. Berikan NILAI RAPORT (A, A-, B+, B, B-, C+, C, C-, D, atau F) untuk setiap kategori berikut, dan sertakan skor angka (0-100) dan deskripsi singkat (max 2 kalimat):
   - Kualitas Respon: Seberapa lengkap dan informatif balasan CS
   - Sentimen Pelanggan: Tingkat kepuasan pelanggan dari nada chat
   - Kecepatan Penanganan: Seberapa cepat masalah ditangani (estimasi dari flow percakapan)
   - Profesionalisme: Bahasa, etika, dan sikap dalam chat
   - Kelengkapan Informasi: Apakah info harga/stok/pengiriman diberikan lengkap

2. Hitung overallGrade (huruf) dan overallScore (0-100) berdasarkan rata-rata kategori di atas.

3. Tulis RINGKASAN EKSEKUTIF (summary) 3-5 paragraf dalam Markdown.
4. Tulis highlights (hal-hal positif utama) dalam Markdown.

5. Deteksi RED FLAGS (Anomali/Risiko) dan tulis dalam Markdown. Jika tidak ada, isi null. Indikator:
   - Indikasi penipuan/fraud
   - Komplain tingkat tinggi (pelanggan marah)
   - Pembatalan pesanan (cancel order) 
   - Janji yang tidak ditepati
   - Informasi harga/stok yang inkonsisten
   Hitung jumlah red flag yang ditemukan (redFlagCount).

6. Jika ada gambar yang di-attach (img_index_X), buatkan caption untuk gambar tersebut berdasarkan konteks percakapan di sekitarnya.

FORMAT OUTPUT (HARUS JSON MURNI TANPA MARKDOWN BACKTICKS DI LUAR):
{
  "overallGrade": "B+",
  "overallScore": 78,
  "scores": [
    {"category": "Kualitas Respon", "grade": "A", "score": 90, "description": "..."},
    {"category": "Sentimen Pelanggan", "grade": "B", "score": 75, "description": "..."}
  ],
  "summary": "markdown text...",
  "highlights": "markdown text...",
  "redFlags": "markdown text atau null",
  "redFlagCount": 2,
  "galleryCaptions": [
    {"imageIndex": 0, "caption": "Bukti PO disetujui", "relatedSection": "Transaksi"}
  ]
}

${dictionaryContext}
Konteks: Ini adalah kumpulan pesan dari ${scope === 'device' ? 'berbagai kontak' : 'satu pelanggan'}. Total ${totalMessages} pesan diproses.
TRANSKIP CHAT:
${transcript}`;

    const groqContent = [
      { type: 'text', text: promptText },
      ...imageContents
    ];

    let visionModel = 'openai/gpt-4o-mini';
    try {
      const setting = await prisma.appSetting.findUnique({ where: { key: 'default_ai_model' } });
      if (setting && setting.value) {
        if (!setting.value.includes('llama') && !setting.value.includes('nemotron')) {
          visionModel = setting.value;
        }
      }
    } catch (e) {
      console.error("Failed to fetch default AI model in raport", e);
    }

    const chatCompletion = await openai.chat.completions.create({
      messages: [{ role: 'user', content: groqContent }],
      model: analyticalModel,
      response_format: { type: "json_object" }
    });
    recordLLMSuccess();

    let aiResponseText = chatCompletion.choices[0]?.message?.content || "{}";
    aiResponseText = aiResponseText.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
    let aiData;
    try {
       aiData = JSON.parse(aiResponseText);
    } catch(e) {
       console.error("Failed to parse JSON from AI", aiResponseText);
       return res.status(500).json({ error: 'AI did not return valid JSON' });
    }

    const gallery = [];
    if (aiData.galleryCaptions && Array.isArray(aiData.galleryCaptions)) {
      for (const item of aiData.galleryCaptions) {
         if (item.imageIndex !== undefined && item.imageIndex >= 0 && item.imageIndex < attachedImageUrls.length) {
            gallery.push({
               mediaUrl: attachedImageUrls[item.imageIndex],
               caption: item.caption,
               relatedSection: item.relatedSection
            });
         }
      }
    }

    let processedRedFlags = aiData.redFlags;
    if (Array.isArray(processedRedFlags)) {
      processedRedFlags = processedRedFlags.map(f => `- ${f}`).join('\n');
    } else if (typeof processedRedFlags === 'object' && processedRedFlags !== null) {
      processedRedFlags = JSON.stringify(processedRedFlags);
    } else if (typeof processedRedFlags !== 'string') {
      processedRedFlags = null;
    }

    const reportRecord = await prisma.reportCard.upsert({
      where: {
        sessionId_type_scope_date_contactNumber: {
          sessionId,
          type,
          scope,
          date: startWib,
          contactNumber: contactNumber || ''
        }
      },
      update: {
        overallGrade: aiData.overallGrade || 'C',
        overallScore: aiData.overallScore || 0,
        scores: JSON.stringify(aiData.scores || []),
        summary: aiData.summary || '',
        highlights: aiData.highlights || '',
        redFlags: processedRedFlags,
        redFlagCount: aiData.redFlagCount || 0,
        gallery: JSON.stringify(gallery),
        totalMessages,
        totalChats: uniqueChats.size,
        totalMediaFiles,
        generatedAt: new Date()
      },
      create: {
        sessionId,
        type,
        scope,
        contactNumber: contactNumber || '',
        contactName: null,
        date: startWib,
        overallGrade: aiData.overallGrade || 'C',
        overallScore: aiData.overallScore || 0,
        scores: JSON.stringify(aiData.scores || []),
        summary: aiData.summary || '',
        highlights: aiData.highlights || '',
        redFlags: processedRedFlags,
        redFlagCount: aiData.redFlagCount || 0,
        gallery: JSON.stringify(gallery),
        totalMessages,
        totalChats: uniqueChats.size,
        totalMediaFiles
      },
      include: { session: true }
    });

    const filename = `Raport_${reportRecord.id}_${Date.now()}.pdf`;
    const filepath = path.join(UPLOADS_DIR, filename);
    await generatePDF(reportRecord, filepath);

    const updatedRecord = await prisma.reportCard.update({
      where: { id: reportRecord.id },
      data: { pdfUrl: `/uploads/${filename}` },
      include: { session: true }
    });

    res.json(updatedRecord);
  } catch (error) {
    console.error('Error generating raport:', error);
    
    const errMsg = (error.error?.message || error.message || '').toLowerCase();
    const status = error.status || error.code;
    
    if (status === 429 || errMsg.includes('rate limit')) {
      recordRateLimit();
      return res.status(429).json({ error: 'Rate limit AI tercapai. Silakan coba lagi nanti.' });
    }
    if (status === 402 || errMsg.includes('credit') || errMsg.includes('billing')) {
      recordRateLimit();
      return res.status(402).json({ error: 'Saldo kredit AI (OpenRouter) tidak mencukupi.' });
    }
    
    res.status(500).json({ error: 'Failed to generate raport' });
  }
};

const deleteRaport = async (req, res) => {
  try {
    if (req.user.role === 'USER') {
      return res.status(403).json({ error: 'Unauthorized to delete reports' });
    }

    const report = await prisma.reportCard.findUnique({ where: { id: req.params.id } });
    if (!report) return res.status(404).json({ error: 'Report not found' });

    if (report.pdfUrl) {
      const filepath = path.join(UPLOADS_DIR, path.basename(report.pdfUrl));
      if (fs.existsSync(filepath)) fs.unlinkSync(filepath);
    }

    await prisma.reportCard.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting raport:', error);
    res.status(500).json({ error: 'Failed to delete raport' });
  }
};

module.exports = {
  getRaports,
  getHeatmap,
  getDetail,
  downloadPdf,
  generateRaport,
  deleteRaport
};
