const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { getModelForRole, openai } = require('../utils/Orchestrator');
// Wrapper for TapTalk compatibility while retaining Baileys functionality
const { sendWhatsAppMessage } = require('../services/taptalk.service');
const { getSock: getBaileysSock } = require('../whatsapp');
const { getTelegramBot } = require('../telegram');

const getSock = (sessionId) => {
  if (sessionId === 'taptalk') {
    return {
      sendMessage: async (jid, content) => {
        if (content.text) {
          const phone = jid.replace('@s.whatsapp.net', '').replace('@g.us', '');
          return await sendWhatsAppMessage(phone, content.text);
        }
      },
      groupFetchAllParticipating: async () => ({}),
      groupMetadata: async (groupId) => ({ subject: 'TapTalk Group', participants: [] })
    };
  }

  // Cek apakah ini device Telegram
  if (sessionId && sessionId.startsWith('telegram')) {
    const teleBot = getTelegramBot(sessionId);
    if (teleBot) {
      return {
        sendMessage: async (jid, content) => {
           let chatId = jid.replace('@s.whatsapp.net', '').replace('@g.us', '');
           if (content.document && content.document.url) {
               return await teleBot.sendDocument(chatId, content.document.url, { caption: content.caption });
           }
           if (content.text) {
               return await teleBot.sendMessage(chatId, content.text);
           }
        },
        groupFetchAllParticipating: async () => ({}),
        groupMetadata: async (groupId) => ({ subject: 'Telegram Group', participants: [] })
      };
    }
  }

  // Untuk device lain (whatsapp bailey)
  return getBaileysSock(sessionId);
};
const path = require('path');
const fs = require('fs');
const puppeteer = require('puppeteer');
const marked = require('marked');

const prisma = new PrismaClient();
const router = express.Router();
const UPLOADS_DIR = path.join(__dirname, '../uploads');

// Helper to generate PDF
const generatePDF = async (htmlContent, filepath) => {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const page = await browser.newPage();
  await page.setContent(htmlContent, { waitUntil: 'networkidle0' });
  await page.pdf({ 
    path: filepath, 
    format: 'A4',
    printBackground: true
  });
  await browser.close();
};

// GET /api/group-analysis/groups/:sessionId
// Fetch all groups the session is part of
router.get('/groups/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const sock = getSock(sessionId);
    
    if (!sock) {
      return res.status(404).json({ error: 'WhatsApp session not connected' });
    }

    // groupFetchAllParticipating gets all groups the bot is currently in
    const groups = await sock.groupFetchAllParticipating();
    
    // Format the response
    const groupList = Object.values(groups).map(g => ({
      id: g.id,
      name: g.subject,
      memberCount: g.participants.length,
      creation: g.creation
    })).sort((a, b) => b.memberCount - a.memberCount);

    res.json({ success: true, groups: groupList });
  } catch (error) {
    console.error('Error fetching groups:', error);
    res.status(500).json({ error: 'Failed to fetch groups', details: error.message });
  }
});

// POST /api/group-analysis/analyze
router.post('/analyze', async (req, res) => {
  try {
    const { sessionId, groupId, dateFrom, dateTo, includeMedia = false } = req.body;
    if (!sessionId || !groupId) {
      return res.status(400).json({ success: false, error: 'Missing sessionId or groupId' });
    }

    const sock = getSock(sessionId);
    if (!sock) {
      return res.status(404).json({ error: 'WhatsApp session not connected' });
    }

    // 1. Fetch group metadata to get all members
    let groupMetadata;
    try {
      groupMetadata = await sock.groupMetadata(groupId);
    } catch (e) {
      return res.status(500).json({ error: 'Failed to fetch group metadata from WhatsApp', details: e.message });
    }
    const groupName = groupMetadata.subject;
    const allParticipants = groupMetadata.participants.map(p => p.id);
    
    // 2. Fetch contacts from DB to identify internal/external
    const participantsClean = allParticipants.map(id => id.split('@')[0]);
    const contacts = await prisma.contact.findMany({
      where: {
        phoneNumber: { in: participantsClean }
      }
    });

    const contactMap = {};
    contacts.forEach(c => {
      // Prefer contact with a non-null group if duplicates exist
      if (!contactMap[c.phoneNumber] || (c.group && !contactMap[c.phoneNumber].group)) {
        contactMap[c.phoneNumber] = c;
      }
    });

    // 3. Build timestamp filter for DB messages
    const timestampFilter = {};
    if (dateFrom) timestampFilter.gte = new Date(dateFrom);
    if (dateTo) {
      const endDate = new Date(dateTo);
      endDate.setHours(23, 59, 59, 999);
      timestampFilter.lte = endDate;
    }

    const groupIdClean = groupId.split('@')[0];

    // 4. Fetch messages from DB where sender or receiver == groupIdClean
    let messages = await prisma.message.findMany({
      where: {
        sessionId: sessionId,
        OR: [
          { sender: groupIdClean },
          { receiver: groupIdClean }
        ],
        isStatus: false,
        ...(Object.keys(timestampFilter).length > 0 ? { timestamp: timestampFilter } : {})
      },
      orderBy: { timestamp: 'asc' } // chronological for AI
    });

    if (messages.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Tidak ada pesan ditemukan',
        details: 'Tidak ada pesan grup dalam rentang tanggal yang dipilih.'
      });
    }

    // 5. Calculate statistics and active/passive members
    const messageCounts = {};
    const recentImageIds = new Set();
    let foundImages = 0;
    
    const transcriptLines = [];
    
    for (const msg of messages) {
      let senderNumber = msg.authorId ? msg.authorId.split('@')[0] : null;
      if (!senderNumber) {
        if (msg.isFromMe) senderNumber = msg.sender.split('@')[0];
        else senderNumber = "Unknown"; // For older messages without authorId
      }
      
      if (senderNumber !== "Unknown") {
        if (!messageCounts[senderNumber]) {
          messageCounts[senderNumber] = 0;
        }
        messageCounts[senderNumber]++;
      }

      const personName = msg.authorName || senderNumber;
      
      let textLine = `${personName} (${senderNumber}): ${msg.messageBody}`;
      
      if (includeMedia && msg.mediaUrl && msg.mediaType && (msg.mediaType === 'image/jpeg' || msg.mediaType === 'image/png')) {
          const filename = path.basename(msg.mediaUrl);
          const filePath = path.join(UPLOADS_DIR, filename);
          if (fs.existsSync(filePath)) {
            recentImageIds.add(msg.id);
            foundImages++;
            textLine += ` [Image Attached]`;
          }
      }
      
      transcriptLines.push(textLine);
    }

    // 6. Map to members list
    const activeMembers = [];
    const passiveMembers = [];
    
    participantsClean.forEach(participant => {
      const count = messageCounts[participant] || 0;
      const contactInfo = contactMap[participant];
      const isInternal = contactInfo && contactInfo.group ? true : false;
      const roleGroup = isInternal ? contactInfo.group : '-';
      const name = contactInfo ? contactInfo.name : participant;
      
      const memberData = {
        phoneNumber: participant,
        realPhoneNumber: contactInfo ? contactInfo.realPhoneNumber : null,
        name: name,
        isInternal: isInternal,
        group: roleGroup,
        messageCount: count
      };

      if (count > 0) {
        activeMembers.push(memberData);
      } else {
        passiveMembers.push(memberData);
      }
    });
    
    // Sort active members by message count desc
    activeMembers.sort((a, b) => b.messageCount - a.messageCount);

    // 7. Perform AI Analysis
    let aiSummary = "Analisa AI tidak tersedia.";
    try {
        const analyticalModel = await getModelForRole('ANALYTICAL');

        const systemPrompt = `Anda adalah asisten AI ahli dalam menganalisa percakapan Grup WhatsApp.
Tugas Anda adalah membaca transkrip percakapan grup berikut dan menghasilkan laporan dengan format:

### Topik Pembicaraan
(Sebutkan topik-topik utama yang dibahas)

### Action
(Sebutkan tindakan atau instruksi apa saja yang muncul dari percakapan)

### Result
(Sebutkan hasil atau kesimpulan dari percakapan, atau keputusan yang diambil)

Gunakan bahasa Indonesia yang profesional dan jelas.`;

        // Truncate transcript to avoid token limits (Groq has limits)
        let transcriptString = transcriptLines.join('\n');
        if (transcriptString.length > 20000) {
            transcriptString = transcriptString.substring(transcriptString.length - 20000); 
            transcriptString = "[Bagian awal percakapan dipotong karena terlalu panjang...]\n" + transcriptString;
        }

        const completion = await openai.chat.completions.create({
            model: analyticalModel,
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: `Transkrip Percakapan Grup "${groupName}":\n\n${transcriptString}` }
            ],
            temperature: 0.2,
        });

        if (completion.choices && completion.choices.length > 0) {
            aiSummary = completion.choices[0]?.message?.content || "Analisa AI gagal.";
            aiSummary = aiSummary.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
        }
    } catch (aiError) {
        console.error("Error during AI Analysis:", aiError);
        aiSummary = `Gagal menghasilkan analisa AI: ${aiError.message}`;
    }

    // Add Audit Header
    const requestDate = new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' });
    const auditHeader = `**Laporan Analisa Grup: ${groupName}**\n` +
      `- **Dibuat oleh:** ${req.body.requestedBy || 'System'}\n` +
      `- **Tanggal Dibuat:** ${requestDate}\n` +
      `- **Periode Analisa:** ${req.body.dateFrom || '-'} s/d ${req.body.dateTo || '-'}\n\n---\n\n`;
      
    aiSummary = auditHeader + aiSummary;

    res.json({
      success: true,
      data: {
        groupName: groupName,
        totalMembers: allParticipants.length,
        activeCount: activeMembers.length,
        passiveCount: passiveMembers.length,
        activeMembers: activeMembers,
        passiveMembers: passiveMembers,
        aiSummary: aiSummary,
        messagesDetail: messages.map(m => ({
            id: m.id,
            timestamp: m.timestamp,
            sender: m.sender.split('@')[0],
            authorName: m.authorName || m.sender.split('@')[0],
            messageBody: m.messageBody,
            mediaUrl: m.mediaUrl,
            mediaType: m.mediaType
        }))
      }
    });

  } catch (error) {
    console.error('Error analyzing group:', error);
    res.status(500).json({ error: 'Failed to analyze group', details: error.message });
  }
});

// POST /api/group-analysis/send-report
router.post('/send-report', async (req, res) => {
  try {
    const { sessionId, contactNumber, reportData, format } = req.body;
    
    if (!sessionId || !contactNumber || !reportData) {
        return res.status(400).json({ error: 'Missing parameters' });
    }
    
    const sock = getSock(sessionId);
    if (!sock) {
        return res.status(404).json({ error: 'WhatsApp session not connected' });
    }

    const jid = `${contactNumber}@s.whatsapp.net`;
    
    // Construct simple text
    const textMessage = `*Hasil Analisa Grup WA*\n\n*Grup:* ${reportData.groupName}\n*Anggota:* ${reportData.totalMembers} Total, ${reportData.activeCount} Aktif, ${reportData.passiveCount} Pasif\n\n${reportData.aiSummary}`;
    
    if (format === 'text') {
        await sock.sendMessage(jid, { text: textMessage });
        return res.json({ success: true, message: 'Laporan text berhasil dikirim' });
    } 
    else if (format === 'pdf') {
        // Generate PDF
        const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: 'Helvetica', 'Arial', sans-serif; color: #333; line-height: 1.6; padding: 40px; }
            h1 { color: #1a73e8; text-align: center; border-bottom: 2px solid #1a73e8; padding-bottom: 10px;}
            h2 { color: #333; margin-top: 30px;}
            .stats { display: flex; justify-content: space-around; background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0; }
            .stat-box { text-align: center; }
            .stat-value { font-size: 24px; font-weight: bold; color: #1a73e8; }
            .stat-label { font-size: 14px; color: #666; }
            .markdown-body { margin-top: 20px; }
          </style>
        </head>
        <body>
          <h1>Laporan Analisa Grup WA</h1>
          <h2>Grup: ${reportData.groupName}</h2>
          
          <div class="stats">
             <div class="stat-box">
                <div class="stat-value">${reportData.totalMembers}</div>
                <div class="stat-label">Total Anggota</div>
             </div>
             <div class="stat-box">
                <div class="stat-value">${reportData.activeCount}</div>
                <div class="stat-label">Anggota Aktif</div>
             </div>
             <div class="stat-box">
                <div class="stat-value">${reportData.passiveCount}</div>
                <div class="stat-label">Anggota Pasif</div>
             </div>
          </div>

          <div class="markdown-body">
            ${marked.parse(reportData.aiSummary)}
          </div>
        </body>
        </html>
        `;

        const filename = `GroupAnalysis_${Date.now()}.pdf`;
        const filepath = path.join(UPLOADS_DIR, filename);
        
        await generatePDF(htmlContent, filepath);
        
        await sock.sendMessage(jid, { 
            document: { url: filepath }, 
            mimetype: 'application/pdf', 
            fileName: `Analisa_Grup_${reportData.groupName}.pdf`,
            caption: 'Terlampir laporan analisa grup WA.'
        });
        
        return res.json({ success: true, message: 'Laporan PDF berhasil dikirim' });
    } else {
        return res.status(400).json({ error: 'Invalid format' });
    }
  } catch (error) {
    console.error('Error sending report:', error);
    res.status(500).json({ error: 'Failed to send report', details: error.message });
  }
});

module.exports = router;
