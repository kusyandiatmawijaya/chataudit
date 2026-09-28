const fs = require('fs');

let content = fs.readFileSync('chatbot/MessageHandler.js', 'utf8');

// Replace executeFallbackAction signature and calls
content = content.replace(/async function executeFallbackAction\(sock, remoteJid, contact, itemNum\)/g, 'async function executeFallbackAction(clientAdapter, remoteJid, contact, itemNum)');
content = content.replace(/await executeFallbackAction\(sock, remoteJid, contact, selectedNum\)/g, 'await executeFallbackAction(clientAdapter, remoteJid, contact, selectedNum)');

// Replace sendMainMenu signature and calls
content = content.replace(/async function sendMainMenu\(sock, remoteJid, contact\)/g, 'async function sendMainMenu(clientAdapter, remoteJid, contact)');
content = content.replace(/await sendMainMenu\(sock, remoteJid, contact\)/g, 'await sendMainMenu(clientAdapter, remoteJid, contact)');

// Replace handleIncomingMessage signature
content = content.replace(/async function handleIncomingMessage\(msg, sessionId, sock\)/g, 'async function handleIncomingMessage(normalizedMsg, sessionId, clientAdapter)');

// Replace sock.sendMessage(..., { text: ... }) with clientAdapter.sendMessage(..., ...)
// Regex handles newlines in text by using [\s\S]*?
content = content.replace(/sock\.sendMessage\(([^,]+),\s*\{\s*text:\s*([\s\S]*?)\s*\}\)/g, 'clientAdapter.sendMessage($1, $2)');
// There might be some nested objects, let's just do a simpler one:
content = content.replace(/sock\.sendMessage\(([\w]+),\s*\{\s*text:\s*(.+?)\s*\}\)/g, 'clientAdapter.sendMessage($1, $2)'); // But some have backticks.

// It's safer to use a more robust regex for text extraction.
// Let's use a function replacer.
content = content.replace(/sock\.sendMessage\(\s*([^,]+)\s*,\s*\{\s*text:\s*([^}]+?)\s*\}\s*\)/g, 'clientAdapter.sendMessage($1, $2)');

fs.writeFileSync('chatbot/MessageHandler.js.refactored', content);
console.log('Refactored partially.');
