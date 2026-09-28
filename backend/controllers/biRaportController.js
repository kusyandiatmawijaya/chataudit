const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');
const { getCompanyProfileString } = require('../utils/settingsHelper');
const { getModelForRole, openai } = require('../utils/Orchestrator');
const { recordRateLimit, recordLLMSuccess } = require('../chatbot/MemoryManager');

const prisma = new PrismaClient();
const UPLOADS_DIR = path.join(__dirname, '../uploads');

// Helper: generate PDF for BI Report
const generateBIPdf = async (reportData, filepath) => {
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
    console.error('Error parsing BI scores for PDF', e);
  }

  let redFlagsHtml = '';
  if (reportData.redFlagCount > 0 && reportData.redFlags) {
    redFlagsHtml = `
      <div class="page red-flags-page">
        <h2>⚠️ RADAR ANOMALI & DETEKSI RISIKO</h2>
        <div class="red-flags-content">
          ${require('marked').parse(reportData.redFlags)}
        </div>
      </div>
    `;
  }

  const scopeLabel = reportData.scope === 'all' ? 'Keseluruhan Bisnis'
    : reportData.scope === 'salesman' ? `Salesman: ${reportData.scopeName || reportData.scopeFilter}`
    : `Customer: ${reportData.scopeName || reportData.scopeFilter}`;

  const fmtCurrency = (v) => `Rp ${Number(v || 0).toLocaleString('id-ID')}`;

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="UTF-8">
        <style>
          @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap');
          body { font-family: 'Inter', sans-serif; color: #1e293b; margin: 0; padding: 0; }
          .page { padding: 40px; page-break-after: always; position: relative; min-height: 1040px; box-sizing: border-box; }
          .cover { background: linear-gradient(135deg, #0f172a 0%, #0e7490 100%); color: white; text-align: center; display: flex; flex-direction: column; justify-content: center; align-items: center; }
          .cover h1 { font-size: 44px; margin-bottom: 10px; letter-spacing: -1px; }
          .cover .subtitle { font-size: 20px; opacity: 0.9; margin-bottom: 5px; }
          .cover .meta { font-size: 16px; opacity: 0.7; margin-bottom: 40px; }
          .overall-grade { background: rgba(255,255,255,0.1); border: 2px solid rgba(255,255,255,0.2); border-radius: 50%; width: 200px; height: 200px; display: flex; flex-direction: column; justify-content: center; align-items: center; }
          .overall-grade .grade { font-size: 72px; font-weight: bold; line-height: 1; }
          .overall-grade .score { font-size: 20px; opacity: 0.9; margin-top: 10px; }
          
          h2 { color: #0e7490; border-bottom: 2px solid #e2e8f0; padding-bottom: 10px; margin-top: 0; }
          .stats-bar { display: flex; justify-content: space-between; background: #f0fdfa; padding: 15px 20px; border-radius: 8px; margin-bottom: 30px; flex-wrap: wrap; gap: 10px; }
          .stat-item { text-align: center; flex: 1; min-width: 100px; }
          .stat-item .value { font-size: 20px; font-weight: bold; color: #0e7490; }
          .stat-item .label { font-size: 11px; color: #64748b; text-transform: uppercase; letter-spacing: 1px; }

          .score-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
          .score-card { background: white; border: 1px solid #e2e8f0; border-radius: 8px; padding: 15px; box-shadow: 0 1px 3px rgba(0,0,0,0.05); }
          .score-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; }
          .score-header h3 { margin: 0; font-size: 15px; color: #334155; }
          .grade { font-weight: bold; font-size: 20px; }
          .grade-A { color: #10b981; }
          .grade-B { color: #84cc16; }
          .grade-C { color: #eab308; }
          .grade-D { color: #f97316; }
          .grade-F { color: #ef4444; }
          .score-bar { height: 6px; background: #e2e8f0; border-radius: 3px; margin-bottom: 10px; overflow: hidden; }
          .score-fill { height: 100%; background: #0e7490; border-radius: 3px; }
          .score-card p { font-size: 13px; color: #64748b; margin: 0; line-height: 1.5; }

          .markdown-content { font-size: 14px; line-height: 1.6; color: #334155; }
          .markdown-content h3 { color: #1e293b; margin-top: 20px; }

          .red-flags-page { background: linear-gradient(to bottom, #fef2f2, #fff); border-top: 8px solid #ef4444; }
          .red-flags-page h2 { color: #b91c1c; border-bottom-color: #fca5a5; }
          .red-flags-content { font-size: 15px; color: #7f1d1d; }
          .red-flags-content ul li { margin-bottom: 10px; }
        </style>
      </head>
      <body>
        <div class="page cover">
          <h1>BUKU RAPORT BI</h1>
          <div class="subtitle">${scopeLabel}</div>
          <div class="meta">
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
              <div class="value">${fmtCurrency(reportData.totalAR)}</div>
              <div class="label">Total AR</div>
            </div>
            <div class="stat-item">
              <div class="value">${fmtCurrency(reportData.totalBalance)}</div>
              <div class="label">Sisa Piutang</div>
            </div>
            <div class="stat-item">
              <div class="value">${reportData.totalInvoices}</div>
              <div class="label">Faktur</div>
            </div>
            <div class="stat-item">
              <div class="value">${reportData.totalCustomers}</div>
              <div class="label">Customer</div>
            </div>
            <div class="stat-item">
              <div class="value">${reportData.overdueCount}</div>
              <div class="label">Overdue</div>
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
      </body>
    </html>
  `;

  await page.setContent(html, { waitUntil: 'networkidle0' });
  await page.pdf({ path: filepath, format: 'A4', printBackground: true });
  await browser.close();
};

const getReports = async (req, res) => {
  try {
    const { year, scope, type } = req.query;

    let dateFilter = {};
    if (year) {
      const startDate = new Date(year, 0, 1);
      const endDate = new Date(year, 11, 31, 23, 59, 59, 999);
      dateFilter = { date: { gte: startDate, lte: endDate } };
    }

    const filter = { ...dateFilter };
    if (type) filter.type = type;
    if (scope) filter.scope = scope;

    const reports = await prisma.bIReportCard.findMany({
      where: filter,
      orderBy: { date: 'desc' },
      select: {
        id: true,
        type: true,
        scope: true,
        scopeFilter: true,
        scopeName: true,
        date: true,
        overallGrade: true,
        overallScore: true,
        redFlagCount: true,
        totalBalance: true,
        totalInvoices: true,
        overdueCount: true,
        generatedAt: true,
      }
    });

    res.json(reports);
  } catch (error) {
    console.error('Error fetching BI raport list:', error);
    res.status(500).json({ error: 'Failed to fetch BI raport list' });
  }
};

const getHeatmap = async (req, res) => {
  try {
    const { year, type = 'daily', scope = 'all', scopeFilter } = req.query;
    if (!year) return res.status(400).json({ error: 'year is required' });

    const startDate = new Date(year, 0, 1);
    const endDate = new Date(year, 11, 31, 23, 59, 59, 999);

    let whereClause = {
      type,
      scope,
      date: { gte: startDate, lte: endDate }
    };

    if (scope !== 'all' && scopeFilter) {
      whereClause.scopeFilter = scopeFilter;
    }

    const reports = await prisma.bIReportCard.findMany({
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
    console.error('Error fetching BI heatmap data:', error);
    res.status(500).json({ error: 'Failed to fetch BI heatmap data' });
  }
};

const getSalesmen = async (req, res) => {
  try {
    const result = await prisma.$queryRaw`
      SELECT DISTINCT kdsls, nmsls FROM outstandingar 
      WHERE kdsls IS NOT NULL AND nmsls IS NOT NULL 
      ORDER BY nmsls ASC
    `;
    res.json(result);
  } catch (error) {
    console.error('Error fetching salesmen:', error);
    res.status(500).json({ error: 'Failed to fetch salesmen list' });
  }
};

const getCustomers = async (req, res) => {
  try {
    const result = await prisma.$queryRaw`
      SELECT DISTINCT kdcust, nmcust FROM outstandingar 
      WHERE kdcust IS NOT NULL AND nmcust IS NOT NULL 
      ORDER BY nmcust ASC
      LIMIT 500
    `;
    res.json(result);
  } catch (error) {
    console.error('Error fetching customers:', error);
    res.status(500).json({ error: 'Failed to fetch customers list' });
  }
};

const getDetail = async (req, res) => {
  if (['heatmap', 'generate', 'salesmen', 'customers'].includes(req.params.id)) return;
  try {
    const report = await prisma.bIReportCard.findUnique({
      where: { id: req.params.id }
    });
    if (!report) return res.status(404).json({ error: 'BI Report not found' });
    res.json(report);
  } catch (error) {
    console.error('Error fetching BI raport detail:', error);
    res.status(500).json({ error: 'Failed to fetch BI raport detail' });
  }
};

const generateReport = async (req, res) => {
  try {
    const { type = 'daily', scope = 'all', scopeFilter = null, date } = req.body;

    const targetDate = date ? new Date(date) : new Date();
    targetDate.setUTCHours(0, 0, 0, 0);

    // --- 1. Gather AR data ---
    let arWhere = {};
    let oclWhere = {};
    let scopeName = null;

    if (scope === 'salesman' && scopeFilter) {
      arWhere = { kdsls: scopeFilter };
      oclWhere = { kdsls: scopeFilter };
      // Get salesman name
      const s = await prisma.outstandingAr.findFirst({ where: { kdsls: scopeFilter }, select: { nmsls: true } });
      scopeName = s?.nmsls || scopeFilter;
    } else if (scope === 'customer' && scopeFilter) {
      arWhere = { kdcust: scopeFilter };
      oclWhere = { kdcust: scopeFilter };
      const c = await prisma.outstandingAr.findFirst({ where: { kdcust: scopeFilter }, select: { nmcust: true } });
      scopeName = c?.nmcust || scopeFilter;
    }

    const arData = await prisma.outstandingAr.findMany({ where: arWhere });
    const oclData = await prisma.analisaCreditLimit.findMany({ where: oclWhere });

    if (arData.length === 0 && oclData.length === 0) {
      return res.status(400).json({ error: 'No AR/OCL data found for this scope to analyze.' });
    }

    // --- 2. Calculate stats ---
    let totalAR = 0, totalPaid = 0, totalBalance = 0, overdueCount = 0;
    const customerSet = new Set();
    const now = new Date();

    for (const inv of arData) {
      totalAR += inv.amount || 0;
      totalPaid += inv.paid || 0;
      totalBalance += inv.balance || 0;
      if (inv.kdcust) customerSet.add(inv.kdcust);
      if (inv.duedate && new Date(inv.duedate) < now && (inv.balance || 0) > 0) {
        overdueCount++;
      }
    }

    const totalInvoices = arData.length;
    const totalCustomers = customerSet.size;

    // --- 3. Build data summary for AI ---
    // AR summary (top 30 by balance)
    const topAR = arData
      .filter(a => (a.balance || 0) > 0)
      .sort((a, b) => (b.balance || 0) - (a.balance || 0))
      .slice(0, 30);

    let arSummaryText = 'TOP 30 OUTSTANDING AR (by balance desc):\n';
    arSummaryText += 'NoFaktur | Customer | Kode | Salesman | Amount | Paid | Balance | DueDate\n';
    for (const a of topAR) {
      arSummaryText += `${a.nopfi} | ${a.nmcust} | ${a.kdcust} | ${a.nmsls} | ${a.amount} | ${a.paid} | ${a.balance} | ${a.duedate ? a.duedate.toISOString().split('T')[0] : 'N/A'}\n`;
    }

    // OCL summary (all or top 30)
    const oclSlice = oclData.slice(0, 30);
    let oclSummaryText = '\nCREDIT LIMIT ANALYSIS DATA (top 30):\n';
    oclSummaryText += 'Customer | Kode | Salesman | OldCL | NewCL | AvgTrx | PolaOntime | PolaCicil | OVDOntime | OVD3-10 | OVD11-18 | OVD19-30 | OVD>30 | BadDebt | Channel\n';
    for (const o of oclSlice) {
      oclSummaryText += `${o.nmcust} | ${o.kdcust} | ${o.nmsls} | ${o.old_cl} | ${o.newcl} | ${o.avgtrx} | ${o.pola_ontime} | ${o.pola_cicil} | ${o.ovdontime} | ${o.ovd3n10} | ${o.ovd11n18} | ${o.ovd19n30} | ${o.ovdmt30} | ${o.baddebt} | ${o.channel}\n`;
    }

    // Aggregate stats
    let aggregateText = `\nAGGREGATE STATS:\n`;
    aggregateText += `Total Invoices: ${totalInvoices}\n`;
    aggregateText += `Total Customers: ${totalCustomers}\n`;
    aggregateText += `Total AR (amount): Rp ${totalAR.toLocaleString('id-ID')}\n`;
    aggregateText += `Total Paid: Rp ${totalPaid.toLocaleString('id-ID')}\n`;
    aggregateText += `Total Balance (sisa piutang): Rp ${totalBalance.toLocaleString('id-ID')}\n`;
    aggregateText += `Overdue Invoices (past due date): ${overdueCount}\n`;
    aggregateText += `Collection Rate: ${totalAR > 0 ? ((totalPaid / totalAR) * 100).toFixed(1) : 0}%\n`;

    // OVD aggregate from OCL data
    if (oclData.length > 0) {
      let sumOvdOntime = 0, sumOvd3n10 = 0, sumOvd11n18 = 0, sumOvd19n30 = 0, sumOvdmt30 = 0, sumBaddebt = 0;
      for (const o of oclData) {
        sumOvdOntime += o.ovdontime || 0;
        sumOvd3n10 += o.ovd3n10 || 0;
        sumOvd11n18 += o.ovd11n18 || 0;
        sumOvd19n30 += o.ovd19n30 || 0;
        sumOvdmt30 += o.ovdmt30 || 0;
        sumBaddebt += o.baddebt || 0;
      }
      aggregateText += `\nOVD DISTRIBUTION (from OCL data, ${oclData.length} records):\n`;
      aggregateText += `OVD On-time (1-2d): ${sumOvdOntime}\n`;
      aggregateText += `OVD 3-10d: ${sumOvd3n10}\n`;
      aggregateText += `OVD 11-18d: ${sumOvd11n18}\n`;
      aggregateText += `OVD 19-30d: ${sumOvd19n30}\n`;
      aggregateText += `OVD >30d: ${sumOvdmt30}\n`;
      aggregateText += `Bad Debt: ${sumBaddebt}\n`;
    }

    // --- 4. Dictionary context ---
    const dictionaries = await prisma.dictionary.findMany();
    let dictionaryContext = '';
    if (dictionaries.length > 0) {
      dictionaryContext = 'Business jargon dictionary:\n';
      dictionaries.forEach(d => { dictionaryContext += `- ${d.term}: ${d.definition}\n`; });
      dictionaryContext += '\n';
    }

    // --- 5. AI prompt ---
    const scopeLabelStr = scope === 'all' ? 'keseluruhan bisnis'
      : scope === 'salesman' ? `salesman ${scopeName || scopeFilter}`
      : `customer/toko ${scopeName || scopeFilter}`;

    const companyProfileStr = await getCompanyProfileString();
    const promptText = `Kamu adalah Business Intelligence Analyst profesional.

${companyProfileStr}

Analisa data Outstanding AR dan Credit Limit berikut dan buat JURNAL ANALISA BI (BUKU RAPORT BI) dengan format JSON yang KETAT.

LINGKUP ANALISA: ${scopeLabelStr}
TANGGAL RAPORT: ${targetDate.toISOString().split('T')[0]}

TUGAS:
1. Berikan NILAI RAPORT (A, A-, B+, B, B-, C+, C, C-, D, atau F) untuk setiap kategori berikut, dan sertakan skor angka (0-100) dan deskripsi singkat (max 2 kalimat):
   - Kesehatan Piutang: Rasio balance vs paid, aging AR, collection rate
   - Kedisiplinan Pembayaran: Pola OVD (overdue pattern), frekuensi keterlambatan
   - Utilisasi Credit Limit: Rata-rata penggunaan vs limit (avgtrx vs old_cl), efisiensi
   - Risiko Bad Debt: Jumlah bad debt, OVD >30 hari, pola pembayaran buruk
   - Pertumbuhan Bisnis: Tren transaksi, customer aktif, potensi revenue

2. Hitung overallGrade (huruf) dan overallScore (0-100) berdasarkan rata-rata kategori.

3. Tulis RINGKASAN EKSEKUTIF (summary) 3-5 paragraf dalam Markdown. Sertakan angka-angka penting.
4. Tulis highlights (hal-hal positif utama) dalam Markdown.

5. Deteksi RED FLAGS (Anomali/Risiko) dalam Markdown. Jika tidak ada, isi null. Indikator:
   - Customer dengan balance sangat besar dan overdue
   - Pola OVD >30 hari atau bad debt berulang
   - Rasio collection rate rendah (<50%)
   - Credit limit terlalu tinggi dibanding transaksi aktual
   - Customer-customer yang perlu diperhatikan khusus
   Hitung jumlah red flag (redFlagCount).

FORMAT OUTPUT (HARUS JSON MURNI TANPA MARKDOWN BACKTICKS):
{
  "overallGrade": "B+",
  "overallScore": 78,
  "scores": [
    {"category": "Kesehatan Piutang", "grade": "A", "score": 90, "description": "..."},
    {"category": "Kedisiplinan Pembayaran", "grade": "B", "score": 75, "description": "..."},
    {"category": "Utilisasi Credit Limit", "grade": "B+", "score": 80, "description": "..."},
    {"category": "Risiko Bad Debt", "grade": "A-", "score": 85, "description": "..."},
    {"category": "Pertumbuhan Bisnis", "grade": "B", "score": 70, "description": "..."}
  ],
  "summary": "markdown text...",
  "highlights": "markdown text...",
  "redFlags": "markdown text atau null",
  "redFlagCount": 2
}

${dictionaryContext}
DATA YANG DIANALISA:
${aggregateText}
${arSummaryText}
${oclSummaryText}`;

    // --- 6. Call AI ---
    const analyticalModel = await getModelForRole('ANALYTICAL');

    let chatCompletion;
    try {
      chatCompletion = await openai.chat.completions.create({
        messages: [{ role: 'user', content: promptText }],
        model: analyticalModel,
        response_format: { type: 'json_object' }
      });
      recordLLMSuccess();
    } catch (aiError) {
      const errMsg = (aiError.error?.message || aiError.message || '').toLowerCase();
      const status = aiError.status || aiError.code;
      if (status === 429 || errMsg.includes('rate limit')) {
        recordRateLimit();
        return res.status(429).json({ error: 'Rate limit tercapai. Tunggu beberapa saat lalu coba lagi.' });
      }
      if (status === 402 || errMsg.includes('credit') || errMsg.includes('billing')) {
        recordRateLimit();
        return res.status(402).json({ error: 'Saldo kredit OpenRouter tidak mencukupi. Silakan top-up.' });
      }
      console.error('AI API error in BI raport:', aiError);
      return res.status(500).json({ error: 'Gagal menghubungi AI: ' + (aiError.message || 'Unknown error') });
    }

    let aiResponseText = chatCompletion?.choices?.[0]?.message?.content || '{}';
    aiResponseText = aiResponseText.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
    let aiData;
    try {
      aiData = JSON.parse(aiResponseText);
    } catch (e) {
      console.error('Failed to parse BI AI JSON', aiResponseText);
      return res.status(500).json({ error: 'AI did not return valid JSON' });
    }

    // Process red flags
    let processedRedFlags = aiData.redFlags;
    if (Array.isArray(processedRedFlags)) {
      processedRedFlags = processedRedFlags.map(f => `- ${f}`).join('\n');
    } else if (typeof processedRedFlags === 'object' && processedRedFlags !== null) {
      processedRedFlags = JSON.stringify(processedRedFlags);
    } else if (typeof processedRedFlags !== 'string') {
      processedRedFlags = null;
    }

    // --- 7. Save to DB ---
    const reportRecord = await prisma.bIReportCard.upsert({
      where: {
        type_scope_date_scopeFilter: {
          type,
          scope,
          date: targetDate,
          scopeFilter: scopeFilter || ''
        }
      },
      update: {
        scopeName,
        overallGrade: aiData.overallGrade || 'C',
        overallScore: aiData.overallScore || 0,
        scores: JSON.stringify(aiData.scores || []),
        summary: aiData.summary || '',
        highlights: aiData.highlights || '',
        redFlags: processedRedFlags,
        redFlagCount: aiData.redFlagCount || 0,
        totalAR,
        totalPaid,
        totalBalance,
        totalCustomers,
        totalInvoices,
        overdueCount,
        generatedAt: new Date()
      },
      create: {
        type,
        scope,
        scopeFilter: scopeFilter || '',
        scopeName,
        date: targetDate,
        overallGrade: aiData.overallGrade || 'C',
        overallScore: aiData.overallScore || 0,
        scores: JSON.stringify(aiData.scores || []),
        summary: aiData.summary || '',
        highlights: aiData.highlights || '',
        redFlags: processedRedFlags,
        redFlagCount: aiData.redFlagCount || 0,
        totalAR,
        totalPaid,
        totalBalance,
        totalCustomers,
        totalInvoices,
        overdueCount
      }
    });

    // --- 8. Generate PDF ---
    if (!fs.existsSync(UPLOADS_DIR)) {
      fs.mkdirSync(UPLOADS_DIR, { recursive: true });
    }
    const filename = `BIRaport_${reportRecord.id}_${Date.now()}.pdf`;
    const filepath = path.join(UPLOADS_DIR, filename);
    await generateBIPdf(reportRecord, filepath);

    const updatedRecord = await prisma.bIReportCard.update({
      where: { id: reportRecord.id },
      data: { pdfUrl: `/uploads/${filename}` }
    });

    res.json(updatedRecord);
  } catch (error) {
    console.error('Error generating BI raport:', error);
    res.status(500).json({ error: 'Failed to generate BI raport: ' + (error.message || '') });
  }
};

const deleteReport = async (req, res) => {
  try {
    if (req.user.role === 'USER') {
      return res.status(403).json({ error: 'Unauthorized to delete BI reports' });
    }

    const report = await prisma.bIReportCard.findUnique({ where: { id: req.params.id } });
    if (!report) return res.status(404).json({ error: 'BI Report not found' });

    if (report.pdfUrl) {
      const filepath = path.join(UPLOADS_DIR, path.basename(report.pdfUrl));
      if (fs.existsSync(filepath)) fs.unlinkSync(filepath);
    }

    await prisma.bIReportCard.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting BI raport:', error);
    res.status(500).json({ error: 'Failed to delete BI raport' });
  }
};

module.exports = {
  getReports,
  getHeatmap,
  getSalesmen,
  getCustomers,
  getDetail,
  generateReport,
  deleteReport
};
