const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { executeBroadcast } = require('../utils/broadcastService');

exports.getBroadcasts = async (req, res) => {
  try {
    const broadcasts = await prisma.broadcast.findMany({
      include: {
        template: true,
        recipients: {
          select: { status: true, deliveryStatus: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    });
    res.json(broadcasts);
  } catch (error) {
    console.error('Error fetching broadcasts:', error);
    res.status(500).json({ error: 'Failed to fetch broadcasts' });
  }
};

exports.getBroadcastById = async (req, res) => {
  try {
    const { id } = req.params;
    const broadcast = await prisma.broadcast.findUnique({
      where: { id },
      include: {
        template: true,
        recipients: true
      }
    });
    if (!broadcast) return res.status(404).json({ error: 'Broadcast not found' });
    res.json(broadcast);
  } catch (error) {
    console.error('Error fetching broadcast:', error);
    res.status(500).json({ error: 'Failed to fetch broadcast' });
  }
};

exports.createBroadcast = async (req, res) => {
  try {
    const { name, templateId, sessionId, scheduledAt, recipients } = req.body;

    if (!name || !templateId || !sessionId || !recipients || !recipients.length) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // 1. Prevent Duplicates (SENT or PENDING) for the same template ON THE SAME DAY
    const targetDate = scheduledAt ? new Date(scheduledAt) : new Date();
    const startOfDay = new Date(targetDate);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(targetDate);
    endOfDay.setHours(23, 59, 59, 999);

    const phoneNumbers = recipients.map(r => r.phoneNumber);
    const existingRecipients = await prisma.broadcastRecipient.findMany({
      where: {
        phoneNumber: { in: phoneNumbers },
        status: { in: ['SENT', 'PENDING'] },
        broadcast: {
          templateId: templateId,
          OR: [
            {
              scheduledAt: {
                gte: startOfDay,
                lte: endOfDay
              }
            },
            {
              scheduledAt: null,
              createdAt: {
                gte: startOfDay,
                lte: endOfDay
              }
            }
          ]
        }
      },
      select: { phoneNumber: true }
    });

    const existingPhones = new Set(existingRecipients.map(r => r.phoneNumber));
    const newRecipients = recipients.filter(r => !existingPhones.has(r.phoneNumber));

    if (newRecipients.length === 0) {
      return res.status(400).json({ error: 'All recipients have already received or are scheduled to receive this template.' });
    }

    const broadcast = await prisma.broadcast.create({
      data: {
        name,
        templateId,
        sessionId,
        scheduledAt: scheduledAt ? new Date(scheduledAt) : null,
        recipients: {
          create: newRecipients.map(r => ({
            phoneNumber: r.phoneNumber,
            variables: r.variables ? JSON.stringify(r.variables) : null,
            mediaUrl: r.mediaUrl || null
          }))
        }
      }
    });

    // If no scheduledAt or scheduled for past, execute immediately
    if (!scheduledAt || new Date(scheduledAt) <= new Date()) {
      executeBroadcast(broadcast.id);
    }

    res.status(201).json(broadcast);
  } catch (error) {
    console.error('Error creating broadcast:', error);
    res.status(500).json({ error: 'Failed to create broadcast' });
  }
};

exports.deleteBroadcast = async (req, res) => {
  try {
    const { id } = req.params;
    await prisma.broadcast.delete({ where: { id } });
    res.json({ message: 'Broadcast deleted' });
  } catch (error) {
    console.error('Error deleting broadcast:', error);
    res.status(500).json({ error: 'Failed to delete broadcast' });
  }
};

exports.resendMessage = async (req, res) => {
  try {
    const { recipientId } = req.params;
    const { phoneNumber } = req.body;

    // Check if recipient exists
    const recipient = await prisma.broadcastRecipient.findUnique({
      where: { id: recipientId },
      include: { broadcast: true }
    });

    if (!recipient) {
      return res.status(404).json({ error: 'Recipient not found' });
    }

    // Update phone number if provided and change status to PENDING
    await prisma.broadcastRecipient.update({
      where: { id: recipientId },
      data: {
        phoneNumber: phoneNumber || recipient.phoneNumber,
        status: 'PENDING',
        errorReason: null
      }
    });

    // Make sure the parent broadcast is marked as PENDING so cron picks it up
    // Or we can just call executeBroadcast directly
    await prisma.broadcast.update({
      where: { id: recipient.broadcastId },
      data: { status: 'PENDING' }
    });
    
    // Trigger immediately
    executeBroadcast(recipient.broadcastId);

    res.json({ message: 'Resend triggered successfully' });
  } catch (error) {
    console.error('Error resending message:', error);
    res.status(500).json({ error: 'Failed to resend message' });
  }
};
