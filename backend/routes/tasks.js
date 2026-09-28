const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { generateProgressReport } = require('../services/aiAuditor.service');
const prisma = new PrismaClient();
const router = express.Router();

// Create a Task
router.post('/', async (req, res) => {
  try {
    const { issueId, picId, assignerId, deadline } = req.body;
    
    if (!issueId || !picId || !assignerId || !deadline) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const task = await prisma.task.create({
      data: {
        issueId,
        picId,
        assignerId,
        deadline: new Date(deadline),
        status: 'OPEN'
      },
      include: {
        pic: true,
        issue: true
      }
    });

    try {
      const pic = task.pic;
      const issueTitle = task.issue?.title || 'Tugas Baru';
      const msgText = `🔔 *Tugas Baru Diberikan*\n\nAnda mendapatkan tugas baru: *${issueTitle}*\nID Tugas: ${task.id}\nDeadline: ${new Date(deadline).toLocaleDateString()}\n\nSilakan cek Task Monitoring Dashboard:\nhttps://auditwa.padmasaripangan.co.id/task-monitoring`;
      
      const settings = await prisma.appSetting.findMany({
        where: { key: { in: ['DEFAULT_NOTIF_TELEGRAM', 'DEFAULT_NOTIF_WHATSAPP'] } }
      });
      const defaultTelegram = settings.find(s => s.key === 'DEFAULT_NOTIF_TELEGRAM')?.value;
      const defaultWhatsapp = settings.find(s => s.key === 'DEFAULT_NOTIF_WHATSAPP')?.value;

      if (defaultTelegram && pic.telegramId) {
        const { getTelegramBot } = require('../telegram');
        const TelegramAdapter = require('../adapters/TelegramAdapter');
        const bot = getTelegramBot(defaultTelegram);
        if (bot) {
          const adapter = new TelegramAdapter(bot, null, defaultTelegram);
          await adapter.sendMessage(adapter.formatJid(pic.telegramId), msgText);
        } else {
          console.warn('Telegram bot not connected');
        }
      }

      if (defaultWhatsapp && pic.whatsappId) {
        const { getSock } = require('../whatsapp');
        const WhatsAppAdapter = require('../adapters/WhatsAppAdapter');
        const sock = getSock(defaultWhatsapp);
        if (sock) {
          const adapter = new WhatsAppAdapter(sock);
          await adapter.sendMessage(adapter.formatJid(pic.whatsappId), msgText);
        } else {
          console.warn('WhatsApp sock not connected');
        }
      }
    } catch (notifErr) {
      console.error('Failed to send task notification:', notifErr);
    }

    res.status(201).json({ success: true, task });
  } catch (error) {
    console.error('Error creating task:', error);
    res.status(500).json({ error: 'Failed to create task', details: error.message });
  }
});

// List all Tasks
router.get('/', async (req, res) => {
  try {
    const tasks = await prisma.task.findMany({
      include: {
        issue: true,
        pic: { select: { username: true } },
        assigner: { select: { username: true } }
      },
      orderBy: { createdAt: 'desc' }
    });
    res.json({ success: true, tasks });
  } catch (error) {
    console.error('Error listing tasks:', error);
    res.status(500).json({ error: 'Failed to list tasks', details: error.message });
  }
});

// Update Task Status
router.put('/:id/status', async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    
    if (!['OPEN', 'SOLVE_AND_CLOSE', 'OPEN_CONTINUE', 'OPEN_CLOSE'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    const task = await prisma.task.update({
      where: { id },
      data: { status }
    });

    res.json({ success: true, task });
  } catch (error) {
    console.error('Error updating task status:', error);
    res.status(500).json({ error: 'Failed to update task status', details: error.message });
  }
});

// Trigger AI Audit
router.post('/:id/trigger-audit', async (req, res) => {
  try {
    const { id } = req.params;
    
    // Call the service to generate report
    const updatedTask = await generateProgressReport(id);
    
    res.json({ success: true, task: updatedTask });
  } catch (error) {
    console.error('Error triggering AI audit:', error);
    res.status(500).json({ error: 'Failed to trigger AI audit', details: error.message });
  }
});

// Acknowledge Task
router.put('/:id/acknowledge', async (req, res) => {
  try {
    const { id } = req.params;
    const task = await prisma.task.update({
      where: { id },
      data: { isAcknowledged: true }
    });
    res.json({ success: true, task });
  } catch (error) {
    console.error('Error acknowledging task:', error);
    res.status(500).json({ error: 'Failed to acknowledge task', details: error.message });
  }
});

// Update Task Notes
router.put('/:id/notes', async (req, res) => {
  try {
    const { id } = req.params;
    const { picNotes } = req.body;
    const task = await prisma.task.update({
      where: { id },
      data: { picNotes }
    });
    res.json({ success: true, task });
  } catch (error) {
    console.error('Error updating task notes:', error);
    res.status(500).json({ error: 'Failed to update task notes', details: error.message });
  }
});

// Update PIC
router.put('/:id/pic', async (req, res) => {
  try {
    const { id } = req.params;
    const { picId } = req.body;
    
    if (!picId) {
      return res.status(400).json({ error: 'Missing picId' });
    }

    const task = await prisma.task.update({
      where: { id },
      data: { picId },
      include: {
        pic: { select: { username: true } },
        issue: true
      }
    });

    res.json({ success: true, task });
  } catch (error) {
    console.error('Error updating PIC:', error);
    res.status(500).json({ error: 'Failed to update PIC', details: error.message });
  }
});

// Delete Task
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await prisma.task.delete({
      where: { id }
    });
    res.json({ success: true, message: 'Task deleted successfully' });
  } catch (error) {
    console.error('Error deleting task:', error);
    res.status(500).json({ error: 'Failed to delete task', details: error.message });
  }
});

// Resend Notification
router.post('/:id/resend-notification', async (req, res) => {
  try {
    const { id } = req.params;

    const task = await prisma.task.findUnique({
      where: { id },
      include: { pic: true, issue: true }
    });

    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }

    const pic = task.pic;
    const issueTitle = task.issue?.title || 'Tugas';
    const msgText = `🔔 *Reminder Tugas*\n\nAnda memiliki tugas: *${issueTitle}*\nID Tugas: ${task.id}\nDeadline: ${new Date(task.deadline).toLocaleDateString()}\n\nSilakan cek Task Monitoring Dashboard:\nhttps://auditwa.padmasaripangan.co.id/task-monitoring`;
      
    let sent = false;

    const settings = await prisma.appSetting.findMany({
      where: { key: { in: ['DEFAULT_NOTIF_TELEGRAM', 'DEFAULT_NOTIF_WHATSAPP'] } }
    });
    const defaultTelegram = settings.find(s => s.key === 'DEFAULT_NOTIF_TELEGRAM')?.value;
    const defaultWhatsapp = settings.find(s => s.key === 'DEFAULT_NOTIF_WHATSAPP')?.value;

    if (defaultTelegram && pic.telegramId) {
      const { getTelegramBot } = require('../telegram');
      const TelegramAdapter = require('../adapters/TelegramAdapter');
      const bot = getTelegramBot(defaultTelegram);
      if (bot) {
        const adapter = new TelegramAdapter(bot, null, defaultTelegram);
        await adapter.sendMessage(adapter.formatJid(pic.telegramId), msgText);
        sent = true;
      }
    }
    
    if (defaultWhatsapp && pic.whatsappId) {
      const { getSock } = require('../whatsapp');
      const WhatsAppAdapter = require('../adapters/WhatsAppAdapter');
      const sock = getSock(defaultWhatsapp);
      if (sock) {
        const adapter = new WhatsAppAdapter(sock);
        await adapter.sendMessage(adapter.formatJid(pic.whatsappId), msgText);
        sent = true;
      }
    }

    if (!sent) {
       return res.status(400).json({ error: 'Gagal mengirim notifikasi. Pastikan default device diatur di Settings dan PIC memiliki ID yang valid.' });
    }

    res.json({ success: true, message: 'Notification sent successfully' });
  } catch (error) {
    console.error('Error resending notification:', error);
    res.status(500).json({ error: 'Failed to resend notification', details: error.message });
  }
});

module.exports = router;
