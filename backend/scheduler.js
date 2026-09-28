const cron = require('node-cron');
const { PrismaClient } = require('@prisma/client');
const { OpenAI } = require('openai');
const fs = require('fs');
const path = require('path');
const emailService = require('./services/email/email.service');
const { getModelForRole } = require('./utils/Orchestrator');
// PDFDocument is no longer used, replaced by puppeteer
const ExcelJS = require('exceljs');

const { marked } = require('marked');
const crypto = require('crypto');

const prisma = new PrismaClient();
let activeClients = new Map();
const UPLOADS_DIR = path.join(__dirname, 'uploads');

// Helper to calculate date range based on period string in WIB (UTC+7) timezone
const getDateRange = (period) => {
  const now = new Date();
  const options = { timeZone: 'Asia/Jakarta', year: 'numeric', month: '2-digit', day: '2-digit' };
  const formatter = new Intl.DateTimeFormat('en-CA', options);
  const parts = formatter.formatToParts(now);
  const year = parseInt(parts.find(p => p.type === 'year').value);
  const month = parseInt(parts.find(p => p.type === 'month').value) - 1;
  const day = parseInt(parts.find(p => p.type === 'day').value);

  // Helper to create UTC date representing start and end of a specific WIB day
  const getWibDay = (offsetDays = 0) => {
    const start = new Date(Date.UTC(year, month, day + offsetDays, -7, 0, 0, 0));
    const end = new Date(Date.UTC(year, month, day + offsetDays, 16, 59, 59, 999));
    return { start, end };
  };

  let start, end;

  switch (period.toLowerCase()) {
    case 'today':
      ({ start } = getWibDay(0));
      end = new Date(); // Up to now
      break;
    case 'yesterday':
      ({ start, end } = getWibDay(-1));
      break;
    case 'last_2_days':
      ({ start } = getWibDay(-2));
      end = new Date();
      break;
    case 'last_7_days':
      ({ start } = getWibDay(-7));
      end = new Date();
      break;
    case 'last_30_days':
      ({ start } = getWibDay(-30));
      end = new Date();
      break;
    case 'last_month':
      start = new Date(Date.UTC(year, month - 1, 1, -7, 0, 0, 0));
      end = new Date(Date.UTC(year, month, 0, 16, 59, 59, 999));
      break;
    default:
      ({ start } = getWibDay(0));
      end = new Date();
      break;
  }
  return { start, end };
};

const createPdf = async (htmlContent, filepath) => {
  const puppeteer = require('puppeteer');
  const browser = await puppeteer.launch({ args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  const page = await browser.newPage();
  
  // Wrap the HTML content in a proper document with some styling
  const fullHtml = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="UTF-8">
        <style>
          body {
            font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
            color: #333;
            line-height: 1.6;
            margin: 0;
            padding: 40px;
          }
          h1, h2, h3, h4 {
            color: #2c3e50;
            margin-top: 24px;
            margin-bottom: 12px;
            border-bottom: 1px solid #eee;
            padding-bottom: 8px;
          }
          p {
            margin: 0 0 12px;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 16px;
            margin-bottom: 24px;
          }
          th, td {
            padding: 10px 14px;
            border: 1px solid #ddd;
          }
          th {
            background-color: #f4f6f8;
            font-weight: 600;
            text-align: left;
            color: #2c3e50;
          }
          tr:nth-child(even) {
            background-color: #fdfdfd;
          }
          ul, ol {
            margin-top: 0;
            margin-bottom: 16px;
            padding-left: 24px;
          }
          li {
            margin-bottom: 6px;
          }
          strong {
            color: #2c3e50;
          }
        </style>
      </head>
      <body>
        ${htmlContent}
      </body>
    </html>
  `;

  await page.setContent(fullHtml, { waitUntil: 'load' });
  await page.pdf({ 
    path: filepath, 
    format: 'A4',
    printBackground: true,
    margin: { top: '20px', right: '20px', bottom: '20px', left: '20px' }
  });
  
  await browser.close();
};

const createExcel = async (text, filepath) => {
  // If the AI gives us CSV formatted text, we parse it. Otherwise, we put it in one cell or split by lines.
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Report');
  
  const lines = text.split('\n');
  lines.forEach(line => {
    // Basic CSV splitting (handling commas)
    // For a robust CSV parser, we'd use a csv-parse library, but this works for basic tabular output from AI
    const row = line.split(',').map(cell => cell.trim().replace(/^"|"$/g, ''));
    worksheet.addRow(row);
  });
  
  await workbook.xlsx.writeFile(filepath);
};

const createImage = async (text, filepath) => {
  const puppeteer = require('puppeteer');
  const browser = await puppeteer.launch({ args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  const page = await browser.newPage();
  
  // Create a simple HTML to render the text
  const htmlContent = `
    <html>
      <head>
        <style>
          body { font-family: sans-serif; padding: 20px; background: white; color: #333; }
          pre { white-space: pre-wrap; font-size: 16px; }
        </style>
      </head>
      <body>
        <pre>${text}</pre>
      </body>
    </html>
  `;
  await page.setContent(htmlContent);
  const element = await page.$('body');
  await element.screenshot({ path: filepath });
  await browser.close();
};

const startScheduler = () => {
  
  console.log('Starting report scheduler...');
  
  // Run every minute
  cron.schedule('* * * * *', async () => {
    const now = new Date();
    
    // Evaluate time in Asia/Jakarta (WIB) timezone
    const options = { timeZone: 'Asia/Jakarta', hour: '2-digit', minute: '2-digit', hour12: false };
    const parts = new Intl.DateTimeFormat('en-US', options).formatToParts(now);
    const hourPart = parts.find(p => p.type === 'hour').value;
    const minutePart = parts.find(p => p.type === 'minute').value;
    
    // Handle '24' hour edge case in some Intl implementations
    const currentHour = hourPart === '24' ? '00' : hourPart.padStart(2, '0');
    const currentMinute = minutePart.padStart(2, '0');
    
    const timeString = `${currentHour}:${currentMinute}`;

    try {
      // Find active schedules matching the current time
      const schedules = await prisma.reportSchedule.findMany({
        where: {
          isActive: true,
          scheduleTime: timeString
        }
      });

      if (schedules.length > 0) {
        console.log(`Found ${schedules.length} schedules to run at ${timeString}`);
      }

      for (const schedule of schedules) {
        try {
          // ── TapTalk/OneTalk: SKIP auto-schedule ──────────────────────
          // TapTalk reports are client-initiated only (to avoid outbound costs).
          // Reports are triggered when the client sends a request message,
          // handled in coreHandler.service.js processIncomingMessage().
          if (schedule.sessionId === 'taptalk') {
            console.log(`[Scheduler] Skipping TapTalk schedule "${schedule.name}" — client-initiated only.`);
            continue;
          }
          // ─────────────────────────────────────────────────────────────

          const senderId = schedule.senderSessionId || schedule.sessionId;
          const clientAdapter = require('./utils/ClientManager').getClientAdapter(senderId);
          if (!clientAdapter) {
            console.error(`Client adapter for session ${senderId} not found. Skipping schedule.`);
            continue;
          }

          await executeSchedule(schedule, clientAdapter);
        } catch (scheduleErr) {
          console.error(`Error processing schedule ${schedule.id}:`, scheduleErr);
        }
      }
    } catch (err) {
      console.error('Error in cron job:', err);
    }
  });

  // ==========================================
  // BACKUP SCHEDULER
  // ==========================================
  const { createBackup, cleanupOldBackups } = require('./utils/backup-utils');

  // Check backup schedules every minute
  cron.schedule('* * * * *', async () => {
    const now = new Date();
    
    // Evaluate time in WIB
    const options = { timeZone: 'Asia/Jakarta', hour: '2-digit', minute: '2-digit', hour12: false };
    const parts = new Intl.DateTimeFormat('en-US', options).formatToParts(now);
    const hourPart = parts.find(p => p.type === 'hour').value;
    const minutePart = parts.find(p => p.type === 'minute').value;
    const currentHour = hourPart === '24' ? '00' : hourPart.padStart(2, '0');
    const currentMinute = minutePart.padStart(2, '0');
    const timeString = `${currentHour}:${currentMinute}`;

    // Get day-of-week and day-of-month in WIB
    const dayOptions = { timeZone: 'Asia/Jakarta', weekday: 'long' };
    const dayOfWeek = new Intl.DateTimeFormat('en-US', dayOptions).format(now);
    const dateOptions = { timeZone: 'Asia/Jakarta', day: 'numeric' };
    const dayOfMonth = parseInt(new Intl.DateTimeFormat('en-US', dateOptions).format(now));

    try {
      const backupSchedules = await prisma.backupSchedule.findMany({
        where: {
          isActive: true,
          backupTime: timeString
        }
      });

      for (const schedule of backupSchedules) {
        // Check frequency: skip if not the right day
        if (schedule.frequency === 'weekly' && dayOfWeek !== 'Monday') continue;
        if (schedule.frequency === 'monthly' && dayOfMonth !== 1) continue;

        // Prevent running the same schedule more than once per minute
        if (schedule.lastRunAt) {
          const lastRun = new Date(schedule.lastRunAt);
          const diffMs = now.getTime() - lastRun.getTime();
          if (diffMs < 60000) continue; // Skip if ran less than 1 minute ago
        }

        console.log(`Running scheduled backup (${schedule.frequency}) at ${timeString}`);
        
        const result = await createBackup('scheduled', schedule.createdBy);
        
        // Update lastRunAt
        await prisma.backupSchedule.update({
          where: { id: schedule.id },
          data: { lastRunAt: now }
        });

        if (result.success) {
          console.log(`Scheduled backup completed: ${result.filename}`);
        } else {
          console.error(`Scheduled backup failed: ${result.error}`);
        }
      }
    } catch (err) {
      console.error('Error in backup cron job:', err);
    }
  });

  // ==========================================
  // PADMA DATA SYNC SCHEDULER
  // ==========================================
  const { runSyncProcess } = require('./controllers/syncController');
  
  cron.schedule('* * * * *', async () => {
    try {
      const settings = await prisma.syncSetting.findMany({
        where: { isActive: true }
      });
      
      const now = new Date();
      
      for (const setting of settings) {
        if (setting.scheduleType === 'manual') continue;

        // Skip if there is an in-progress sync running for this module in the last 15 minutes
        const activeLog = await prisma.syncLog.findFirst({
          where: {
            module: setting.module,
            status: 'IN_PROGRESS',
            createdAt: { gte: new Date(now.getTime() - 15 * 60000) }
          }
        });
        if (activeLog) continue;

        let shouldRun = false;
        if (!setting.lastSyncAt) {
          shouldRun = true;
        } else {
          const lastSync = new Date(setting.lastSyncAt);
          const diffMs = now.getTime() - lastSync.getTime();
          
          if (setting.scheduleType === 'minutely' && diffMs >= 60000) {
            shouldRun = true;
          } else if (setting.scheduleType === '5_minutes' && diffMs >= 300000) {
            shouldRun = true;
          } else if (setting.scheduleType === '10_minutes' && diffMs >= 600000) {
            shouldRun = true;
          } else if (setting.scheduleType === '15_minutes' && diffMs >= 900000) {
            shouldRun = true;
          } else if (setting.scheduleType === '30_minutes' && diffMs >= 1800000) {
            shouldRun = true;
          } else if (setting.scheduleType === 'hourly' && diffMs >= 3600000) {
            shouldRun = true;
          } else if (setting.scheduleType === '2_hours' && diffMs >= 7200000) {
            shouldRun = true;
          } else if (setting.scheduleType === '6_hours' && diffMs >= 21600000) {
            shouldRun = true;
          } else if (setting.scheduleType === 'daily' && diffMs >= 86400000) {
            shouldRun = true;
          }
        }
        
        if (shouldRun) {
          console.log(`Running scheduled sync (${setting.scheduleType}) for module: ${setting.module}`);
          // Fire and forget
          runSyncProcess(setting, 'AUTOMATIC').catch(err => {
            console.error(`Scheduled sync error for ${setting.module}:`, err);
          });
        }
      }
    } catch (err) {
      console.error('Error in sync cron job:', err);
    }
  });

  // ==========================================
  // RETURN TRANSACTIONS SYNC RETRY SCHEDULER
  // ==========================================
  const ReturnService = require('./services/ReturnService');
  
  // Retry unsynced return transactions every 5 minutes
  cron.schedule('*/5 * * * *', async () => {
    try {
      const unsyncedCount = await prisma.returnTransaction.count({
        where: { isSynced: false }
      });
      if (unsyncedCount > 0) {
        console.log(`[Scheduler] Found ${unsyncedCount} unsynced return transaction(s). Retrying sync to central server...`);
        await ReturnService.syncAllUnsynced();
      }
    } catch (returSyncErr) {
      console.error('[Scheduler] Error retrying return transactions sync:', returSyncErr.message);
    }
  });

  // Daily cleanup at 03:00 WIB — delete backups older than retention period
  cron.schedule('* * * * *', async () => {
    const now = new Date();
    const options = { timeZone: 'Asia/Jakarta', hour: '2-digit', minute: '2-digit', hour12: false };
    const parts = new Intl.DateTimeFormat('en-US', options).formatToParts(now);
    const hourPart = parts.find(p => p.type === 'hour').value;
    const minutePart = parts.find(p => p.type === 'minute').value;
    const currentHour = hourPart === '24' ? '00' : hourPart.padStart(2, '0');
    const currentMinute = minutePart.padStart(2, '0');
    const timeString = `${currentHour}:${currentMinute}`;

    if (timeString === '03:00') {
      console.log('Running daily backup cleanup...');
      // Get the minimum retention from all active schedules, default 30
      try {
        const schedules = await prisma.backupSchedule.findMany({
          where: { isActive: true },
          select: { retentionDays: true }
        });
        const retentionDays = schedules.length > 0 
          ? Math.min(...schedules.map(s => s.retentionDays)) 
          : 30;
        
        await cleanupOldBackups(retentionDays);
      } catch (err) {
        console.error('Error in backup cleanup:', err);
      }
    }
  });

  // ==========================================
  // BUKU RAPORT SCHEDULER
  // ==========================================
  // Auto-generate daily report card at 23:55 WIB
  cron.schedule('55 23 * * *', async () => {
    // Only run if it's 23:55 WIB
    const now = new Date();
    const options = { timeZone: 'Asia/Jakarta', hour: '2-digit', minute: '2-digit', hour12: false };
    const parts = new Intl.DateTimeFormat('en-US', options).formatToParts(now);
    const hourPart = parts.find(p => p.type === 'hour').value;
    const minutePart = parts.find(p => p.type === 'minute').value;
    const currentHour = hourPart === '24' ? '00' : hourPart.padStart(2, '0');
    const currentMinute = minutePart.padStart(2, '0');
    
    if (`${currentHour}:${currentMinute}` !== '23:55') return;

    console.log('Running auto-generate daily Report Cards...');
    try {
      const activeSessions = await prisma.session.findMany({
        where: { status: 'ready' }
      });

      for (const session of activeSessions) {
         try {
           console.log(`Generating daily report card for session: ${session.sessionId}`);
           const axios = require('axios');
           // Internal API call to generate report
           await axios.post(`http://localhost:${process.env.PORT || 3013}/api/raport/generate`, {
             sessionId: session.sessionId,
             type: 'daily',
             scope: 'device',
             date: new Date().toISOString()
           });
           console.log(`Successfully generated daily report card for ${session.sessionId}`);
         } catch(err) {
           console.error(`Failed to generate daily report card for ${session.sessionId}:`, err.message);
         }
      }
    } catch (err) {
      console.error('Error in Report Card scheduler:', err);
    }
  });

  // ==========================================
  // SALESMAN MONTHLY REPORT SCHEDULER
  // ==========================================
  const { runSalesmanReportJob } = require('./services/salesmanReportService');
  
  // Runs every minute to check schedule from DB
  cron.schedule('* * * * *', async () => {
    const now = new Date();
    const options = { timeZone: 'Asia/Jakarta', hour: '2-digit', minute: '2-digit', hour12: false };
    const parts = new Intl.DateTimeFormat('en-US', options).formatToParts(now);
    const hourPart = parts.find(p => p.type === 'hour').value;
    const minutePart = parts.find(p => p.type === 'minute').value;
    const currentHour = hourPart === '24' ? '00' : hourPart.padStart(2, '0');
    const currentMinute = minutePart.padStart(2, '0');
    const timeString = `${currentHour}:${currentMinute}`;
    
    try {
      const schedule = await prisma.generalReportSchedule.findUnique({
        where: { reportId: 'salesman_monthly' }
      });
      
      if (schedule && schedule.isActive && schedule.scheduleTime === timeString) {
        console.log(`[Scheduler] Triggering Salesman Monthly Report at ${timeString}`);
        await runSalesmanReportJob(schedule.senderSessionId);
      }
    } catch (err) {
      console.error('Error in Salesman Report scheduler check:', err);
    }
  });

  console.log('Scheduler started (Reports, Backup, Report Cards, Salesman).');
};


async function executeSchedule(schedule, clientAdapter) {
  console.log(`Running schedule ${schedule.id} for device ${schedule.sessionId}`);
  
  const { start, end } = getDateRange(schedule.period || 'today');
  
  // Fetch messages
  let messages = await prisma.message.findMany({
    where: {
      sessionId: schedule.sessionId,
      timestamp: {
        gte: start,
        lte: end
      },
      isStatus: false
    },
    orderBy: { timestamp: 'asc' }
  });

  if (schedule.exportFormat === 'database_payment') {
    const imageMessages = messages.filter(msg => msg.mediaUrl && msg.mediaType && (msg.mediaType === 'image/jpeg' || msg.mediaType === 'image/png'));
    
    if (imageMessages.length === 0) {
      console.log(`No images found for schedule ${schedule.id}.`);
      return;
    }

    if (!process.env.GROQ_API_KEY) {
      console.error('GROQ_API_KEY is not set. Cannot perform extraction.');
      return;
    }
    const openai = new OpenAI({
      baseURL: 'https://openrouter.ai/api/v1',
      apiKey: process.env.OPENROUTER_API_KEY
    });
    
    let processedCount = 0;
    for (const msg of imageMessages) {
      try {
        const existing = await prisma.paymentExtraction.findFirst({ where: { messageId: msg.id } });
        if (existing) continue;

        const relativePath = msg.mediaUrl.startsWith('/') ? msg.mediaUrl.substring(1) : msg.mediaUrl;
        const filepath = path.join(__dirname, relativePath);
        
        if (!fs.existsSync(filepath)) {
          console.log(`File not found: ${filepath}`);
          continue;
        }

        const imageBase64 = fs.readFileSync(filepath, { encoding: 'base64' });
        
        const imageHash = require('crypto').createHash('md5').update(imageBase64).digest('hex');
        const duplicateHash = await prisma.paymentExtraction.findFirst({ where: { imageHash: imageHash } });
        if (duplicateHash) {
          console.log(`Image already analyzed (duplicate hash). Skipping message ${msg.id}.`);
          continue;
        }

        if (processedCount > 0 && processedCount % 5 === 0) {
          console.log(`Processed ${processedCount} images. Waiting 60 seconds to avoid Groq rate limit...`);
          await new Promise(resolve => setTimeout(resolve, 60000));
        }
        processedCount++;

        let visionModel = await getModelForRole('VISION');

        const chatCompletion = await openai.chat.completions.create({
          messages: [
            {
              role: 'user',
              content: [
                { type: 'text', text: schedule.prompt },
                {
                  type: 'image_url',
                  image_url: {
                    url: `data:${msg.mediaType || 'image/jpeg'};base64,${imageBase64}`
                  }
                }
              ]
            }
          ],
          model: visionModel,
          response_format: { type: 'json_object' },
          temperature: 0.1,
          max_tokens: 4096
        });
        
        let content = chatCompletion.choices[0]?.message?.content || "{}";
        let data = {};
        try {
           const jsonMatch = content.match(/\x60\x60\x60json\s*(\{[\s\S]*?\})\s*\x60\x60\x60/) || content.match(/\x60\x60\x60\s*(\{[\s\S]*?\})\s*\x60\x60\x60/);
           if (jsonMatch) content = jsonMatch[1];
           data = JSON.parse(content);
        } catch(e) {
           console.error("Failed to parse JSON from Groq for msg", msg.id, e, content);
           continue;
        }
        
        const parseNominal = (val) => {
          if (val === null || val === undefined) return null;
          if (typeof val === 'number') return val;
          const str = String(val).replace(/[^0-9.-]+/g, "");
          const parsed = parseFloat(str);
          return isNaN(parsed) ? null : parsed;
        };

        await prisma.paymentExtraction.create({
          data: {
            sessionId: msg.sessionId,
            messageId: msg.id,
            pengirimPesan: data.pengirim_pesan || null,
            bankSumber: data.bank_sumber || null,
            tanggalTransfer: data.tanggal_transfer || null,
            jenisTransaksi: data.jenis_transaksi || null,
            rekeningTujuan: data.rekening_tujuan || null,
            nominalTransfer: parseNominal(data.nominal_transfer),
            beritaPesan: data.berita_pesan || null,
            noReferensi: data.no_referensi || null,
            status: data.status || null,
            rawJson: JSON.stringify(data),
            imageHash: imageHash
          }
        });
        console.log(`Payment extraction saved for message ${msg.id}`);
      } catch (extractErr) {
         console.error(`Error extracting payment for message ${msg.id}:`, extractErr);
      }
    }
    
    // Fetch all extractions for the current period's messages
    const messageIds = imageMessages.map(m => m.id);
    const allExtractions = await prisma.paymentExtraction.findMany({
       where: { messageId: { in: messageIds } }
    });

    if (allExtractions.length > 0 && schedule.targetWaNumber) {
       let csvContent = "Pengirim Pesan,Bank Sumber,Tanggal Transfer,Jenis Transaksi,Rekening Tujuan,Nominal Transfer,Berita Pesan,No Referensi,Status\n";
       for (const item of allExtractions) {
          const row = [
             item.pengirimPesan, item.bankSumber, item.tanggalTransfer,
             item.jenisTransaksi, item.rekeningTujuan, item.nominalTransfer,
             item.beritaPesan, item.noReferensi, item.status
          ].map(v => `"${(v || '').toString().replace(/"/g, '""')}"`).join(',');
          csvContent += row + "\n";
       }
       
       if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });
       const filename = `Payment_Extraction_${schedule.id}_${Date.now()}`;
       const filepath = require('path').join(UPLOADS_DIR, `${filename}.xlsx`);
       
       const ExcelJS = require('exceljs');
       const workbook = new ExcelJS.Workbook();
       const worksheet = workbook.addWorksheet('Data');
       worksheet.columns = [
         { header: 'Pengirim Pesan', key: 'pengirim', width: 20 },
         { header: 'Bank Sumber', key: 'bank', width: 15 },
         { header: 'Tanggal Transfer', key: 'tanggal', width: 15 },
         { header: 'Jenis Transaksi', key: 'jenis', width: 15 },
         { header: 'Rekening Tujuan', key: 'rekening', width: 20 },
         { header: 'Nominal Transfer', key: 'nominal', width: 15 },
         { header: 'Berita Pesan', key: 'berita', width: 25 },
         { header: 'No Referensi', key: 'referensi', width: 15 },
         { header: 'Status', key: 'status', width: 15 }
       ];
       allExtractions.forEach(item => {
         worksheet.addRow({
           pengirim: item.pengirimPesan,
           bank: item.bankSumber,
           tanggal: item.tanggalTransfer,
           jenis: item.jenisTransaksi,
           rekening: item.rekeningTujuan,
           nominal: item.nominalTransfer,
           berita: item.beritaPesan,
           referensi: item.noReferensi,
           status: item.status
         });
       });
       await workbook.xlsx.writeFile(filepath);
       
       const periodText = schedule.period ? schedule.period.replace(/_/g, ' ') : 'hari ini';
       let targetNumbers = [];
       if (clientAdapter.overrideTarget) {
           targetNumbers = [clientAdapter.overrideTarget];
       } else if (schedule.targetWaNumber) {
           targetNumbers = schedule.targetWaNumber.split(',').map(n => n.trim()).filter(n => n);
       }
       
       for (const target of targetNumbers) {
         const resolvedTarget = clientAdapter.formatJid(target);
         try {
           const caption = `Berikut adalah hasil ekstraksi data pembayaran periode ${periodText}. Terdapat ${allExtractions.length} transaksi yang diekstrak dan disimpan ke database.`;
           await clientAdapter.sendDocument(resolvedTarget, filepath, 'Laporan.xlsx', caption, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
         } catch (sendErr) {
           console.error(`Gagal mengirim WA ke ${resolvedTarget}:`, sendErr);
         }
       }
    }
    
    return;
  }


  if (messages.length === 0) {
    console.log(`No messages found for schedule ${schedule.id} in the specified period.`);
    return { success: false, reason: 'no_messages' };
  }

  // Build transcript
  const transcriptLines = messages.map(msg => {
    const person = msg.isFromMe ? 'Me' : (msg.authorName || msg.sender);
    return `${person} [${msg.timestamp.toISOString()}]: ${msg.messageBody || '[Media]'}`;
  });
  const transcript = transcriptLines.join('\n');

  // Ensure GROQ is configured
  if (!process.env.GROQ_API_KEY) {
    console.error('GROQ_API_KEY is not set. Cannot generate report.');
    return;
  }
  const openai = new OpenAI({
      baseURL: 'https://openrouter.ai/api/v1',
      apiKey: process.env.OPENROUTER_API_KEY
    });
  
  // Modify prompt based on format
  let formatInstruction = '';
  if (schedule.exportFormat === 'excel') {
    formatInstruction = '\\n\\nPlease output the result strictly in CSV format (comma-separated values) with headers, so it can be imported into Excel.';
  } else if (schedule.exportFormat === 'pdf') {
    formatInstruction = '\\n\\nPlease provide the report in Markdown format. Use proper headings (##), lists, bold text, etc. to structure the report professionally and make it easy to read.';
  } else if (schedule.exportFormat === 'image') {
    formatInstruction = '\\n\\nPlease provide a clear, well-formatted text summary.';
  } else if (schedule.exportFormat === 'text') {
    formatInstruction = '\\n\\nPlease provide the report in Markdown format. Use simple markdown like bold (*bold*), italic (_italic_), or strikethrough (~strikethrough~) suitable for chat platforms like Telegram or WhatsApp.';
  }

  // Fetch dictionary to provide context
  const dictionaries = await prisma.dictionary.findMany();
  let dictionaryContext = "";
  if (dictionaries.length > 0) {
    dictionaryContext = "Here is the business jargon dictionary that you MUST use to understand the context:\n";
    dictionaries.forEach(d => {
      dictionaryContext += `- ${d.term}: ${d.definition}\n`;
    });
    dictionaryContext += "\n";
  }

  // Fetch relevant contacts to provide lookup context
  const uniqueSenders = [...new Set(messages.map(m => m.sender).filter(s => s && s !== 'TapTalk / OneTalk' && !s.includes('Me')))];
  const uniqueNumbers = uniqueSenders.map(s => s.replace('@s.whatsapp.net', ''));
  const searchNumbers = [...new Set([...uniqueSenders, ...uniqueNumbers])];
  
  let contactContext = "";
  if (searchNumbers.length > 0) {
    const contacts = await prisma.contact.findMany({
      where: {
        OR: [
          { whatsappId: { in: searchNumbers } },
          { phoneNumber: { in: searchNumbers } }
        ]
      }
    });
    
    if (contacts.length > 0) {
      contactContext = "Here is the Contact Lookup Table for the phone numbers in the transcript:\n";
      contacts.forEach(c => {
        const phone = c.phoneNumber || c.whatsappId || "Unknown";
        const name = c.name || "Unknown";
        const custCode = c.kodeCustomer ? c.kodeCustomer.split(',')[0].trim() : "None";
        contactContext += `- Phone: ${phone}, Name: ${name}, CustomerCode: ${custCode}\n`;
      });
      contactContext += "\n";
    }
  }

  const combinedContext = (dictionaryContext + contactContext);
  const promptText = `Instruction: ${schedule.prompt} 

${formatInstruction.replace(/\\n/g, '\n')}

${combinedContext}Here is the chat transcript:
${transcript}`;
  
  let selectedModel = await getModelForRole('ANALYTICAL');

  const chatCompletion = await openai.chat.completions.create({
    messages: [{ role: 'user', content: promptText }],
    model: selectedModel,
    max_tokens: 16384,
  });
  
  let reportContent = chatCompletion.choices[0]?.message?.content || "No content generated.";

  // Prepend generation timestamp
  const now = new Date();
  const dateStr = now.toLocaleDateString('id-ID', { timeZone: 'Asia/Jakarta', year: 'numeric', month: 'long', day: 'numeric' });
  const timeStr = now.toLocaleTimeString('id-ID', { timeZone: 'Asia/Jakarta', hour: '2-digit', minute: '2-digit' });
  
  if (schedule.exportFormat === 'pdf') {
    reportContent = `*Laporan Dihasilkan Pada: ${dateStr} pukul ${timeStr}*\n\n---\n\n` + reportContent;
  } else {
    reportContent = `Laporan Dihasilkan Pada: ${dateStr} pukul ${timeStr}\n\n` + reportContent;
  }

  // Generate File or Send Directly
  const periodText = schedule.period ? schedule.period.replace(/_/g, ' ') : 'hari ini';
  let targetNumbers = [];
  if (clientAdapter.overrideTarget) {
      targetNumbers = [clientAdapter.overrideTarget];
  } else if (schedule.targetWaNumber) {
      targetNumbers = schedule.targetWaNumber.split(',').map(n => n.trim()).filter(n => n);
  }

  if (schedule.exportFormat === 'text') {
    for (const target of targetNumbers) {
      const resolvedTarget = clientAdapter.formatJid(target);
      const title = `*Laporan ${schedule.name || 'AI'} Periode ${periodText}*\n\n`;
      try {
        await clientAdapter.sendMessage(resolvedTarget, title + reportContent);
        console.log(`Report sent successfully to ${resolvedTarget}`);
      } catch (e) {
        console.error(`Failed to send report to ${resolvedTarget}:`, e.message);
      }
    }

    if (schedule.targetEmail) {
      try {
        const title = `*Laporan ${schedule.name || 'AI'} Periode ${periodText}*\n\n`;
        await emailService.sendEmail({
          to: schedule.targetEmail,
          subject: `Laporan ${schedule.name || 'AI'} Periode ${periodText}`,
          text: title + reportContent
        });
        console.log(`Report sent successfully via Email to ${schedule.targetEmail}`);
      } catch (emailErr) {
        console.error(`Failed to send email to ${schedule.targetEmail}:`, emailErr.message);
      }
    }
    return;
  }

  const filename = `Report_${schedule.id}_${Date.now()}`;
  let filepath = '';
  let mimetype = '';
  
  if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  }

  if (schedule.exportFormat === 'pdf') {
    filepath = path.join(UPLOADS_DIR, `${filename}.pdf`);
    const htmlContent = marked.parse(reportContent);
    await createPdf(htmlContent, filepath);
    mimetype = 'application/pdf';
  } else if (schedule.exportFormat === 'excel') {
    filepath = path.join(UPLOADS_DIR, `${filename}.xlsx`);
    await createExcel(reportContent, filepath);
    mimetype = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
  } else if (schedule.exportFormat === 'image') {
    filepath = path.join(UPLOADS_DIR, `${filename}.png`);
    await createImage(reportContent, filepath);
    mimetype = 'image/png';
  }

  // Send via WhatsApp/Telegram (Files)
  for (const target of targetNumbers) {
    const resolvedTarget = clientAdapter.formatJid(target);
    const caption = `Berikut adalah laporan ${schedule.name || 'AI'} periode ${periodText}.`;
    
    try {
      await clientAdapter.sendDocument(resolvedTarget, filepath, path.basename(filepath), caption, mimetype);
      console.log(`Report sent successfully to ${resolvedTarget}`);
    } catch (e) {
      console.error(`Failed to send report to ${resolvedTarget}:`, e.message);
    }
  }

  if (schedule.targetEmail) {
    try {
      await emailService.sendEmail({
        to: schedule.targetEmail,
        subject: `Laporan ${schedule.name || 'AI'} Periode ${periodText}`,
        text: `Berikut adalah lampiran laporan ${schedule.name || 'AI'} periode ${periodText}.`,
        attachments: [
          {
            filename: path.basename(filepath),
            path: filepath
          }
        ]
      });
      console.log(`Report sent successfully via Email to ${schedule.targetEmail}`);
    } catch (emailErr) {
      console.error(`Failed to send email to ${schedule.targetEmail}:`, emailErr.message);
    }
  }
}

async function executeScheduleById(scheduleId) {
  const schedule = await prisma.reportSchedule.findUnique({ where: { id: scheduleId } });
  if (!schedule) throw new Error("Schedule not found");
  
  const senderId = schedule.senderSessionId || schedule.sessionId;
  const clientAdapter = require('./utils/ClientManager').getClientAdapter(senderId);
  if (!clientAdapter) throw new Error("Client adapter for this session is not connected or ready");

  const result = await executeSchedule(schedule, clientAdapter);
  return result || { success: true, message: "Schedule executed" };
}

module.exports = { startScheduler, executeScheduleById, executeSchedule };
