const { handleIncomingMessage } = require('../chatbotHandler');
const { sendWhatsAppMessage, sendWhatsAppImage } = require('./taptalk.service');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { getIO } = require('../utils/ioTracker');

let bannedKeywordsCache = [];
let lastBannedKeywordsFetch = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

async function getBannedKeywords() {
    if (Date.now() - lastBannedKeywordsFetch > CACHE_TTL || bannedKeywordsCache.length === 0) {
        try {
            const setting = await prisma.appSetting.findUnique({ where: { key: 'banned_keywords' } });
            if (setting && setting.value) {
                bannedKeywordsCache = setting.value.split(',').map(k => k.trim().toLowerCase()).filter(k => k);
            }
            lastBannedKeywordsFetch = Date.now();
        } catch (e) {
            console.error('Error fetching banned keywords:', e);
        }
    }
    return bannedKeywordsCache;
}

/**
 * Core Handler Service
 * Unified message processing for different platforms.
 */
const processIncomingMessage = async ({ platform, senderId, text, caseId, senderName }) => {
    let formattedSenderId = senderId;
    if (platform === 'whatsapp' && senderId && !senderId.includes('@g.us')) {
        let cleaned = senderId.toString().replace(/\D/g, '');
        if (cleaned.startsWith('0')) cleaned = '62' + cleaned.substring(1);
        else if (cleaned.startsWith('8')) cleaned = '62' + cleaned;
        formattedSenderId = `${cleaned}@s.whatsapp.net`;
    }
    
    console.log(`[coreHandler] Processing incoming ${platform} message from ${senderId} (normalized: ${formattedSenderId}): ${text}`);
    
    if (platform === 'whatsapp') {
        // Create a normalized message object expected by handleIncomingMessage
        const normalizedMsg = {
            platform: 'whatsapp',
            senderId: formattedSenderId,
            senderNumber: formattedSenderId,
            phoneNumber: senderId, // keep original for reference
            senderName: senderName || senderId, // Use extracted senderName
            text: text,
            messageId: Date.now().toString(),
            rawMessage: { caseId }
        };

        try {
            // Cek status bot di database
            let contact = await prisma.contact.findFirst({
                where: { 
                    OR: [
                        { phoneNumber: senderId }, // original e.g. 628111101625
                        { whatsappId: formattedSenderId } // normalized e.g. 628111101625@s.whatsapp.net
                    ]
                }
            });

            if (!contact) {
                contact = await prisma.contact.create({
                    data: {
                        name: senderName || formattedSenderId,
                        phoneNumber: senderId, // save original phone without @s.whatsapp.net
                        whatsappId: formattedSenderId,
                        botStatus: 'BOT_ACTIVE',
                        isAllowed: true
                    }
                });
                console.log(`[coreHandler] Auto-created new contact for ${formattedSenderId}`);
            }

            if (contact && (contact.botStatus === 'BLOCKED' || !contact.isAllowed)) {
                console.log(`[coreHandler] Ignored message from ${formattedSenderId} because status is BLOCKED or not allowed`);
                return;
            }

            if (contact && contact.botStatus === 'IGNORE_USER') {
                if (contact.ignoredUntil && new Date() < contact.ignoredUntil) {
                    console.log(`[coreHandler] Ignored message from ${formattedSenderId} because status is IGNORE_USER (Silent Drop until ${contact.ignoredUntil})`);
                    return;
                } else {
                    // Ignore period has passed, reset to BOT_ACTIVE
                    contact = await prisma.contact.update({
                        where: { id: contact.id },
                        data: { botStatus: 'BOT_ACTIVE', ignoredUntil: null }
                    });
                    console.log(`[coreHandler] Ignore period expired for ${formattedSenderId}, resetting to BOT_ACTIVE`);
                }
            }

            if (contact && contact.botStatus === 'HUMAN_TAKEOVER') {
                console.log(`[coreHandler] Ignored message from ${formattedSenderId} because status is HUMAN_TAKEOVER`);
                // Jika ingin pesan tetap tersimpan di database kita (tapi tidak direspon bot),
                // kita bisa menyimpannya, tapi langsung return agar tidak diteruskan ke AI.
                // Untuk amannya kita tidak teruskan ke AIResponder.
                return;
            }

            // --- Lapis 1 & 3: Pre-LLM Keyword Filter & Strike System ---
            const bannedKeywords = await getBannedKeywords();
            const lowerText = text.toLowerCase();
            const containsBanned = bannedKeywords.some(keyword => lowerText.includes(keyword));

            if (containsBanned) {
                console.log(`[coreHandler] Moderation: Banned keyword detected from ${formattedSenderId}`);
                const newStrike = (contact.strikeCount || 0) + 1;
                let newStatus = contact.botStatus;
                let isAllowed = contact.isAllowed;
                let replyMsg = "Maaf, pesan Anda mengandung kata-kata yang tidak pantas. Harap gunakan bahasa yang sopan.";

                if (newStrike >= 3) {
                    newStatus = 'BLOCKED';
                    isAllowed = false;
                    replyMsg = "Nomor Anda telah diblokir secara otomatis karena berulang kali melanggar kebijakan penggunaan.";
                    console.log(`[coreHandler] Moderation: ${formattedSenderId} has been BLOCKED (Strike ${newStrike})`);
                }

                await prisma.contact.update({
                    where: { id: contact.id },
                    data: { strikeCount: newStrike, botStatus: newStatus, isAllowed }
                });

                if (platform === 'whatsapp') {
                    await sendWhatsAppMessage(formattedSenderId, replyMsg, caseId);
                }
                
                // Do not proceed with LLM processing
                return;
            }
            // -------------------------------------------------------------

            // Use clean phone number for chatName (without @s.whatsapp.net)
            const cleanPhone = formattedSenderId.replace('@s.whatsapp.net', '');
            const displayName = (contact && contact.name && contact.name !== cleanPhone) 
                ? contact.name 
                : cleanPhone;

            const incomingSaved = await prisma.message.create({
                data: {
                    sessionId: 'taptalk',
                    sender: cleanPhone,
                    receiver: 'TapTalk / OneTalk',
                    chatName: cleanPhone,
                    messageBody: text,
                    isFromMe: false,
                    isStatus: false,
                    timestamp: new Date()
                }
            });
            const io = getIO();
            if (io) io.emit('new_message', incomingSaved);
        } catch (e) {
            console.error('Error saving TapTalk inbound msg:', e.message);
        }

        // Create a clientAdapter expected by handleIncomingMessage
        const clientAdapter = {
            sendMessage: async (jid, messageContent) => {
                let msgText = '';
                if (typeof messageContent === 'string') {
                    msgText = messageContent;
                } else if (messageContent && messageContent.text) {
                    msgText = messageContent.text;
                }
                
                if (msgText) {
                    try {
                        const cleanJid = jid.replace('@s.whatsapp.net', '');
                        const outgoingSaved = await prisma.message.create({
                            data: {
                                sessionId: 'taptalk',
                                sender: 'TapTalk / OneTalk',
                                receiver: cleanJid,
                                chatName: cleanJid,
                                messageBody: msgText,
                                isFromMe: true,
                                isStatus: false,
                                timestamp: new Date()
                            }
                        });
                        const io = getIO();
                        if (io) io.emit('new_message', outgoingSaved);
                    } catch (e) {
                        console.error('Error saving TapTalk outbound msg:', e.message);
                    }
                    return await sendWhatsAppMessage(jid, msgText, caseId);
                }
            },
            sendImage: async (jid, urlOrBuffer, caption) => {
                try {
                    const cleanJidImg = jid.replace('@s.whatsapp.net', '');
                    const outgoingSaved = await prisma.message.create({
                        data: {
                            sessionId: 'taptalk',
                            sender: 'TapTalk / OneTalk',
                            receiver: cleanJidImg,
                            chatName: cleanJidImg,
                            messageBody: caption || '[Image Attachment]',
                            mediaUrl: urlOrBuffer,
                            mediaType: 'image/jpeg',
                            isFromMe: true,
                            isStatus: false,
                            timestamp: new Date()
                        }
                    });
                    const io = getIO();
                    if (io) io.emit('new_message', outgoingSaved);
                } catch (e) {
                    console.error('Error saving TapTalk outbound image msg:', e.message);
                }
                return await sendWhatsAppImage(jid, urlOrBuffer, caption || '', caseId);
            },
            sendDocument: async (jid, filepath, fileName, caption, mimetype) => {
                let dbMediaUrl = filepath;
                try {
                    if (typeof filepath === 'string' && filepath.startsWith('/')) {
                        const uploadsIdx = filepath.indexOf('/uploads/');
                        if (uploadsIdx !== -1) {
                            dbMediaUrl = filepath.substring(uploadsIdx);
                        }
                    }
                    const cleanJidDoc = jid.replace('@s.whatsapp.net', '');
                    const outgoingSaved = await prisma.message.create({
                        data: {
                            sessionId: 'taptalk',
                            sender: 'TapTalk / OneTalk',
                            receiver: cleanJidDoc,
                            chatName: cleanJidDoc,
                            messageBody: caption || `[Document: ${fileName}]`,
                            mediaUrl: dbMediaUrl,
                            mediaType: mimetype || 'application/pdf',
                            isFromMe: true,
                            isStatus: false,
                            timestamp: new Date()
                        }
                    });
                    const io = getIO();
                    if (io) io.emit('new_message', outgoingSaved);
                } catch (e) {
                    console.error('Error saving TapTalk outbound doc msg:', e.message);
                }

                const { sendWhatsAppDocument } = require('./taptalk.service');
                const toPublicUrl = (pathOrUrl) => {
                    if (typeof pathOrUrl === 'string' && pathOrUrl.startsWith('/')) {
                        const uploadsIdx = pathOrUrl.indexOf('/uploads/');
                        if (uploadsIdx !== -1) {
                            const relativePath = pathOrUrl.substring(uploadsIdx);
                            return `https://auditwa.padmasaripangan.co.id/api${relativePath}`;
                        }
                        return `https://auditwa.padmasaripangan.co.id${pathOrUrl}`;
                    }
                    return pathOrUrl;
                };
                const publicUrl = toPublicUrl(dbMediaUrl);
                const phone = jid.replace('@s.whatsapp.net', '');
                return await sendWhatsAppDocument(phone, publicUrl, fileName, caption, caseId);
            },
            sendButtons: async (jid, text, footer, buttons) => {
                // TapTalk Custom Chatbot API may not support raw WhatsApp buttons perfectly via generic text,
                // but we fallback to sending text with options.
                let msgText = text + '\n\n';
                buttons.forEach((btn, idx) => {
                    msgText += `[${idx + 1}] ${btn.buttonText?.displayText || btn.title}\n`;
                });
                msgText = msgText.trim();
                try {
                    const outgoingSaved = await prisma.message.create({
                        data: {
                            sessionId: 'taptalk',
                            sender: 'TapTalk / OneTalk',
                            receiver: jid,
                            chatName: jid,
                            messageBody: msgText,
                            isFromMe: true,
                            isStatus: false,
                            timestamp: new Date()
                        }
                    });
                    const io = getIO();
                    if (io) io.emit('new_message', outgoingSaved);
                } catch (e) {
                    console.error('Error saving TapTalk outbound btn msg:', e.message);
                }
                return await sendWhatsAppMessage(jid, msgText, caseId);
            },
            sendListMessage: async (jid, title, text, buttonText, sections) => {
                let msgText = `${title}\n${text}\n\n`;
                sections.forEach(sec => {
                    if (sec.title) msgText += `*${sec.title}*\n`;
                    sec.rows.forEach((row, idx) => {
                        msgText += `[${idx + 1}] ${row.title}\n`;
                    });
                });
                msgText = msgText.trim();
                try {
                    const outgoingSaved = await prisma.message.create({
                        data: {
                            sessionId: 'taptalk',
                            sender: 'TapTalk / OneTalk',
                            receiver: jid,
                            chatName: jid,
                            messageBody: msgText,
                            isFromMe: true,
                            isStatus: false,
                            timestamp: new Date()
                        }
                    });
                    const io = getIO();
                    if (io) io.emit('new_message', outgoingSaved);
                } catch (e) {
                    console.error('Error saving TapTalk outbound list msg:', e.message);
                }
                return await sendWhatsAppMessage(jid, msgText, caseId);
            },
            formatJid: (number) => {
                let cleaned = number.toString().replace(/\D/g, '');
                if (cleaned.startsWith('0')) cleaned = '62' + cleaned.substring(1);
                else if (cleaned.startsWith('8')) cleaned = '62' + cleaned;
                return `${cleaned}@s.whatsapp.net`;
            }
        };

        // Check if this is a request to trigger a Scheduled AI Report from the client
        const reportTriggerPrefix = "Kirim laporan Scheduled AI Reports dengan Report Name ";
        if (text && text.trim().startsWith(reportTriggerPrefix)) {
            const reportName = text.trim().substring(reportTriggerPrefix.length).trim();
            console.log(`[coreHandler] Client requested Scheduled AI Report: ${reportName}`);
            
            try {
                const schedule = await prisma.reportSchedule.findFirst({
                    where: { 
                        name: reportName,
                        isActive: true
                    }
                });

                if (schedule) {
                    await clientAdapter.sendMessage(formattedSenderId, `Permintaan diterima. Sedang memproses laporan: ${reportName}...`);
                    
                    const { executeScheduleById } = require('../scheduler');
                    // We modify clientAdapter slightly to override targetWaNumber to send it back to the client
                    clientAdapter.overrideTarget = formattedSenderId;
                    
                    // We can't use executeScheduleById directly if we want to pass our custom clientAdapter with caseId.
                    // We'll require scheduler.js but call the internal method if possible, or we just execute it directly.
                    // Since executeSchedule is not exported, we'll import it or we can just update scheduler.js to export it.
                    const scheduler = require('../scheduler');
                    if (scheduler.executeSchedule) {
                        await scheduler.executeSchedule(schedule, clientAdapter);
                    } else {
                        // Fallback if executeSchedule is not exported
                        console.error('executeSchedule is not exported from scheduler.js');
                    }
                } else {
                    await clientAdapter.sendMessage(formattedSenderId, `Maaf, laporan dengan nama "${reportName}" tidak ditemukan atau tidak aktif.`);
                }
            } catch (err) {
                console.error('[coreHandler] Error triggering report:', err);
                await clientAdapter.sendMessage(formattedSenderId, `Terjadi kesalahan saat mencoba memproses laporan.`);
            }
            
            // Bypass normal chatbot handling
            return;
        }

        // Forward to the main chatbot handler
        try {
            await handleIncomingMessage(normalizedMsg, 'taptalk', clientAdapter, { botType: 'MAIN' });
        } catch (error) {
            console.error('[coreHandler] Error handling incoming message:', error);
        }
    }
};

module.exports = {
    processIncomingMessage
};
