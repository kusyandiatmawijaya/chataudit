const express = require('express');
const router = express.Router();
const { processIncomingMessage } = require('../services/coreHandler.service');

// GET /api/webhook/taptalk (for potential validation pings)
router.get('/taptalk', (req, res) => {
    console.log('[Webhook] GET /taptalk hit. Query:', JSON.stringify(req.query));
    res.status(200).send('OK');
});

// POST /api/webhook/taptalk
router.post('/taptalk', (req, res) => {
    // IMPORTANT: Acknowledge the webhook immediately so TapTalk knows it was received and doesn't retry
    res.status(200).send('OK');

    console.log('[Webhook] /taptalk hit. Raw payload:', JSON.stringify(req.body));

    try {
        const payload = req.body;
        
        // Handle standard CRM webhook events from OneTalk
        if (payload.type === 'integration_message_status') {
            console.log(`[TapTalk] Message status update received: ${payload.integrationMessageStatus?.trxID} is ${payload.integrationMessageStatus?.status}`);
            return;
        }
        
        if (payload.type === 'case_created' || payload.type === 'case_resolved') {
            const phone = payload[payload.type === 'case_created' ? 'caseCreated' : 'caseResolved']?.contact?.phone;
            console.log(`[TapTalk] Case event received: ${payload.type} for phone ${phone}`);
            
            // Revert ke BOT_ACTIVE jika case di-resolve oleh manusia
            if (payload.type === 'case_resolved' && phone) {
                const { PrismaClient } = require('@prisma/client');
                const prisma = new PrismaClient();
                prisma.contact.updateMany({
                    where: { phoneNumber: phone },
                    data: { botStatus: 'BOT_ACTIVE' }
                }).then(result => {
                    if (result.count > 0) {
                        console.log(`[TapTalk] Reverted botStatus to BOT_ACTIVE for phone ${phone}`);
                    }
                }).catch(err => {
                    console.error(`[TapTalk] Failed to revert botStatus for phone ${phone}:`, err);
                });
            }
            return;
        }

        // For Custom Chatbot webhooks, TapTalk sends the actual message
        let senderId = null;
        let text = null;

        // Try standard or Baileys legacy format
        if (typeof payload.from === 'string') senderId = payload.from;
        else if (typeof payload.phone === 'string') senderId = payload.phone;

        if (typeof payload.text === 'string') text = payload.text;
        else if (typeof payload.body === 'string') text = payload.body;

        // Try TapTalk Custom Chatbot format
        if (!senderId && payload.sender?.phone) senderId = payload.sender.phone;
        if (!text && payload.message?.text?.body) text = payload.message.text.body;
        
        let senderName = null;
        if (payload.sender?.name) senderName = payload.sender.name;
        else if (payload.contactName) senderName = payload.contactName;
        else if (payload.pushName) senderName = payload.pushName;
        else if (payload.user?.name) senderName = payload.user.name;

        const caseId = payload.caseID || null;

        if (senderId && text) {
            // Pass to the unified message handler asynchronously
            processIncomingMessage({
                platform: 'whatsapp',
                senderId: senderId,
                senderName: senderName,
                text: text,
                caseId: caseId
            }).catch(err => {
                console.error('Error processing TapTalk message in coreHandler:', err);
            });
        } else {
            console.warn('[TapTalk] Received unrecognized webhook payload:', JSON.stringify(payload, null, 2));
        }
    } catch (error) {
        console.error('Error parsing TapTalk webhook:', error);
    }
});

module.exports = router;
