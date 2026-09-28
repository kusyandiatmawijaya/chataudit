const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const axios = require('axios');
const { MODELS } = require('../utils/Orchestrator');

// Get all settings or specific keys (?keys=A,B,C)
router.get('/', async (req, res) => {
  try {
    const { keys } = req.query;
    let whereClause = {};
    if (keys) {
      whereClause = { key: { in: keys.split(',') } };
    }
    const settings = await prisma.appSetting.findMany({
      where: whereClause
    });
    
    const settingsMap = {};
    settings.forEach(s => {
      settingsMap[s.key] = s.value;
    });
    
    res.json(settingsMap);
  } catch (error) {
    console.error('Error fetching settings:', error);
    res.status(500).json({ error: 'Failed to fetch settings' });
  }
});

// Update or create multiple settings at once
router.post('/batch', async (req, res) => {
  try {
    const { settings } = req.body; // Expects { settings: { KEY1: 'val1', KEY2: 'val2' } }
    
    if (!settings || typeof settings !== 'object') {
      return res.status(400).json({ error: 'Settings object is required' });
    }

    const operations = Object.entries(settings).map(([key, value]) => {
      return prisma.appSetting.upsert({
        where: { key },
        update: { value: String(value) },
        create: { key, value: String(value) }
      });
    });

    await prisma.$transaction(operations);
    
    res.json({ success: true, message: 'Settings updated successfully' });
  } catch (error) {
    console.error('Error batch updating settings:', error);
    res.status(500).json({ error: 'Failed to update settings' });
  }
});

// Get Orchestrator Defaults
router.get('/orchestrator/defaults', (req, res) => {
  res.json({ defaults: MODELS });
});

// Get OpenRouter Credits
router.get('/openrouter/credits', async (req, res) => {
  try {
    if (!process.env.OPENROUTER_API_KEY) {
      return res.status(400).json({ error: 'OPENROUTER_API_KEY is not configured on the server.' });
    }
    const response = await axios.get('https://openrouter.ai/api/v1/credits', {
      headers: { 'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}` }
    });
    res.json(response.data);
  } catch (error) {
    console.error('Error fetching OpenRouter credits:', error.message);
    res.status(500).json({ error: 'Failed to fetch OpenRouter credits' });
  }
});

// Get all available sender devices
router.get('/sender-devices/list', async (req, res) => {
  try {
    const devices = [];
    
    // 1. WhatsApp Sessions
    const sessions = await prisma.session.findMany({
      where: { status: 'ready' },
      select: { sessionId: true, name: true }
    });
    sessions.forEach(s => {
      devices.push({ id: s.sessionId, name: s.name, type: 'whatsapp' });
    });

    // 2. Telegram Bots
    const telegramBots = await prisma.telegramBot.findMany({
      where: { isActive: true },
      select: { id: true, name: true }
    });
    telegramBots.forEach(b => {
      devices.push({ id: `telegram-${b.id}`, name: b.name || 'Telegram Bot', type: 'telegram' });
    });

    // 3. TapTalk
    devices.push({ id: 'taptalk', name: 'TapTalk Official', type: 'taptalk' });

    res.json(devices);
  } catch (error) {
    console.error('Error fetching sender devices:', error);
    res.status(500).json({ error: 'Failed to fetch sender devices' });
  }
});

// Get setting by key
router.get('/:key', async (req, res) => {
  try {
    const { key } = req.params;
    const setting = await prisma.appSetting.findUnique({
      where: { key }
    });
    res.json({ value: setting ? setting.value : null });
  } catch (error) {
    console.error('Error fetching setting:', error);
    res.status(500).json({ error: 'Failed to fetch setting' });
  }
});

// Update or create setting by key
router.post('/:key', async (req, res) => {
  try {
    const { key } = req.params;
    const { value } = req.body;
    
    if (value === undefined) {
      return res.status(400).json({ error: 'Value is required' });
    }

    const setting = await prisma.appSetting.upsert({
      where: { key },
      update: { value: String(value) },
      create: { key, value: String(value) }
    });
    
    res.json(setting);
  } catch (error) {
    console.error('Error updating setting:', error);
    res.status(500).json({ error: 'Failed to update setting' });
  }
});

module.exports = router;
