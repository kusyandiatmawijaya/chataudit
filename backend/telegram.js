const dns = require('dns');
dns.setDefaultResultOrder('ipv4first');
const TelegramBot = require('node-telegram-bot-api').default || require('node-telegram-bot-api');
const TelegramAdapter = require('./adapters/TelegramAdapter');
// const { handleIncomingMessage } = require('./chatbotHandler'); // Removed to fix circular dependency
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
require('dotenv').config();

// Store all bot instances
// key: sessionId (e.g., `telegram-${id}`), value: { bot, type, data }
const bots = new Map();

async function initTelegramBot(io) {
    try {
        const activeBots = await prisma.telegramBot.findMany({
            where: { isActive: true }
        });

        if (activeBots.length === 0) {
            console.log('[Telegram] No active Telegram bots found in database.');
            return;
        }

        for (const botData of activeBots) {
            const token = botData.token;
            const botType = botData.type || 'MAIN';
            const sessionId = `telegram-${botData.id}`;

            if (!token) continue;

            const bot = new TelegramBot(token, { polling: true });
            bot.trueSessionId = sessionId;
            bots.set(sessionId, { bot, type: botType, data: botData });

            // Initialize Telegram native menu button based on bot type
            let botCommands = [];
            if (botType === 'SALESMAN') {
                botCommands = [
                    { command: '/menu', description: 'Tampilkan Menu Utama' },
                    { command: '/profil', description: 'Profil Salesman' },
                    { command: '/piutang', description: 'Cek Outstanding AR' },
                    { command: '/omset', description: 'Laporan Omset' },
                    { command: '/jadwalbesok', description: 'Jadwal Kunjungan Besok' },
                    { command: '/jadwalhariini', description: 'Jadwal Kunjungan Hari Ini' },
                    { command: '/reset', description: 'Reset Percakapan' }
                ];
            } else {
                botCommands = [
                    { command: '/menu', description: 'Tampilkan Menu Utama' },
                    { command: '/retur', description: 'Buat Retur Baru' },
                    { command: '/cetak', description: 'Cetak Struk Retur' },
                    { command: '/reprint', description: 'Cetak Ulang (Reprint) Struk' },
                    { command: '/reset', description: 'Reset Percakapan' }
                ];
            }
            
            bot.setMyCommands(botCommands).catch(err => console.error('[Telegram] Failed to set commands:', err));

            try {
                await prisma.session.upsert({
                    where: { sessionId: sessionId },
                    update: { name: botData.name || `Telegram Bot (${botType})`, status: 'ready' },
                    create: {
                        sessionId: sessionId,
                        name: botData.name || `Telegram Bot (${botType})`,
                        status: 'ready'
                    }
                });
            } catch (err) {
                console.error(`[Telegram] Failed to upsert session in database for bot ${sessionId}:`, err);
            }

            console.log(`[Telegram] Bot initialized: ${botData.name || 'Unnamed'} (Type: ${botType})`);

            bot.on('message', async (msg) => {
                const normalizedMsg = TelegramAdapter.normalizeMessage(msg);
                if (normalizedMsg) {
                    let mediaUrl = null;
                    let mediaType = null;

                    // Jika ada media (photo/document), download file-nya
                    if (normalizedMsg.hasMedia) {
                        try {
                            const path = require('path');
                            let fileId = null;
                            if (msg.photo && msg.photo.length > 0) {
                                fileId = msg.photo[msg.photo.length - 1].file_id; // ambil resolusi terbesar
                                mediaType = 'image/jpeg';
                            } else if (msg.document) {
                                fileId = msg.document.file_id;
                                mediaType = 'application/octet-stream';
                            } else if (msg.location) {
                                mediaType = 'location';
                                mediaUrl = `https://maps.google.com/?q=${msg.location.latitude},${msg.location.longitude}`;
                            }

                            if (fileId) {
                                const downloadDir = path.join(__dirname, 'uploads');
                                const downloadedPath = await bot.downloadFile(fileId, downloadDir);
                                const filename = path.basename(downloadedPath);
                                mediaUrl = `/uploads/${filename}`;
                            }
                        } catch (err) {
                            console.error(`[Telegram-${botType}] Failed to download media:`, err);
                        }
                    }

                    // Tambahkan ke normalizedMsg agar bisa diakses oleh workflow/handler
                    normalizedMsg.mediaUrl = mediaUrl;
                    normalizedMsg.mediaType = mediaType;

                    // Save incoming message to DB
                    try {
                        const savedMessage = await prisma.message.create({
                            data: {
                                sessionId: sessionId,
                                sender: normalizedMsg.senderId,
                                receiver: sessionId,
                                chatName: normalizedMsg.senderName,
                                messageBody: normalizedMsg.text || '',
                                isFromMe: false,
                                authorName: normalizedMsg.senderName,
                                mediaUrl: mediaUrl,
                                mediaType: mediaType,
                                timestamp: new Date()
                            }
                        });
                        if (io) {
                            io.emit('new_message', savedMessage);
                        }
                    } catch (err) {
                        console.error(`[Telegram-${botType}] Failed to save incoming message:`, err);
                    }

                    const clientAdapter = new TelegramAdapter(bot, io, sessionId);
                    // Pass botType as context/options to handleIncomingMessage
                    require('./chatbotHandler').handleIncomingMessage(normalizedMsg, sessionId, clientAdapter, { botType }).catch((err) => {
                        console.error(`[Chatbot-Telegram-${botType}] Unhandled error in message handler:`, err);
                    });
                }
            });

            bot.on('callback_query', async (callbackQuery) => {
                const action = callbackQuery.data;
                const msg = callbackQuery.message;
                
                // Construct a fake msg so normalizeMessage can process it easily
                const fakeMsg = {
                    ...msg,
                    text: `CALLBACK:${action}`,
                    from: callbackQuery.from // The user who clicked the button
                };

                const normalizedMsg = TelegramAdapter.normalizeMessage(fakeMsg);
                if (normalizedMsg) {
                    const clientAdapter = new TelegramAdapter(bot, io, sessionId);
                    require('./chatbotHandler').handleIncomingMessage(normalizedMsg, sessionId, clientAdapter, { botType }).catch((err) => {
                        console.error(`[Chatbot-Telegram-${botType}] Unhandled error in callback query handler:`, err);
                    });
                }
                
                // Answer the callback to stop the loading animation on the Telegram client button
                bot.answerCallbackQuery(callbackQuery.id).catch(e => console.error(e));
            });

            bot.on('polling_error', (error) => {
                console.error(`[Telegram-${botType}] Polling error:`, error.code, error.message);
            });
        }
    } catch (error) {
        console.error('[Telegram] Failed to initialize bots:', error);
    }
}

function getTelegramBot(sessionId) {
    if (bots.has(sessionId)) {
        return bots.get(sessionId).bot;
    }
    // Fallback for hardcoded 'telegram-main' references
    if (sessionId === 'telegram-main') {
        const mainBotEntry = Array.from(bots.values()).find(b => b.type === 'MAIN');
        return mainBotEntry ? mainBotEntry.bot : null;
    }
    // Fallback for old schedules that might have saved the token directly (telegram-<token>)
    for (const [id, botInfo] of bots.entries()) {
        if (`telegram-${botInfo.data.token}` === sessionId) {
            return botInfo.bot;
        }
    }
    return null;
}

module.exports = { initTelegramBot, getTelegramBot };
