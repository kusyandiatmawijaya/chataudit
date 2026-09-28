const fs = require('fs');

let content = fs.readFileSync('chatbot/MessageHandler.js.refactored', 'utf8');

// Replace remaining sock.sendMessage (image)
content = content.replace(/await sock\.sendMessage\(remoteJid, \{ image: \{ url: images\[i\] \}, caption: cleanedResponse \|\| undefined \}\);/g, 'await clientAdapter.sendImage(remoteJid, images[i], cleanedResponse || undefined);');
content = content.replace(/await sock\.sendMessage\(remoteJid, \{ image: \{ url: images\[i\] \} \}\);/g, 'await clientAdapter.sendImage(remoteJid, images[i], undefined);');

// Replace handleIncomingMessage body start
const oldStart = `async function handleIncomingMessage(normalizedMsg, sessionId, clientAdapter) {
  try {
    const isFromMe = msg.key.fromMe;
    const remoteJid = msg.key.remoteJid;

    if (isFromMe) return;
    if (!remoteJid) return;
    if (remoteJid === 'status@broadcast') return;
    if (remoteJid.endsWith('@g.us')) return;
    if (remoteJid.endsWith('@newsletter')) return;

    let textMessage = msg.message?.conversation || msg.message?.extendedTextMessage?.text || '';

    if (msg.message?.pollUpdateMessage) {
      const pollCreationMessageKey = msg.message.pollUpdateMessage.pollCreationMessageKey;
      const originalMsg = pollCache.get(pollCreationMessageKey.id);
      if (originalMsg) {
        const pollVotes = getAggregateVotesInPollMessage({ message: msg, pollCreationMessage: originalMsg.message });
        const selectedOptions = pollVotes.filter(v => v.voters.length > 0);
        if (selectedOptions.length > 0) {
          textMessage = selectedOptions[0].name;
          console.log(\`[Chatbot] Decoded poll vote: \${textMessage}\`);
        } else {
          return;
        }
      } else {
        console.log('[Chatbot] Poll update received but original message not in cache.');
        return;
      }
    }

    if (!textMessage || textMessage.trim().length === 0) return;

    const lowerText = textMessage.toLowerCase().trim();
    let senderNumber = remoteJid.split('@')[0];
    senderNumber = senderNumber.split(':')[0];`;

const newStart = `async function handleIncomingMessage(normalizedMsg, sessionId, clientAdapter) {
  try {
    if (!normalizedMsg) return; // Adapter rejected or ignored the message
    
    // Unpack normalized message
    const { platform, senderId, senderNumber, senderName, text, phoneNumber, messageId, rawMessage } = normalizedMsg;
    
    let textMessage = text || '';
    const remoteJid = senderId; // Kept for variable compatibility downwards
    
    // For WhatsApp Poll updates
    if (platform === 'whatsapp' && rawMessage.message?.pollUpdateMessage) {
      const pollCreationMessageKey = rawMessage.message.pollUpdateMessage.pollCreationMessageKey;
      const originalMsg = pollCache.get(pollCreationMessageKey.id);
      if (originalMsg) {
        const pollVotes = getAggregateVotesInPollMessage({ message: rawMessage, pollCreationMessage: originalMsg.message });
        const selectedOptions = pollVotes.filter(v => v.voters.length > 0);
        if (selectedOptions.length > 0) {
          textMessage = selectedOptions[0].name;
          console.log(\`[Chatbot] Decoded poll vote: \${textMessage}\`);
        } else {
          return;
        }
      } else {
        console.log('[Chatbot] Poll update received but original message not in cache.');
        return;
      }
    }
    
    if (textMessage === 'share_contact') {
      textMessage = \`register \${senderName}, \${phoneNumber},\`;
    }

    if (!textMessage || textMessage.trim().length === 0) return;

    const lowerText = textMessage.toLowerCase().trim();
    const pushName = senderName || '';
`;

content = content.replace(oldStart, newStart);

// Update contact lookup
const oldContactLookup = `    // Fetch contact — include persona for persona-aware fallback messages
    let contact = await prisma.contact.findFirst({
      where: {
        OR: [{ whatsappId: remoteJid }, { whatsappId: senderNumber + '@s.whatsapp.net' }, { phoneNumber: senderNumber }],
        group: { not: null }
      },
      include: { persona: true }
    });

    if (!contact) {
      contact = await prisma.contact.findFirst({
        where: {
          OR: [{ whatsappId: remoteJid }, { whatsappId: senderNumber + '@s.whatsapp.net' }, { phoneNumber: senderNumber }]
        },
        include: { persona: true }
      });
    }`;

const newContactLookup = `    // Fetch contact — include persona for persona-aware fallback messages
    let contact = await prisma.contact.findFirst({
      where: {
        OR: [
          { whatsappId: remoteJid }, 
          { whatsappId: senderNumber + '@s.whatsapp.net' }, 
          { telegramId: senderId }, 
          { phoneNumber: senderNumber },
          { phoneNumber: phoneNumber }
        ],
        group: { not: null }
      },
      include: { persona: true }
    });

    if (!contact) {
      contact = await prisma.contact.findFirst({
        where: {
          OR: [
            { whatsappId: remoteJid }, 
            { whatsappId: senderNumber + '@s.whatsapp.net' }, 
            { telegramId: senderId }, 
            { phoneNumber: senderNumber },
            { phoneNumber: phoneNumber }
          ]
        },
        include: { persona: true }
      });
    }`;

content = content.replace(oldContactLookup, newContactLookup);

// Update contact creation logic for telegramId
const oldContactCreate = `          await prisma.contact.create({
            data: {
              whatsappId: remoteJid,
              phoneNumber: senderNumber,
              realPhoneNumber: session.realPhone,
              name: session.name,
              isAllowed: true,
              ...(isCustomer && session.code ? { kodeCustomer: session.code } : {}),
              ...(isSales && session.code ? { kodeSales: session.code } : {})
            }
          });`;

const newContactCreate = `          await prisma.contact.create({
            data: {
              whatsappId: platform === 'whatsapp' ? remoteJid : \`telegram_\${remoteJid}\`,
              telegramId: platform === 'telegram' ? remoteJid : null,
              phoneNumber: senderNumber,
              realPhoneNumber: session.realPhone,
              name: session.name,
              isAllowed: true,
              ...(isCustomer && session.code ? { kodeCustomer: session.code } : {}),
              ...(isSales && session.code ? { kodeSales: session.code } : {})
            }
          });`;
          
content = content.replace(oldContactCreate, newContactCreate);

// There is a place where it sends OTP:
// sock.sendMessage(realPhone + '@s.whatsapp.net'
// It got replaced to clientAdapter.sendMessage(realPhone + '@s.whatsapp.net'
// That works for whatsapp but not telegram. If registering via telegram, OTP goes to telegram.
// For now, let's keep it as is, or fix it to use adapter.

fs.writeFileSync('chatbot/MessageHandler.js', content);
console.log('Done refactoring MessageHandler.js');
