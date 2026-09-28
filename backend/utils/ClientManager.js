const { getTelegramBot } = require('../telegram');
const TelegramAdapter = require('../adapters/TelegramAdapter');
const WhatsAppAdapter = require('../adapters/WhatsAppAdapter');
const { sendWhatsAppMessage, sendWhatsAppImage, sendWhatsAppDocument } = require('../services/taptalk.service');
const { getSock } = require('../whatsapp');

/**
 * Returns the appropriate client adapter based on the sessionId.
 * @param {string} sessionId 
 * @returns {object|null} The client adapter (WhatsApp or Telegram)
 */
function getClientAdapter(sessionId) {
  if (sessionId.startsWith('telegram-')) {
    const bot = getTelegramBot(sessionId);
    if (bot) {
      return new TelegramAdapter(bot, null, bot.trueSessionId || sessionId);
    }
    return null;
  } else if (sessionId === 'taptalk') {
    // TapTalk (Official API) mock adapter
    
    // Helper to convert local paths to public URLs since TapTalk is a cloud service
    const toPublicUrl = (pathOrUrl) => {
        const baseUrl = (process.env.BASE_URL || 'http://localhost:3013').replace(/\/$/, '');
        if (typeof pathOrUrl === 'string' && pathOrUrl.startsWith('/')) {
            const uploadsIdx = pathOrUrl.indexOf('/uploads/');
            if (uploadsIdx !== -1) {
                const relativePath = pathOrUrl.substring(uploadsIdx);
                return `${baseUrl}/api${relativePath}`;
            }
            return `${baseUrl}${pathOrUrl}`;
        }
        return pathOrUrl;
    };

    return {
      sendMessage: async (to, text) => {
        const phone = to.replace('@s.whatsapp.net', '');
        return await sendWhatsAppMessage(phone, text);
      },
      sendImage: async (to, urlOrBuffer, caption) => {
        const phone = to.replace('@s.whatsapp.net', '');
        return await sendWhatsAppImage(phone, toPublicUrl(urlOrBuffer), caption || '');
      },
      sendDocument: async (to, filepath, fileName, caption, mimetype) => {
        const phone = to.replace('@s.whatsapp.net', '');
        return await sendWhatsAppDocument(phone, toPublicUrl(filepath), fileName, caption || '');
      },
      formatJid: (number) => {
        // Taptalk just needs phone number, but we conform to JID format so other parts don't break
        let cleaned = number.toString().replace(/\D/g, '');
        if (cleaned.startsWith('0')) cleaned = '62' + cleaned.substring(1);
        else if (cleaned.startsWith('8')) cleaned = '62' + cleaned;
        return `${cleaned}@s.whatsapp.net`;
      }
    };
  } else {
    // Baileys (Unofficial API) adapter
    const sock = getSock(sessionId);
    if (sock) {
      return new WhatsAppAdapter(sock);
    }
    return null;
  }
}

module.exports = { getClientAdapter };
