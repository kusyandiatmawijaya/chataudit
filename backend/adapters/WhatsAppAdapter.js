class WhatsAppAdapter {
  constructor(sock) {
    this.sock = sock;
    this.platform = 'whatsapp';
  }

  /**
   * Sends a text message to a user.
   * @param {string} senderId - The remote JID of the user.
   * @param {string} text - The text content to send.
   */
  async sendMessage(senderId, text) {
    return await this.sock.sendMessage(senderId, { text });
  }

  async sendImage(senderId, url, caption) {
    return await this.sock.sendMessage(senderId, { image: { url }, caption });
  }

  async sendDocument(senderId, filepath, fileName, caption, mimetype) {
    return await this.sock.sendMessage(senderId, {
      document: { url: filepath },
      mimetype: mimetype || 'application/pdf',
      fileName: fileName,
      caption: caption
    });
  }

  /**
   * Requests contact from a user.
   */
  async requestContact(senderId, text) {
    return await this.sendMessage(senderId, text);
  }

  async sendPresenceUpdate(status, senderId) {
    if (this.sock && this.sock.sendPresenceUpdate) {
      return await this.sock.sendPresenceUpdate(status, senderId);
    }
  }

  /**
   * Normalize an incoming Baileys message.
   * @param {object} msg - The Baileys message object.
   * @returns {object|null} - Normalized message or null if it should be ignored.
   */
  static normalizeMessage(msg) {
    const isFromMe = msg.key.fromMe;
    const remoteJid = msg.key.remoteJid;

    if (isFromMe || !remoteJid || remoteJid === 'status@broadcast' || remoteJid.endsWith('@g.us') || remoteJid.endsWith('@newsletter')) {
      return null;
    }

    let text = msg.message?.conversation || msg.message?.extendedTextMessage?.text || '';
    
    if (msg.message?.locationMessage) {
        text = text || 'share_location';
    }
    
    // For polls, the text might be empty initially.
    let senderNumber = remoteJid.split('@')[0];
    senderNumber = senderNumber.split(':')[0];

    return {
      platform: 'whatsapp',
      messageId: msg.key.id,
      senderId: remoteJid,
      senderNumber: senderNumber, // Just the numbers
      senderName: msg.pushName || '',
      text: text,
      phoneNumber: senderNumber, // Usually the same
      rawMessage: msg
    };
  }

  /**
   * Formats a raw phone number into a WhatsApp JID.
   * @param {string} number - The raw phone number
   * @returns {string} The WhatsApp JID
   */
  formatJid(number) {
    if (!number) return null;
    let cleaned = number.toString().replace(/\D/g, '');
    if (cleaned.startsWith('0')) {
        cleaned = '62' + cleaned.substring(1);
    } else if (cleaned.startsWith('8')) {
        cleaned = '62' + cleaned;
    }
    return `${cleaned}@s.whatsapp.net`;
  }
}

module.exports = WhatsAppAdapter;
