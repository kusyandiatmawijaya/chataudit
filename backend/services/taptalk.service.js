const axios = require('axios');

/**
 * Sends a WhatsApp message using the TapTalk.io API.
 * @param {string} phoneNumber - The recipient's phone number.
 * @param {string} text - The message text to send.
 */
const sendWhatsAppMessage = async (phoneNumber, text, caseId = null) => {
    try {
        const onetalkUrl = process.env.ONETALK_URL;
        const onetalkSecret = process.env.ONETALK_SECRET_KEY;

        // ONLY use OneTalk Webhook if caseId is provided, because it is strictly required by the API
        if (caseId && onetalkUrl && onetalkSecret) {
            // Send via OneTalk Custom Chatbot API
            const payload = {
                caseID: caseId,
                eventType: "messages",
                messages: [{
                    type: "text",
                    text: {
                        body: text
                    }
                }]
            };

            const response = await axios.post(onetalkUrl, payload, {
                headers: {
                    'Secret-Key': onetalkSecret,
                    'Content-Type': 'application/json'
                }
            });

            console.log(`Message sent successfully to OneTalk case ${caseId}`);
            return response.data;
        }

        // Fallback to standard Taptalk Send WhatsApp API for broadcasts (which do not have a caseId)
        const taptalkBaseUrl = process.env.TAPTALK_BASE_URL;
        const taptalkApiKey = process.env.TAPTALK_API_KEY;

        if (!taptalkBaseUrl || !taptalkApiKey) {
            console.error('TAPTALK_BASE_URL or TAPTALK_API_KEY is not defined in the environment variables.');
            return null;
        }

        const payload = {
            phone: phoneNumber,
            messageType: 'text',
            body: text
        };

        const response = await axios.post(`${taptalkBaseUrl}/api/v1/message/send_whatsapp`, payload, {
            headers: {
                'API-Key': taptalkApiKey,
                'Content-Type': 'application/json'
            }
        });

        console.log(`Message sent successfully to ${phoneNumber}`);
        return response.data;
    } catch (error) {
        console.error(`Failed to send TapTalk message to ${phoneNumber}:`, error.response ? error.response.data : error.message);
        throw error;
    }
};

const sendWhatsAppImage = async (phoneNumber, imageUrl, caption = '', caseId = null) => {
    try {
        const onetalkUrl = process.env.ONETALK_URL;
        const onetalkSecret = process.env.ONETALK_SECRET_KEY;

        if (caption) {
            try {
                await sendWhatsAppMessage(phoneNumber, caption, caseId);
            } catch (err) {
                console.error("Failed to send caption for image:", err);
            }
        }

        if (caseId && onetalkUrl && onetalkSecret) {
            // Send via OneTalk Custom Chatbot API
            const payload = {
                caseID: caseId,
                eventType: "messages",
                messages: [{
                    type: "image",
                    image: {
                        url: imageUrl,
                        caption: caption
                    }
                }]
            };

            const response = await axios.post(onetalkUrl, payload, {
                headers: {
                    'Secret-Key': onetalkSecret,
                    'Content-Type': 'application/json'
                }
            });

            console.log(`Image sent successfully to OneTalk case ${caseId}`);
            return response.data;
        }

        const taptalkBaseUrl = process.env.TAPTALK_BASE_URL;
        const taptalkApiKey = process.env.TAPTALK_API_KEY;

        if (!taptalkBaseUrl || !taptalkApiKey) {
            console.error('TAPTALK_BASE_URL or TAPTALK_API_KEY is not defined.');
            return null;
        }

        const payload = {
            phone: phoneNumber,
            messageType: 'image',
            body: caption,
            fileURL: imageUrl
        };

        const response = await axios.post(`${taptalkBaseUrl}/api/v1/message/send_whatsapp`, payload, {
            headers: {
                'API-Key': taptalkApiKey,
                'Content-Type': 'application/json'
            }
        });

        console.log(`Image sent successfully to ${phoneNumber}`);
        return response.data;
    } catch (error) {
        console.error(`Failed to send TapTalk image to ${phoneNumber}:`, error.response ? error.response.data : error.message);
        throw error;
    }
};

const sendWhatsAppDocument = async (phoneNumber, fileUrl, fileName = '', caption = '', caseId = null) => {
    const onetalkUrl = process.env.ONETALK_URL;
    const onetalkSecret = process.env.ONETALK_SECRET_KEY;

    // If we have a caseId, use the OneTalk webhook path (most reliable for chatbot responses)
    if (caseId && onetalkUrl && onetalkSecret) {
        // Step 1: Try to send as a file type via OneTalk webhook
        try {
            const payload = {
                caseID: caseId,
                eventType: "messages",
                messages: [{
                    type: "document",
                    document: {
                        url: fileUrl,
                        caption: caption || fileName || 'Document',
                        filename: fileName || 'Document.pdf'
                    }
                }]
            };

            const response = await axios.post(onetalkUrl, payload, {
                headers: {
                    'Secret-Key': onetalkSecret,
                    'Content-Type': 'application/json'
                }
            });

            console.log(`Document sent successfully to OneTalk case ${caseId}`);
            return response.data;
        } catch (fileErr) {
            console.error(`OneTalk file type failed (${fileErr.response?.status}), trying URL fallback:`, fileErr.response?.data || fileErr.message);
        }

        // Step 2: Fallback - send the URL as a plain text message
        try {
            const urlMsg = `📄 *${fileName || 'Laporan Diskon'}*\n\nKlik link berikut untuk mengunduh laporan:\n${fileUrl}`;
            await sendWhatsAppMessage(phoneNumber, urlMsg, caseId);
            console.log(`Document URL sent as text to OneTalk case ${caseId}`);
            return { success: true, method: 'url_text' };
        } catch (textErr) {
            console.error(`Failed to send URL as text to OneTalk case ${caseId}:`, textErr.message);
        }

        return null;
    }

    // No caseId: try TapTalk broadcast API (may not be configured correctly)
    const taptalkBaseUrl = process.env.TAPTALK_BASE_URL;
    const taptalkApiKey = process.env.TAPTALK_API_KEY;

    if (!taptalkBaseUrl || !taptalkApiKey) {
        console.error('TAPTALK_BASE_URL or TAPTALK_API_KEY is not defined.');
        return null;
    }

    try {
        const payload = {
            phone: phoneNumber,
            messageType: 'document',
            body: fileName || 'Document',
            fileURL: fileUrl
        };

        const response = await axios.post(`${taptalkBaseUrl}/api/v1/message/send_whatsapp`, payload, {
            headers: {
                'API-Key': taptalkApiKey,
                'Content-Type': 'application/json'
            }
        });

        console.log(`Document sent successfully to ${phoneNumber}`);
        return response.data;
    } catch (error) {
        console.error(`Failed to send TapTalk document to ${phoneNumber}:`, error.response ? error.response.data : error.message);
        // Do NOT re-throw - return null to allow caller to handle gracefully
        return null;
    }
};

module.exports = {
    sendWhatsAppMessage,
    sendWhatsAppImage,
    sendWhatsAppDocument
};
