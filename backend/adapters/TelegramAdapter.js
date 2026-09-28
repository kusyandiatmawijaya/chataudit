const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

class TelegramAdapter {
  constructor(bot, io, sessionId = 'telegram-main') {
    this.bot = bot;
    this.io = io;
    this.sessionId = sessionId;
    this.platform = 'telegram';
  }

  async _saveOutgoingMessage(senderId, text, mediaUrl = null, mediaType = null) {
    try {
      const savedMessage = await prisma.message.create({
        data: {
          sessionId: this.sessionId,
          sender: this.sessionId,
          receiver: senderId.toString(),
          messageBody: text || '',
          isFromMe: true,
          mediaUrl,
          mediaType,
          timestamp: new Date()
        }
      });
      if (this.io) {
        this.io.emit('new_message', savedMessage);
      }
    } catch (err) {
      console.error('[TelegramAdapter] Failed to save outgoing message:', err);
    }
  }

  /**
   * Sends a text message to a user.
   * @param {string|number} senderId - The chat ID of the user.
   * @param {string} text - The text content to send.
   */
  async sendMessage(senderId, text, options = {}) {
    const res = await this.bot.sendMessage(senderId, text, options);
    await this._saveOutgoingMessage(senderId, text);
    return res;
  }

  async sendImage(senderId, url, caption) {
    const res = await this.bot.sendPhoto(senderId, url, { caption });
    await this._saveOutgoingMessage(senderId, caption, url, 'image');
    return res;
  }

  async sendDocument(senderId, filepath, fileName, caption, mimetype) {
    const res = await this.bot.sendDocument(senderId, filepath, {
      caption: caption
    }, {
      filename: fileName,
      contentType: mimetype
    });
    await this._saveOutgoingMessage(senderId, caption, filepath, 'document');
    return res;
  }

  /**
   * Requests contact from a user.
   */
  async requestContact(senderId, text) {
    return await this.bot.sendMessage(senderId, text, {
      reply_markup: {
        keyboard: [[{ text: "Kirim Kontak", request_contact: true }]],
        one_time_keyboard: true,
        resize_keyboard: true
      }
    });
  }

  async sendPresenceUpdate(status, senderId) {
    if (status === 'composing') {
      return await this.bot.sendChatAction(senderId, 'typing');
    }
  }

  /**
   * Normalize an incoming Telegram message.
   * @param {object} msg - The Telegram message object.
   * @returns {object|null} - Normalized message.
   */
  static normalizeMessage(msg) {
    let text = msg.text || msg.caption || '';
    let phoneNumber = '';
    
    if (msg.contact && msg.contact.phone_number) {
        phoneNumber = msg.contact.phone_number;
        text = 'share_contact';
    }
    if (msg.location) {
        text = text || 'share_location';
    }

    const hasMedia = Boolean(msg.photo || msg.document || msg.location);

    // Ignore if no text, no phone number, and no media
    if (!text && !phoneNumber && !hasMedia) return null; 

    // If there is media but no text, give a default text or just let it be empty
    if (hasMedia && !text) {
      if (msg.photo) text = '[Image]';
      else if (msg.document) text = '[Document]';
      else if (msg.location) text = '[Location]';
    }

    const senderId = msg.chat.id.toString();

    return {
      platform: 'telegram',
      messageId: msg.message_id.toString(),
      senderId: senderId,
      senderNumber: senderId, // Fallback, telegram doesn't provide number normally unless shared
      senderName: msg.from.first_name + (msg.from.last_name ? ' ' + msg.from.last_name : ''),
      text: text,
      phoneNumber: phoneNumber, 
      hasMedia: hasMedia,
      rawMessage: msg
    };
  }

  /**
   * Formats a raw phone number or ID into a Telegram Chat ID.
   * @param {string} number - The raw phone number or Telegram ID
   * @returns {string} The Telegram Chat ID
   */
  formatJid(number) {
    if (!number) return null;
    // For Telegram, the number is usually the numeric Telegram Chat ID.
    // If we only have the actual phone number, Telegram cannot send messages by phone number directly,
    // so this assumes `number` is already the Telegram Chat ID.
    return number.toString();
  }
}

module.exports = TelegramAdapter;
