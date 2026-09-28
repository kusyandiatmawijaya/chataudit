// backend/middleware/telegramWebApp.js
const crypto = require('crypto');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

/**
 * Validates the Telegram WebApp initData header.
 * Supports multi-bot by looking up the token from the DB based on the bot that
 * sent the user to the Mini App.
 *
 * Expects header:  x-telegram-init-data: <raw initData string from Telegram.WebApp.initData>
 * Expects header:  x-telegram-session-id: <sessionId e.g. "telegram-1"> (optional, used to pick the right bot token)
 */
async function validateTelegramWebApp(req, res, next) {
  try {
    const initData = req.headers['x-telegram-init-data'];
    const sessionId = req.headers['x-telegram-session-id'] || null;

    if (!initData) {
      // Allow browser testing / simulation if opened directly without Telegram SDK
      req.telegramUser = { id: 1155832761, first_name: 'User' };
      req.telegramUserId = '1155832761';
      req.telegramInitData = '';
      return next();
    }

    // Resolve bot token: prefer sessionId → fallback to first active RETUR bot → fallback to first active bot
    let botToken = null;

    if (sessionId) {
      // e.g. sessionId = "telegram-3"
      const botId = sessionId.replace('telegram-', '');
      const bot = await prisma.telegramBot.findFirst({
        where: { isActive: true, id: botId || undefined },
        select: { token: true }
      });
      if (bot) botToken = bot.token;
    }

    if (!botToken) {
      // Fallback: pick RETUR type bot, or first active bot
      const bot = await prisma.telegramBot.findFirst({
        where: { isActive: true },
        orderBy: [{ type: 'asc' }], // MAIN < RETUR alphabetically
        select: { token: true }
      });
      if (bot) botToken = bot.token;
    }

    if (!botToken) {
      return res.status(500).json({ error: 'No active Telegram bot found' });
    }

    // --- HMAC Validation ---
    const params = new URLSearchParams(initData);
    const hash = params.get('hash');
    if (!hash) {
      return res.status(403).json({ error: 'Missing hash in initData' });
    }
    params.delete('hash');

    const dataCheckString = [...params.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}=${v}`)
      .join('\n');

    const secretKey = crypto
      .createHmac('sha256', 'WebAppData')
      .update(botToken)
      .digest();

    const expectedHash = crypto
      .createHmac('sha256', secretKey)
      .update(dataCheckString)
      .digest('hex');

    if (hash !== expectedHash) {
      return res.status(403).json({ error: 'Invalid initData signature' });
    }

    // Attach parsed Telegram user to request
    const userRaw = params.get('user');
    req.telegramUser = userRaw ? JSON.parse(userRaw) : {};
    req.telegramUserId = req.telegramUser.id ? String(req.telegramUser.id) : null;
    req.telegramInitData = initData;

    next();
  } catch (err) {
    console.error('[TelegramWebApp Middleware] Error:', err);
    return res.status(500).json({ error: 'Internal validation error' });
  }
}

module.exports = { validateTelegramWebApp };
