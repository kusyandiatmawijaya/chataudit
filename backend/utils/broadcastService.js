const cron = require('node-cron');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { getClientAdapter } = require('./ClientManager');
const path = require('path');
const fs = require('fs');

// Note: formatPhoneNumber logic is now handled by clientAdapter.formatJid

// Replaces template variables like {{name}} with values from variables JSON
function parseTemplateText(text, variables) {
    if (!text) return '';
    let parsedText = text;
    if (variables) {
        try {
            const vars = typeof variables === 'string' ? JSON.parse(variables) : variables;
            for (const key in vars) {
                const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'ig');
                parsedText = parsedText.replace(regex, vars[key]);
            }
        } catch (e) {
            console.error('Error parsing variables:', e);
        }
    }
    return parsedText;
}

// Helper to add delay
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function executeBroadcast(broadcastId) {
    try {
        const broadcast = await prisma.broadcast.findUnique({
            where: { id: broadcastId },
            include: { template: true, recipients: true }
        });

        if (!broadcast || broadcast.status !== 'PENDING') return;

        // Mark broadcast as RUNNING
        await prisma.broadcast.update({
            where: { id: broadcastId },
            data: { status: 'RUNNING' }
        });

        const clientAdapter = getClientAdapter(broadcast.sessionId);
        if (!clientAdapter) {
            throw new Error(`Client adapter for session ${broadcast.sessionId} is not active`);
        }

        const template = broadcast.template;
        const recipients = broadcast.recipients.filter(r => r.status === 'PENDING');

        console.log(`Starting broadcast ${broadcast.name} to ${recipients.length} recipients...`);

        let sentCount = 0;
        
        if (broadcast.sessionId === 'taptalk') {
            // TAP-TALK OFFICIAL API LOGIC (Maximized throughput, concurrent execution in batches)
            const BATCH_SIZE = 50; 
            for (let i = 0; i < recipients.length; i += BATCH_SIZE) {
                const batch = recipients.slice(i, i + BATCH_SIZE);
                await Promise.all(batch.map(async (recipient) => {
                    try {
                        const jid = clientAdapter.formatJid(recipient.phoneNumber);
                        
                        let messageText = '';
                        if (template.header) messageText += `*${parseTemplateText(template.header, recipient.variables)}*\n\n`;
                        messageText += parseTemplateText(template.body, recipient.variables);
                        if (template.footer) messageText += `\n\n_${parseTemplateText(template.footer, recipient.variables)}_`;
                        
                        let mediaUrl = template.type === 'DYNAMIC_MEDIA' ? recipient.mediaUrl : template.mediaUrl;
                        if (mediaUrl && mediaUrl.startsWith('/uploads')) {
                            const localPath = path.join(__dirname, '..', mediaUrl);
                            if (fs.existsSync(localPath)) mediaUrl = localPath;
                        }

                        let sentMsg;
                        if (['STATIC_MEDIA', 'DYNAMIC_MEDIA'].includes(template.type) && mediaUrl) {
                            sentMsg = await clientAdapter.sendImage(jid, mediaUrl, messageText);
                        } else {
                            sentMsg = await clientAdapter.sendMessage(jid, messageText);
                        }
                        
                        const messageId = sentMsg?.key?.id || sentMsg?.message_id?.toString() || null;
                        
                        await prisma.broadcastRecipient.update({
                            where: { id: recipient.id },
                            data: { 
                                status: 'SENT', 
                                sentAt: new Date(),
                                messageId: messageId,
                                deliveryStatus: 'PENDING'
                            }
                        });
                        console.log(`[Broadcast] Sent to ${jid} (TapTalk)`);
                    } catch (err) {
                        console.error(`[Broadcast] Failed to send to ${recipient.phoneNumber}:`, err.message);
                        await prisma.broadcastRecipient.update({
                            where: { id: recipient.id },
                            data: { status: 'FAILED', errorReason: err.message }
                        });
                    }
                }));
                console.log(`[Broadcast] Processed TapTalk batch ${i / BATCH_SIZE + 1}`);
            }
        } else {
            // BAILEYS UNOFFICIAL API LOGIC (With random delays and batch pauses)
            for (const recipient of recipients) {
                try {
                    const jid = clientAdapter.formatJid(recipient.phoneNumber);
                    
                    let messageText = '';
                    if (template.header) messageText += `*${parseTemplateText(template.header, recipient.variables)}*\n\n`;
                    messageText += parseTemplateText(template.body, recipient.variables);
                    if (template.footer) messageText += `\n\n_${parseTemplateText(template.footer, recipient.variables)}_`;

                    let mediaUrl = template.type === 'DYNAMIC_MEDIA' ? recipient.mediaUrl : template.mediaUrl;
                    if (mediaUrl && mediaUrl.startsWith('/uploads')) {
                        const localPath = path.join(__dirname, '..', mediaUrl);
                        if (fs.existsSync(localPath)) mediaUrl = localPath;
                    }

                    let sentMsg;
                    if (['STATIC_MEDIA', 'DYNAMIC_MEDIA'].includes(template.type) && mediaUrl) {
                        sentMsg = await clientAdapter.sendImage(jid, mediaUrl, messageText);
                    } else {
                        sentMsg = await clientAdapter.sendMessage(jid, messageText);
                    }

                    const messageId = sentMsg?.key?.id || sentMsg?.message_id?.toString() || null;

                    await prisma.broadcastRecipient.update({
                        where: { id: recipient.id },
                        data: { 
                            status: 'SENT', 
                            sentAt: new Date(),
                            messageId: messageId,
                            deliveryStatus: 'PENDING'
                        }
                    });

                    console.log(`[Broadcast] Sent to ${jid}`);

                } catch (err) {
                    console.error(`[Broadcast] Failed to send to ${recipient.phoneNumber}:`, err.message);
                    await prisma.broadcastRecipient.update({
                        where: { id: recipient.id },
                        data: { status: 'FAILED', errorReason: err.message }
                    });
                }
                sentCount++;
                
                // Batch Pause: Pause for 2 minutes every 25 messages
                if (sentCount % 25 === 0 && sentCount < recipients.length) {
                    console.log(`[Broadcast] Batch limit reached (${sentCount} messages). Pausing for 2 minutes to prevent ban...`);
                    await delay(120000); // 2 minutes
                } else if (sentCount < recipients.length) {
                    // Random Delay: Between 5 to 15 seconds
                    const waitTime = Math.floor(Math.random() * (15000 - 5000 + 1)) + 5000;
                    console.log(`[Broadcast] Waiting for ${waitTime/1000} seconds before next message...`);
                    await delay(waitTime);
                }
            }
        }

        // Mark broadcast as COMPLETED
        await prisma.broadcast.update({
            where: { id: broadcastId },
            data: { status: 'COMPLETED' }
        });
        
        console.log(`Broadcast ${broadcast.name} completed.`);

    } catch (error) {
        console.error(`[Broadcast] Error executing broadcast ${broadcastId}:`, error);
        await prisma.broadcast.update({
            where: { id: broadcastId },
            data: { status: 'FAILED' }
        });
    }
}

// Cron job to run every minute and check for scheduled broadcasts
cron.schedule('* * * * *', async () => {
    try {
        const now = new Date();
        const pendingBroadcasts = await prisma.broadcast.findMany({
            where: {
                status: 'PENDING',
                scheduledAt: {
                    lte: now
                }
            }
        });

        for (const b of pendingBroadcasts) {
            executeBroadcast(b.id);
        }
    } catch (error) {
        console.error('Error in broadcast cron job:', error);
    }
});

module.exports = {
    executeBroadcast
};
