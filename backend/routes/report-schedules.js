const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();
const prisma = new PrismaClient();

// Get all schedules
router.get('/', authenticateToken, async (req, res) => {
  try {
    let whereClause = {};
    if (req.user.role !== 'DEVELOPER') {
      whereClause = {
        OR: [
          {
            session: {
              users: {
                some: { id: req.user.id }
              }
            }
          },
          {
            sessionId: null
          }
        ]
      };
    }

    const schedules = await prisma.reportSchedule.findMany({
      where: whereClause,
      include: {
        session: true,
      },
      orderBy: { createdAt: 'desc' }
    });
    res.json(schedules);
  } catch (error) {
    console.error('Error fetching schedules:', error);
    res.status(500).json({ error: 'Failed to fetch schedules' });
  }
});

// Create schedule
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { name, prompt, period, sessionId, senderSessionId, exportFormat, targetWaNumber, targetEmail, scheduleTime, scope, targetChat } = req.body;
    
    if (!name || !prompt || !sessionId || !targetWaNumber || !scheduleTime) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const schedule = await prisma.reportSchedule.create({
      data: {
        name,
        prompt,
        period: period || 'today',
        sessionId,
        senderSessionId,
        exportFormat: exportFormat || 'pdf',
        targetWaNumber,
        targetEmail,
        scheduleTime,
        scope: scope || 'device',
        targetChat: targetChat || null,
        createdBy: req.user.id
      }
    });

    res.json(schedule);
  } catch (error) {
    console.error('Error creating schedule:', error);
    res.status(500).json({ error: 'Failed to create schedule' });
  }
});

// Update schedule status
router.patch('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { isActive } = req.body;
    
    const schedule = await prisma.reportSchedule.update({
      where: { id },
      data: { isActive }
    });
    
    res.json(schedule);
  } catch (error) {
    console.error('Error updating schedule:', error);
    res.status(500).json({ error: 'Failed to update schedule' });
  }
});

// Update schedule (edit all fields)
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, prompt, period, sessionId, senderSessionId, exportFormat, targetWaNumber, targetEmail, scheduleTime, scope, targetChat } = req.body;
    
    if (!name || !prompt || !sessionId || !targetWaNumber || !scheduleTime) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const schedule = await prisma.reportSchedule.update({
      where: { id },
      data: {
        name,
        prompt,
        period,
        sessionId,
        senderSessionId,
        exportFormat,
        targetWaNumber,
        targetEmail,
        scheduleTime,
        scope,
        targetChat,
      }
    });
    
    res.json(schedule);
  } catch (error) {
    console.error('Error editing schedule:', error);
    res.status(500).json({ error: 'Failed to edit schedule' });
  }
});

// Delete schedule
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    await prisma.reportSchedule.delete({ where: { id } });
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting schedule:', error);
    res.status(500).json({ error: 'Failed to delete schedule' });
  }
});

// Run schedule immediately
router.post('/:id/run-now', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { executeScheduleById } = require('../scheduler');
    
    // We execute it asynchronously so the request doesn't hang
    // Alternatively we can await it if we want to return success only when done
    // Let's await it to return true completion status
    const result = await executeScheduleById(id);
    res.json(result);
  } catch (error) {
    console.error('Error running schedule immediately:', error);
    res.status(500).json({ error: error.message || 'Failed to execute schedule' });
  }
});

module.exports = router;
