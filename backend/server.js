process.env.TZ = 'Asia/Jakarta';
const dns = require('dns');
dns.setDefaultResultOrder('ipv4first');
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
// const { downloadMediaMessage } = require('@whiskeysockets/baileys');
const pino = require('pino');
const logger = pino({ level: 'silent' });
const { createClient, getSock, deleteSession } = require('./whatsapp');
const { initTelegramBot } = require('./telegram');
const cors = require('cors');
require('dotenv').config();

// Auto-resolve Windows host IP in WSL2 if connecting to host database
if (process.env.DATABASE_URL && process.platform === 'linux') {
  try {
    const fs = require('fs');
    if (fs.existsSync('/proc/sys/fs/binfmt_misc/WSLInterop')) {
      const { execSync } = require('child_process');
      const hostIp = execSync("ip route show default 2>/dev/null | awk '{print $3}'").toString().trim();
      if (hostIp && (process.env.DATABASE_URL.includes('@localhost:') || process.env.DATABASE_URL.includes('@127.0.0.1:') || /@172\.\d+\.\d+\.\d+:/.test(process.env.DATABASE_URL))) {
        process.env.DATABASE_URL = process.env.DATABASE_URL.replace(/@(localhost|127\.0\.0\.1|172\.\d+\.\d+\.\d+):/, `@${hostIp}:`);
      }
    }
  } catch (e) {}
}

const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');
const { OpenAI } = require('openai');
const bcrypt = require('bcryptjs');
const pdfParse = require('pdf-parse');

const { authenticateToken } = require('./middleware/auth');
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const profileRoutes = require('./routes/profile');
const reportScheduleRoutes = require('./routes/report-schedules');
const generalReportScheduleRoutes = require('./routes/general-report-schedules');
const dictionaryRoutes = require('./routes/dictionary');
const backupRoutes = require('./routes/backup');
const raportRoutes = require('./routes/raport');
const syncRoutes = require('./routes/syncRoutes');
const biChatRoutes = require('./routes/biChat');
const promptTemplateRoutes = require('./routes/promptTemplates');
const settingsRoutes = require('./routes/settings');
const aiModelRoutes = require('./routes/aiModels');
const { syncModelsFromOpenRouter } = require('./controllers/aiModelsController');
const templateRoutes = require('./routes/templateRoutes');
const broadcastRoutes = require('./routes/broadcastRoutes');
const personaRoutes = require('./routes/personas');
const contactRoutes = require('./routes/contacts');
const knowledgeRoutes = require('./routes/knowledgeRoutes');
const biRaportRoutes = require('./routes/biRaport');
const analyzeChatRoutes = require('./routes/analyzeChat');
const groupAnalysisRoutes = require('./routes/groupAnalysis');
const promosRoutes = require('./routes/promos');
const dashboardRoutes = require('./routes/dashboard');
const telegramBotsRoutes = require('./routes/telegramBots');
const webhookRoutes = require('./routes/webhook');
const dataSourcesRoutes = require('./routes/dataSources');
const issuesRoutes = require('./routes/issues');
const tasksRoutes = require('./routes/tasks');
const printJobsRoutes = require('./routes/printJobs');
const emailRoutes = require('./routes/email');
const salesCoverageRoutes = require('./routes/salesCoverageRoutes');
const miniAppRoutes   = require('./routes/miniApp');
const dbExplorerRoutes = require('./routes/dbExplorer');
require('./utils/broadcastService'); // Start broadcast cron job
const { startScheduler } = require('./scheduler');

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST', 'DELETE'],
  },
});

// Register io so other modules (e.g. chatbot status) can read active web users
const { setIO } = require('./utils/ioTracker');
setIO(io);


app.use(cors());
app.use(express.json());

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/report-schedules', reportScheduleRoutes);
app.use('/api/general-report-schedules', authenticateToken, generalReportScheduleRoutes);
app.use('/api/dictionary', dictionaryRoutes);
app.use('/api/backup', backupRoutes);
app.use('/api/raport', raportRoutes);
app.use('/api/sync', syncRoutes);
app.use('/api/bi-chat', authenticateToken, biChatRoutes);
app.use('/api/prompt-templates', authenticateToken, promptTemplateRoutes);
app.use('/api/settings', authenticateToken, settingsRoutes);
app.use('/api/models', authenticateToken, aiModelRoutes);
app.use('/api/templates', authenticateToken, templateRoutes);
app.use('/api/broadcasts', authenticateToken, broadcastRoutes);
app.use('/api/personas', authenticateToken, personaRoutes);
app.use('/api/contacts', authenticateToken, contactRoutes);
app.use('/api/knowledge', authenticateToken, knowledgeRoutes);
app.use('/api/bi-raport', authenticateToken, biRaportRoutes);
app.use('/api/analyze-chat', authenticateToken, analyzeChatRoutes);
app.use('/api/group-analysis', authenticateToken, groupAnalysisRoutes);
app.use('/api/promos', authenticateToken, promosRoutes);
app.use('/api/telegram-bots', authenticateToken, telegramBotsRoutes);
app.use('/api/dashboard', authenticateToken, dashboardRoutes);
app.use('/api/data-sources', authenticateToken, dataSourcesRoutes);
app.use('/api/issues', authenticateToken, issuesRoutes);
app.use('/api/tasks', authenticateToken, tasksRoutes);
app.use('/api/db', authenticateToken, dbExplorerRoutes);
app.use('/api/print-jobs', printJobsRoutes);
app.use('/api/email', authenticateToken, emailRoutes);
app.use('/api/sales-coverages', authenticateToken, salesCoverageRoutes);
app.use('/api/webhooks', webhookRoutes);
app.use('/api/mini-app', miniAppRoutes); // Telegram Mini Web App endpoints

// Serve Telegram Mini App static files
const MINI_APP_DIR = path.join(__dirname, '..', 'frontend', 'mini-app');
if (fs.existsSync(MINI_APP_DIR)) {
  app.use('/api/twa', express.static(MINI_APP_DIR));
}

// Setup uploads directory and static serving
const UPLOADS_DIR = path.join(__dirname, 'uploads');
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}
app.use('/uploads', express.static(UPLOADS_DIR));
app.use('/api/uploads', express.static(UPLOADS_DIR)); // Also serve under /api for proxying

// Also serve parent uploads directory (legacy path for older files)
const PARENT_UPLOADS_DIR = path.join(__dirname, '..', 'uploads');
if (fs.existsSync(PARENT_UPLOADS_DIR)) {
  app.use('/uploads', express.static(PARENT_UPLOADS_DIR));
  app.use('/api/uploads', express.static(PARENT_UPLOADS_DIR));
}

const prisma = new PrismaClient();
const PORT = process.env.PORT || 3000;


// Helper to format timestamps and phone numbers
const getNumber = (id) => {
  if (!id) return 'Unknown';
  return id.split('@')[0];
};

const saveMessage = async (msg, sessionId, sock) => {
  try {
    const isFromMe = msg.key.fromMe;
    const remoteJid = msg.key.remoteJid;
    
    // Baileys provides the self jid in sock.user
    const myJid = sock?.user?.id || '';
    const myNumber = getNumber(myJid.split(':')[0]); // Remove device prefix
    
    let sender = isFromMe ? myNumber : getNumber(remoteJid);
    let receiver = isFromMe ? getNumber(remoteJid) : myNumber;
    
    let chatName = null;
    let authorName = msg.pushName || null;
    let authorId = null;

    // Handle group messages
    if (remoteJid.endsWith('@g.us')) {
        authorId = msg.key.participant ? getNumber(msg.key.participant) : sender;
        if (!isFromMe) {
            sender = getNumber(remoteJid);
        }
        
        // Fetch and cache group name
        if (!global.groupNameCache) global.groupNameCache = new Map();
        if (global.groupNameCache.has(remoteJid)) {
            chatName = global.groupNameCache.get(remoteJid);
        } else {
            try {
                const metadata = await sock.groupMetadata(remoteJid);
                if (metadata && metadata.subject) {
                    chatName = metadata.subject;
                    global.groupNameCache.set(remoteJid, chatName);
                }
            } catch (err) {
                // Ignore error if we can't fetch metadata
            }
        }
    } else {
        if (!isFromMe) {
            chatName = msg.pushName || getNumber(remoteJid);
        }
    }

    // Check if chat is excluded
    const partnerId = isFromMe ? receiver : sender; 
    const isExcluded = await prisma.excludedChat.findFirst({
      where: { sessionId, chatId: partnerId }
    });
    if (isExcluded) return; 

    // Extract text content
    let messageBody = msg.message?.conversation 
        || msg.message?.extendedTextMessage?.text 
        || msg.message?.imageMessage?.caption 
        || msg.message?.videoMessage?.caption 
        || msg.message?.documentMessage?.caption 
        || '';
        
    if (msg.message?.locationMessage) {
        messageBody = messageBody || 'share_location';
    }

    let isStatus = remoteJid === 'status@broadcast';
    
    let ts = msg.messageTimestamp;
    if (ts && typeof ts === 'object') {
        ts = ts.toNumber ? ts.toNumber() : (ts.low || ts.high || Math.floor(Date.now() / 1000));
    }
    const msgTimestamp = new Date((Number(ts) || Math.floor(Date.now() / 1000)) * 1000);
    const existingMessage = await prisma.message.findFirst({
      where: {
        sessionId,
        sender,
        timestamp: msgTimestamp,
        messageBody: messageBody
      }
    });

    if (existingMessage) return;
    
    let mediaUrl = null;
    let mediaType = null;

    if (msg.message?.locationMessage) {
      mediaType = 'location';
      mediaUrl = `https://maps.google.com/?q=${msg.message.locationMessage.degreesLatitude},${msg.message.locationMessage.degreesLongitude}`;
    } else {
      const hasMedia = msg.message?.imageMessage || msg.message?.videoMessage || msg.message?.documentMessage || msg.message?.audioMessage || msg.message?.stickerMessage;
      
      if (hasMedia) {
        // Media download is no longer handled via Baileys. 
        // For TapTalk webhook, media would typically come as URLs in the webhook payload.
        const fallbackText = `[Media - attachment received]`;
        if (!messageBody) messageBody = fallbackText;
        else messageBody = `${messageBody}\n\n${fallbackText}`;
      }
    }
    
    // Auto-save contact for incoming messages
    if (!isFromMe && !isStatus) {
      let contactPhone = remoteJid.endsWith('@g.us') ? (msg.key.participant ? getNumber(msg.key.participant) : sender) : sender;
      let contactWaId = remoteJid.endsWith('@g.us') ? (msg.key.participant || sender + '@s.whatsapp.net') : remoteJid;
      let contactName = authorName || chatName || contactPhone;

      if (contactPhone && contactPhone !== 'Unknown') {
        try {
          const existingContact = await prisma.contact.findFirst({
            where: { phoneNumber: contactPhone }
          });
          
          if (existingContact) {
            if (contactName !== contactPhone && existingContact.name === existingContact.phoneNumber) {
              await prisma.contact.update({
                where: { id: existingContact.id },
                data: { name: contactName }
              });
            }
          } else {
            await prisma.contact.create({
              data: {
                whatsappId: contactWaId,
                phoneNumber: contactPhone,
                name: contactName
              }
            });
          }
        } catch (e) {
          console.error('[Contact AutoSave] Error:', e.message);
        }
      }
    }

    const savedMessage = await prisma.message.create({
      data: {
        sessionId,
        sender,
        receiver,
        chatName,
        messageBody,
        isFromMe,
        mediaUrl,
        mediaType,
        authorId,
        authorName,
        isStatus,
        timestamp: msgTimestamp
      }
    });

    console.log(`Message saved for session ${sessionId}:`, savedMessage.id);
    io.emit('new_message', savedMessage);
  } catch (err) {
    console.error(`Error saving message for session ${sessionId}:`, err);
  }
};

const initializeClient = async (sessionId) => {
  if (sessionId.startsWith('telegram-')) {
    return;
  }
  
  if (sessionId === 'taptalk') {
    // TapTalk handles connection externally via webhook
    await prisma.session.update({
      where: { sessionId },
      data: { status: 'ready' }
    }).catch(err => console.error("Prisma Error:", err));
    return;
  }
  
  // For other session IDs (Baileys), create client
  try {
    await createClient(sessionId, io, saveMessage);
  } catch (error) {
    console.error(`Failed to initialize WhatsApp client for session ${sessionId}:`, error);
  }
};

// Initialize existing sessions from DB on startup
const initializeSessions = async () => {
  try {
    const activeSessions = await prisma.session.findMany({
      where: {
        status: {
          not: 'disconnected'
        }
      }
    });
    for (const session of activeSessions) {
      if (session.sessionId.startsWith('telegram-')) {
        await prisma.session.update({
          where: { sessionId: session.sessionId },
          data: { status: 'ready' }
        }).catch(err => console.error("Prisma Error:", err));
        continue;
      }
      console.log(`Re-initializing session: ${session.sessionId}`);
      initializeClient(session.sessionId);
    }
  } catch (error) {
    console.error('Failed to initialize sessions from DB:', error);
  }
};
initializeSessions();

// Session APIs
app.use('/api/sessions', authenticateToken);
app.post('/api/sessions', async (req, res) => {
  try {
    const { name } = req.body;
    if (!name) {
      return res.status(400).json({ error: 'Name is required' });
    }
    const sessionId = `device-${Date.now()}`;
    const session = await prisma.session.create({
      data: {
        sessionId,
        name,
        status: 'initializing',
        users: {
          connect: { id: req.user.id }
        }
      }
    });
    
    // Auto-recover orphaned schedules for this user (schedules from a previously deleted device)
    await prisma.reportSchedule.updateMany({
      where: {
        createdBy: req.user.id,
        sessionId: null
      },
      data: {
        sessionId: session.sessionId
      }
    });
    
    // Auto-recover orphaned excluded chats safely
    const orphanedExcludedChats = await prisma.excludedChat.findMany({
      where: { sessionId: null }
    });

    if (orphanedExcludedChats.length > 0) {
      const seenChats = new Set();
      const duplicateIds = [];
      const uniqueIds = [];

      for (const chat of orphanedExcludedChats) {
        if (seenChats.has(chat.chatId)) {
          duplicateIds.push(chat.id);
        } else {
          seenChats.add(chat.chatId);
          uniqueIds.push(chat.id);
        }
      }

      if (duplicateIds.length > 0) {
        await prisma.excludedChat.deleteMany({
          where: { id: { in: duplicateIds } }
        });
      }

      if (uniqueIds.length > 0) {
        await prisma.excludedChat.updateMany({
          where: { id: { in: uniqueIds } },
          data: { sessionId: session.sessionId }
        });
      }
    }

    // Auto-recover orphaned payment extractions
    await prisma.paymentExtraction.updateMany({
      where: { sessionId: null },
      data: { sessionId: session.sessionId }
    });
    
    initializeClient(sessionId);
    res.json(session);
  } catch (error) {
    console.error('Error creating session:', error);
    res.status(500).json({ error: 'Failed to create session' });
  }
});

app.get('/api/sessions', async (req, res) => {
  try {
    let whereClause = {};
    if (req.user.role !== 'DEVELOPER') {
      whereClause = {
        users: {
          some: { id: req.user.id }
        }
      };
    }

    const sessions = await prisma.session.findMany({
      where: whereClause,
      orderBy: { createdAt: 'desc' }
    });
    res.json(sessions);
  } catch (error) {
    console.error('Error fetching sessions:', error);
    res.status(500).json({ error: 'Failed to fetch sessions' });
  }
});

app.post('/api/sessions/:sessionId/reinitialize', async (req, res) => {
  try {
    const { sessionId } = req.params;
    
    // TapTalk sessions are always ready, we just update the DB status to reflect it
    await prisma.session.update({
      where: { sessionId },
      data: { status: 'ready' }
    });
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error reinitializing session:', error);
    res.status(500).json({ error: 'Failed to reinitialize session' });
  }
});

app.delete('/api/sessions/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;
    
    await prisma.session.delete({
      where: { sessionId }
    });
    
    // Also delete local auth data
    const sessionDir = path.join(__dirname, 'sessions', `session-${sessionId}`);
    if (fs.existsSync(sessionDir)) {
      fs.rmSync(sessionDir, { recursive: true, force: true });
    }
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting session:', error);
    res.status(500).json({ error: 'Failed to delete session' });
  }
});

app.post('/api/sessions/migrate', async (req, res) => {
  try {
    const { oldSessionId, newSessionId } = req.body;

    if (!oldSessionId || !newSessionId) {
      return res.status(400).json({ error: 'oldSessionId and newSessionId are required' });
    }

    if (oldSessionId === newSessionId) {
      return res.status(400).json({ error: 'oldSessionId and newSessionId cannot be the same' });
    }

    // Check if both sessions exist
    const oldSession = await prisma.session.findUnique({ where: { sessionId: oldSessionId } });
    const newSession = await prisma.session.findUnique({ where: { sessionId: newSessionId } });

    if (!oldSession) return res.status(404).json({ error: 'Old session not found' });
    if (!newSession) return res.status(404).json({ error: 'New session not found' });

    // Handle unique constraint conflicts for ExcludedChat
    const existingExcludedChats = await prisma.excludedChat.findMany({ where: { sessionId: newSessionId } });
    if (existingExcludedChats.length > 0) {
      const existingChatIds = existingExcludedChats.map(e => e.chatId);
      await prisma.excludedChat.deleteMany({
        where: {
          sessionId: oldSessionId,
          chatId: { in: existingChatIds }
        }
      });
    }

    // Handle unique constraint conflicts for ReportCard
    const existingReportCards = await prisma.reportCard.findMany({ where: { sessionId: newSessionId } });
    if (existingReportCards.length > 0) {
      const orConditions = existingReportCards.map(rc => ({
        sessionId: oldSessionId,
        type: rc.type,
        scope: rc.scope,
        date: rc.date,
        contactNumber: rc.contactNumber
      }));
      await prisma.reportCard.deleteMany({
        where: { OR: orConditions }
      });
    }

    // Perform the migration
    await prisma.$transaction([
      prisma.message.updateMany({ where: { sessionId: oldSessionId }, data: { sessionId: newSessionId } }),
      prisma.reportSchedule.updateMany({ where: { sessionId: oldSessionId }, data: { sessionId: newSessionId } }),
      prisma.excludedChat.updateMany({ where: { sessionId: oldSessionId }, data: { sessionId: newSessionId } }),
      prisma.reportCard.updateMany({ where: { sessionId: oldSessionId }, data: { sessionId: newSessionId } }),
      prisma.paymentExtraction.updateMany({ where: { sessionId: oldSessionId }, data: { sessionId: newSessionId } }),
      prisma.broadcast.updateMany({ where: { sessionId: oldSessionId }, data: { sessionId: newSessionId } })
    ]);

    // Delete the old session record from DB
    await prisma.session.delete({
      where: { sessionId: oldSessionId }
    });

    res.json({ success: true, message: 'Data migrated successfully' });
  } catch (error) {
    console.error('Error migrating session:', error);
    res.status(500).json({ error: 'Failed to migrate session data' });
  }
});

// Get unique chats for a session
app.get('/api/sessions/:sessionId/chats', authenticateToken, async (req, res) => {
  try {
    const { sessionId } = req.params;
    const messages = await prisma.message.findMany({
      where: { sessionId },
      select: { sender: true, receiver: true, chatName: true, isFromMe: true },
      distinct: ['sender', 'receiver']
    });
    
    const chatMap = new Map();
    for (const msg of messages) {
      const partnerId = msg.isFromMe ? msg.receiver : msg.sender;
      if (!chatMap.has(partnerId)) {
        chatMap.set(partnerId, {
          id: partnerId,
          name: msg.chatName || partnerId
        });
      }
    }
    
    res.json(Array.from(chatMap.values()));
  } catch (error) {
    console.error('Error fetching chats:', error);
    res.status(500).json({ error: 'Failed to fetch chats' });
  }
});

// Excluded Chats APIs

// Get exclusions across all sessions (with optional sessionId filter)
app.get('/api/exclusions', authenticateToken, async (req, res) => {
  try {
    const { sessionId } = req.query;
    const where = sessionId ? { sessionId } : {};
    const exclusions = await prisma.excludedChat.findMany({
      where,
      orderBy: { createdAt: 'desc' }
    });
    res.json(exclusions);
  } catch (error) {
    console.error('Error fetching all exclusions:', error);
    res.status(500).json({ error: 'Failed to fetch exclusions' });
  }
});

app.get('/api/sessions/:sessionId/exclusions', authenticateToken, async (req, res) => {
  try {
    const { sessionId } = req.params;
    const exclusions = await prisma.excludedChat.findMany({
      where: { sessionId }
    });
    res.json(exclusions);
  } catch (error) {
    console.error('Error fetching exclusions:', error);
    res.status(500).json({ error: 'Failed to fetch exclusions' });
  }
});

app.post('/api/sessions/:sessionId/exclusions', authenticateToken, async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { chatId, name } = req.body;
    
    if (!chatId) return res.status(400).json({ error: 'chatId is required' });
    
    const exclusion = await prisma.excludedChat.upsert({
      where: {
        sessionId_chatId: {
          sessionId,
          chatId
        }
      },
      update: { name },
      create: {
        sessionId,
        chatId,
        name
      }
    });
    res.json(exclusion);
  } catch (error) {
    console.error('Error adding exclusion:', error);
    res.status(500).json({ error: 'Failed to add exclusion' });
  }
});

app.delete('/api/sessions/:sessionId/exclusions/:chatId', authenticateToken, async (req, res) => {
  try {
    const { sessionId, chatId } = req.params;
    await prisma.excludedChat.deleteMany({
      where: { sessionId, chatId }
    });
    res.json({ success: true });
  } catch (error) {
    console.error('Error removing exclusion:', error);
    res.status(500).json({ error: 'Failed to remove exclusion' });
  }
});

// Messages APIs
app.use('/api/messages', authenticateToken);
app.get('/api/messages/unique-chats', async (req, res) => {
  try {
    const chats = await prisma.message.findMany({
      where: { chatName: { not: null } },
      select: { chatName: true },
      distinct: ['chatName']
    });
    res.json(chats.map(c => c.chatName).filter(Boolean).sort());
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
app.get('/api/messages', async (req, res) => {
  try {
    const { sessionId, startDate, endDate } = req.query;
    
    const where = { isStatus: false };
    if (sessionId) {
      where.sessionId = sessionId;
    }
    
    if (startDate || endDate) {
      where.timestamp = {};
      if (startDate) {
        where.timestamp.gte = new Date(startDate);
      }
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        where.timestamp.lte = end;
      }
    }
    
    const messages = await prisma.message.findMany({
      where,
      orderBy: { timestamp: 'desc' },
    });
    res.json(messages);
  } catch (error) {
    console.error('Error fetching messages:', error);
    res.status(500).json({ error: 'Failed to fetch messages' });
  }
});

// Removed duplicate unauthenticated profile-pic route — see authenticated version below

app.post('/api/sessions/:sessionId/sync-chat', authenticateToken, async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { chatId } = req.body;
    
    if (!chatId) {
      return res.status(400).json({ error: 'chatId is required' });
    }

    const client = getSock(sessionId);
    if (!client) {
      return res.status(404).json({ error: 'WhatsApp client not connected' });
    }

    const lastMsg = await prisma.message.findFirst({
      where: { 
        sessionId,
        OR: [
          { sender: chatId },
          { receiver: chatId }
        ]
      },
      orderBy: { timestamp: 'desc' }
    });
    
    // Fallback to 30 days ago if no history
    const lastSavedTimestamp = lastMsg ? Math.floor(new Date(lastMsg.timestamp).getTime() / 1000) : Math.floor(Date.now() / 1000) - (30 * 24 * 60 * 60);

    // With Baileys, we cannot directly fetch older messages from the device on-demand 
    // unless they were captured during the initial history sync.
    // Here we will just acknowledge the sync request and emit completion.
    // To truly sync past history, the user must rely on the Baileys `messaging-history.set` event,
    // which automatically fires on first login and can be captured if implemented.
    res.json({ success: true, message: 'Sync capability is limited in Baileys. Currently showing messages from DB.' });
    io.emit('sync_complete', { sessionId, chatId, savedCount: 0, message: 'Sync complete (DB only).' });

  } catch (error) {
    console.error('Error in sync-chat API:', error);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Failed to start sync' });
    }
  }
});


// In-memory cache for profile pictures to avoid WhatsApp server rate limits
const profilePicCache = new Map();

app.use('/api/profile-pic', authenticateToken);
app.get('/api/profile-pic', async (req, res) => {
  try {
    const { sessionId, id } = req.query;
    if (!sessionId || !id) {
      return res.status(400).json({ error: 'Missing parameters' });
    }
    
    const cacheKey = `${sessionId}-${id}`;
    if (profilePicCache.has(cacheKey)) {
      return res.json({ url: profilePicCache.get(cacheKey) });
    }

    const client = getSock(sessionId);
    if (!client) {
      return res.status(404).json({ error: 'Session not found' });
    }

    const sessionDB = await prisma.session.findUnique({ where: { sessionId } });
    if (!sessionDB || sessionDB.status !== 'ready') {
      return res.json({ url: null });
    }

    // append suffix if not present
    let contactId = id;
    if (!contactId.includes('@')) {
      // Determine if group or user
      contactId = (id.includes('-') || id.length > 15) ? `${id}@g.us` : `${id}@c.us`;
    }

    try {
      const url = await client.profilePictureUrl(contactId);
      
      profilePicCache.set(cacheKey, url || null);
      res.json({ url: url || null });
    } catch (e) {
      profilePicCache.set(cacheKey, null);
      res.json({ url: null });
    }
  } catch (error) {
    res.json({ url: null });
  }
});

// ============================================================
// CHATBOT SETTINGS & WHITELIST APIs
// ============================================================

// Get chatbot settings
app.get('/api/chatbot/settings', authenticateToken, async (req, res) => {
  try {
    const enabledSetting = await prisma.appSetting.findUnique({ where: { key: 'chatbot_enabled_sessions' } });
    const modeSetting = await prisma.appSetting.findUnique({ where: { key: 'chatbot_whitelist_mode' } });
    const modelSetting = await prisma.appSetting.findUnique({ where: { key: 'chatbot_model' } });

    const enabledSessions = enabledSetting ? JSON.parse(enabledSetting.value || '[]') : [];
    const whitelistMode = modeSetting?.value || 'all'; // 'all' or 'whitelist'
    const chatbotModel = modelSetting?.value || '';

    res.json({ enabledSessions, whitelistMode, chatbotModel });
  } catch (error) {
    console.error('Error fetching chatbot settings:', error);
    res.status(500).json({ error: 'Failed to fetch chatbot settings' });
  }
});

// Update chatbot settings
app.post('/api/chatbot/settings', authenticateToken, async (req, res) => {
  try {
    const { enabledSessions, whitelistMode, chatbotModel } = req.body;

    if (enabledSessions !== undefined) {
      await prisma.appSetting.upsert({
        where: { key: 'chatbot_enabled_sessions' },
        update: { value: JSON.stringify(enabledSessions) },
        create: { key: 'chatbot_enabled_sessions', value: JSON.stringify(enabledSessions) },
      });
    }

    if (whitelistMode !== undefined) {
      await prisma.appSetting.upsert({
        where: { key: 'chatbot_whitelist_mode' },
        update: { value: whitelistMode },
        create: { key: 'chatbot_whitelist_mode', value: whitelistMode },
      });
    }

    if (chatbotModel !== undefined) {
      await prisma.appSetting.upsert({
        where: { key: 'chatbot_model' },
        update: { value: chatbotModel },
        create: { key: 'chatbot_model', value: chatbotModel },
      });
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Error updating chatbot settings:', error);
    res.status(500).json({ error: 'Failed to update chatbot settings' });
  }
});

// Get whitelist entries
app.get('/api/chatbot/whitelist', authenticateToken, async (req, res) => {
  try {
    const whitelist = await prisma.chatbotWhitelist.findMany({
      orderBy: { createdAt: 'desc' },
    });
    res.json(whitelist);
  } catch (error) {
    console.error('Error fetching whitelist:', error);
    res.status(500).json({ error: 'Failed to fetch whitelist' });
  }
});

// Get unique contacts from message history for picker
app.get('/api/chatbot/contacts', authenticateToken, async (req, res) => {
  try {
    // Fetch unique senders and their last known name from the Message table
    const messages = await prisma.message.findMany({
      where: { isFromMe: false },
      select: { sender: true, chatName: true },
      distinct: ['sender'],
      orderBy: { createdAt: 'desc' }
    });

    // Map and filter out nulls/unknowns
    const contacts = messages
      .filter(m => m.sender && !m.sender.includes('@g.us') && !m.sender.includes('@broadcast'))
      .map(m => ({
        id: m.sender,
        name: m.chatName || m.sender,
        phoneNumber: m.sender
      }));

    res.json(contacts);
  } catch (error) {
    console.error('Error fetching chatbot contacts:', error);
    res.status(500).json({ error: 'Failed to fetch contacts' });
  }
});

// Add to whitelist
app.post('/api/chatbot/whitelist', authenticateToken, async (req, res) => {
  try {
    const { phoneNumber, name } = req.body;
    if (!phoneNumber) return res.status(400).json({ error: 'phoneNumber is required' });

    // Normalize phone number (remove +, spaces, dashes)
    const normalized = phoneNumber.replace(/[\s\-\+]/g, '');

    const entry = await prisma.chatbotWhitelist.upsert({
      where: { phoneNumber: normalized },
      update: { name: name || null, isActive: true },
      create: { phoneNumber: normalized, name: name || null },
    });
    res.json(entry);
  } catch (error) {
    console.error('Error adding to whitelist:', error);
    res.status(500).json({ error: 'Failed to add to whitelist' });
  }
});

// Toggle whitelist entry active/inactive
app.patch('/api/chatbot/whitelist/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { isActive, name } = req.body;

    const data = {};
    if (isActive !== undefined) data.isActive = isActive;
    if (name !== undefined) data.name = name;

    const entry = await prisma.chatbotWhitelist.update({
      where: { id },
      data,
    });
    res.json(entry);
  } catch (error) {
    console.error('Error updating whitelist entry:', error);
    res.status(500).json({ error: 'Failed to update whitelist entry' });
  }
});

// Delete from whitelist
app.delete('/api/chatbot/whitelist/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    await prisma.chatbotWhitelist.delete({ where: { id } });
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting from whitelist:', error);
    res.status(500).json({ error: 'Failed to delete from whitelist' });
  }
});

app.get('/api/status', (req, res) => {
  res.json({ running: true, activeClients: (typeof clients !== 'undefined' && clients ? clients.size : 0) });
});

// Serve frontend production build if available
const FRONTEND_DIST = path.join(__dirname, '..', 'frontend', 'dist');
if (fs.existsSync(FRONTEND_DIST)) {
  app.use(express.static(FRONTEND_DIST));
  app.use((req, res, next) => {
    if (req.method !== 'GET') return next();
    if (req.path.startsWith('/api') || req.path.startsWith('/uploads')) {
      return next();
    }
    res.sendFile(path.join(FRONTEND_DIST, 'index.html'));
  });
} else {
  app.get('/', (req, res) => {
    res.send('WhatsApp Dashboard Backend is running with Multi-Device support.');
  });
}

const seedDeveloperUser = async () => {
  try {
    const existing = await prisma.user.findUnique({ where: { username: 'KUSYANDI' } });
    if (!existing) {
      const hashedPassword = await bcrypt.hash('Padma23#@!', 10);
      await prisma.user.create({
        data: {
          username: 'KUSYANDI',
          password: hashedPassword,
          role: 'DEVELOPER'
        }
      });
      console.log('Default developer user created.');
    }
  } catch (err) {
    console.error('Failed to seed user:', err);
  }
};

server.listen(PORT, async () => {
  await seedDeveloperUser();
  console.log(`Backend server is running on http://localhost:${PORT}`);
  
  // Start the scheduler, passing the clients map so it can send messages
  startScheduler();
  
  // Initialize Telegram Bot
  initTelegramBot(io);
  
  // Sync AI models from OpenRouter asynchronously in the background
  setTimeout(() => {
    syncModelsFromOpenRouter();
  }, 2500);
});
