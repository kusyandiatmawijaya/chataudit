const {
    default: makeWASocket,
    useMultiFileAuthState,
    DisconnectReason,
    fetchLatestBaileysVersion,
    downloadMediaMessage,
    makeCacheableSignalKeyStore,
    proto,
} = require('@whiskeysockets/baileys');
const { Boom } = require('@hapi/boom');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const pino = require('pino');
const path = require('path');
const fs = require('fs');
const { handleIncomingMessage } = require('./chatbotHandler');
const WhatsAppAdapter = require('./adapters/WhatsAppAdapter');

// Logger specifically for Baileys
const logger = pino({ level: 'silent' });

// Global sockets map for multi-session support
const sockets = new Map();

/**
 * Initializes and connects to WhatsApp using Baileys.
 * @param {string} sessionId The unique session ID
 * @param {object} io The Socket.io instance for emitting events to frontend
 * @param {function} saveMessageCallback Callback to save messages to DB
 */
async function createClient(sessionId, io, saveMessageCallback) {
    const sessionDir = path.join(__dirname, 'sessions', `baileys-${sessionId}`);
    
    // 1. Initialization & Authentication
    const { state, saveCreds } = await useMultiFileAuthState(sessionDir);
    const { version, isLatest } = await fetchLatestBaileysVersion();
    
    console.log(`[Baileys] Session ${sessionId} initializing using WA v${version.join('.')}`);

    const sock = makeWASocket({
        version,
        logger,
        printQRInTerminal: false,
        auth: {
            creds: state.creds,
            keys: makeCacheableSignalKeyStore(state.keys, logger),
        },
        generateHighQualityLinkPreview: true,
        getMessage: async (key) => {
            return { conversation: '' }; // Stub, usually needs a DB lookup if we want full resend support
        }
    });

    // Store in our active sockets map
    sockets.set(sessionId, sock);

    sock.ev.on('creds.update', saveCreds);

    // 2. Connection State & Auto-Reconnect
    sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update;
        
        if (qr) {
            console.log(`[Baileys] QR Code generated for session ${sessionId}.`);
            io.emit('qr', { sessionId, qr });
        }

        if (connection === 'close') {
            const reason = lastDisconnect?.error?.output?.statusCode;
            const shouldReconnect = reason !== DisconnectReason.loggedOut;
            
            console.log(`[Baileys] Connection closed for ${sessionId} (Reason: ${reason}). Reconnecting: ${shouldReconnect}`);
            
            if (shouldReconnect) {
                // Try to reconnect immediately
                createClient(sessionId, io, saveMessageCallback);
            } else {
                console.log(`[Baileys] Logged out from session ${sessionId}.`);
                sockets.delete(sessionId);
                // Update DB status to disconnected
                await prisma.session.update({
                    where: { sessionId },
                    data: { status: 'disconnected' }
                }).catch(err => console.error("[Baileys] Prisma Error updating status to disconnected:", err));
                io.emit('disconnected', { sessionId, reason });
            }
        } else if (connection === 'open') {
            console.log(`[Baileys] Session ${sessionId} is ready and authenticated!`);
            // Update DB status to ready — this runs on EVERY socket (including reconnected ones)
            await prisma.session.update({
                where: { sessionId },
                data: { status: 'ready' }
            }).catch(err => console.error("[Baileys] Prisma Error updating status to ready:", err));
            io.emit('authenticated', { sessionId, message: 'Authenticated successfully!' });
            io.emit('ready', { sessionId, message: 'WhatsApp Client is ready!' });
        }
    });

    // 3. Message Handling
    sock.ev.on('messages.upsert', async (m) => {
        // We care about new messages ('notify') and own/companion sent messages ('append')
        if (m.type !== 'notify' && m.type !== 'append') return;

        for (const msg of m.messages) {
            // Forward to the saveMessage logic defined in server.js
            if (saveMessageCallback) {
                await saveMessageCallback(msg, sessionId, sock);
            }

            // Process through AI chatbot handler ONLY for new messages ('notify')
            if (m.type === 'notify') {
                const normalizedMsg = WhatsAppAdapter.normalizeMessage(msg);
                if (normalizedMsg) {
                    const clientAdapter = new WhatsAppAdapter(sock);
                    handleIncomingMessage(normalizedMsg, sessionId, clientAdapter).catch((err) => {
                        console.error('[Chatbot] Unhandled error in message handler:', err);
                    });
                }
            }
        }
    });

    sock.ev.on('messages.update', async (updates) => {
        for (const update of updates) {
            if (update.update && typeof update.update.status === 'number') {
                const messageId = update.key.id;
                let statusText = 'UNKNOWN';
                
                switch (update.update.status) {
                    case proto.WebMessageInfo.Status.ERROR: statusText = 'ERROR'; break;
                    case proto.WebMessageInfo.Status.PENDING: statusText = 'PENDING'; break;
                    case proto.WebMessageInfo.Status.SERVER_ACK: statusText = 'SERVER_ACK'; break;
                    case proto.WebMessageInfo.Status.DELIVERY_ACK: statusText = 'DELIVERY_ACK'; break;
                    case proto.WebMessageInfo.Status.READ: statusText = 'READ'; break;
                    case proto.WebMessageInfo.Status.PLAYED: statusText = 'PLAYED'; break;
                }

                try {
                    await prisma.broadcastRecipient.update({
                        where: { messageId: messageId },
                        data: { deliveryStatus: statusText, updatedAt: new Date() }
                    });
                    console.log(`[Status] Broadcast ID ${messageId} -> ${statusText}`);
                } catch (err) {
                    if (err.code !== 'P2025') { 
                        console.error('Error updating delivery status:', err);
                    }
                }
            }
        }
    });

    sock.ev.on('message-receipt.update', async (updates) => {
        for (const { key, receipt } of updates) {
            if (!key || !receipt) continue;
            
            const messageId = key.id;
            let statusText = null;

            if (receipt.playedTimestamp) {
                statusText = 'PLAYED';
            } else if (receipt.readTimestamp) {
                statusText = 'READ';
            } else if (receipt.receiptTimestamp) {
                statusText = 'DELIVERY_ACK';
            }

            if (statusText) {
                try {
                    await prisma.broadcastRecipient.update({
                        where: { messageId: messageId },
                        data: { deliveryStatus: statusText, updatedAt: new Date() }
                    });
                    console.log(`[Receipt] Broadcast ID ${messageId} -> ${statusText}`);
                } catch (err) {
                    if (err.code !== 'P2025') { 
                        console.error('Error updating delivery status from receipt:', err);
                    }
                }
            }
        }
    });
    
    return sock;
}

function getSock(sessionId) {
    return sockets.get(sessionId);
}

function getFirstConnectedSock() {
    return Array.from(sockets.values())[0] || null;
}

async function deleteSession(sessionId) {
    const sock = sockets.get(sessionId);
    if (sock) {
        await sock.logout('Delete session requested');
        sockets.delete(sessionId);
    }
    
    const sessionDir = path.join(__dirname, 'sessions', `baileys-${sessionId}`);
    if (fs.existsSync(sessionDir)) {
        fs.rmSync(sessionDir, { recursive: true, force: true });
    }
}

module.exports = {
    createClient,
    getSock,
    getFirstConnectedSock,
    deleteSession,
};
