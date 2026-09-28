const express = require('express');
const fs = require('fs');
const path = require('path');
const { PrismaClient } = require('@prisma/client');
const { authenticateToken, authorizeRole } = require('../middleware/auth');
const { createBackup, restoreBackup, cleanupOldBackups, getBackupDir } = require('../utils/backup-utils');

const router = express.Router();
const prisma = new PrismaClient();
const UPLOADS_DIR = path.join(__dirname, '..', 'uploads');

// All routes require authentication + DEVELOPER or ADMINISTRATOR role
router.use(authenticateToken);
router.use(authorizeRole('DEVELOPER', 'ADMINISTRATOR'));

// ==========================================
// BACKUP SCHEDULE ENDPOINTS
// ==========================================

// Get all backup schedules
router.get('/schedules', async (req, res) => {
  try {
    const schedules = await prisma.backupSchedule.findMany({
      include: { user: { select: { id: true, username: true } } },
      orderBy: { createdAt: 'desc' }
    });
    res.json(schedules);
  } catch (error) {
    console.error('Error fetching backup schedules:', error);
    res.status(500).json({ error: 'Failed to fetch backup schedules' });
  }
});

// Create a backup schedule
router.post('/schedules', async (req, res) => {
  try {
    const { frequency, backupTime, retentionDays } = req.body;

    if (!backupTime) {
      return res.status(400).json({ error: 'backupTime is required' });
    }

    const schedule = await prisma.backupSchedule.create({
      data: {
        frequency: frequency || 'daily',
        backupTime,
        retentionDays: retentionDays || 30,
        createdBy: req.user.id
      }
    });

    res.json(schedule);
  } catch (error) {
    console.error('Error creating backup schedule:', error);
    res.status(500).json({ error: 'Failed to create backup schedule' });
  }
});

// Toggle backup schedule active/inactive
router.patch('/schedules/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { isActive } = req.body;

    const schedule = await prisma.backupSchedule.update({
      where: { id },
      data: { isActive }
    });

    res.json(schedule);
  } catch (error) {
    console.error('Error updating backup schedule:', error);
    res.status(500).json({ error: 'Failed to update backup schedule' });
  }
});

// Delete a backup schedule
router.delete('/schedules/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await prisma.backupSchedule.delete({ where: { id } });
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting backup schedule:', error);
    res.status(500).json({ error: 'Failed to delete backup schedule' });
  }
});

// ==========================================
// BACKUP EXECUTION ENDPOINTS
// ==========================================

// Run backup immediately (manual)
router.post('/run-now', async (req, res) => {
  try {
    const result = await createBackup('manual', req.user.id);
    if (result.success) {
      res.json({ success: true, message: 'Backup created successfully', ...result });
    } else {
      res.status(500).json({ success: false, error: result.error });
    }
  } catch (error) {
    console.error('Error running backup:', error);
    res.status(500).json({ error: 'Failed to run backup' });
  }
});

// ==========================================
// BACKUP LOG ENDPOINTS
// ==========================================

// Get backup logs
router.get('/logs', async (req, res) => {
  try {
    const logs = await prisma.backupLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: 100
    });
    // Convert BigInt to string for JSON serialization
    const serialized = logs.map(log => ({
      ...log,
      fileSize: log.fileSize.toString()
    }));
    res.json(serialized);
  } catch (error) {
    console.error('Error fetching backup logs:', error);
    res.status(500).json({ error: 'Failed to fetch backup logs' });
  }
});

// Download a backup file
// Supports token via query parameter for window.open compatibility
router.get('/download/:id', async (req, res) => {
  try {
    // Support token via query param since window.open can't send Authorization header
    if (req.query.token && !req.headers['authorization']) {
      req.headers['authorization'] = `Bearer ${req.query.token}`;
    }
    
    const { id } = req.params;
    const log = await prisma.backupLog.findUnique({ where: { id } });

    if (!log) {
      return res.status(404).json({ error: 'Backup log not found' });
    }

    const filepath = path.join(getBackupDir(), log.filename);
    if (!fs.existsSync(filepath)) {
      return res.status(404).json({ error: 'Backup file not found on disk' });
    }

    res.download(filepath, log.filename);
  } catch (error) {
    console.error('Error downloading backup:', error);
    res.status(500).json({ error: 'Failed to download backup' });
  }
});

// Delete a backup log and its file
router.delete('/logs/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const log = await prisma.backupLog.findUnique({ where: { id } });

    if (!log) {
      return res.status(404).json({ error: 'Backup log not found' });
    }

    // Delete the file from disk
    const filepath = path.join(getBackupDir(), log.filename);
    if (fs.existsSync(filepath)) {
      fs.unlinkSync(filepath);
    }

    // Delete the log entry
    await prisma.backupLog.delete({ where: { id } });

    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting backup log:', error);
    res.status(500).json({ error: 'Failed to delete backup log' });
  }
});

// ==========================================
// RESTORE ENDPOINT
// ==========================================

// Restore database from a backup
router.post('/restore/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await restoreBackup(id);

    if (result.success) {
      res.json({ success: true, message: result.message });
    } else {
      res.status(500).json({ success: false, error: result.error });
    }
  } catch (error) {
    console.error('Error restoring backup:', error);
    res.status(500).json({ error: 'Failed to restore backup' });
  }
});

// ==========================================
// WRITE-OFF / RESET DATA ENDPOINT
// ==========================================

// Preview how much data will be deleted
router.post('/write-off/preview', async (req, res) => {
  try {
    const { deleteMessages, deleteMedia, deleteReportSchedules, deleteDictionary, deleteExcludedChats, sessionId, olderThan } = req.body;

    const preview = {};
    const dateFilter = olderThan ? { lt: new Date(olderThan) } : undefined;
    const sessionFilter = sessionId && sessionId !== 'all' ? sessionId : undefined;

    if (deleteMessages) {
      const where = {};
      if (sessionFilter) where.sessionId = sessionFilter;
      if (dateFilter) where.timestamp = dateFilter;

      preview.messagesCount = await prisma.message.count({ where });
    }

    if (deleteMedia) {
      // Count media files in uploads directory
      const uploadsDir = UPLOADS_DIR;
      if (fs.existsSync(uploadsDir)) {
        const files = fs.readdirSync(uploadsDir);
        // If we have a date filter or session filter, we need to check messages
        if (dateFilter || sessionFilter) {
          const where = { mediaUrl: { not: null } };
          if (sessionFilter) where.sessionId = sessionFilter;
          if (dateFilter) where.timestamp = dateFilter;
          const mediaMessages = await prisma.message.findMany({ where, select: { mediaUrl: true } });
          preview.mediaFilesCount = mediaMessages.filter(m => m.mediaUrl).length;
        } else {
          // Count files excluding Report_ files (scheduled report outputs)
          preview.mediaFilesCount = files.filter(f => !f.startsWith('Report_')).length;
        }
      } else {
        preview.mediaFilesCount = 0;
      }
    }

    if (deleteReportSchedules) {
      preview.reportSchedulesCount = await prisma.reportSchedule.count();
    }

    if (deleteDictionary) {
      preview.dictionaryCount = await prisma.dictionary.count();
    }

    if (deleteExcludedChats) {
      const where = {};
      if (sessionFilter) where.sessionId = sessionFilter;
      preview.excludedChatsCount = await prisma.excludedChat.count({ where });
    }

    res.json(preview);
  } catch (error) {
    console.error('Error previewing write-off:', error);
    res.status(500).json({ error: 'Failed to preview data for write-off' });
  }
});

// Execute write-off / reset data
router.post('/write-off', async (req, res) => {
  try {
    const { deleteMessages, deleteMedia, deleteReportSchedules, deleteDictionary, deleteExcludedChats, sessionId, olderThan, confirmText } = req.body;

    // Require confirmation text
    if (confirmText !== 'RESET') {
      return res.status(400).json({ error: 'Confirmation text must be "RESET"' });
    }

    // Step 1: Auto-backup before write-off
    console.log('Write-off: Creating pre-writeoff backup...');
    const backupResult = await createBackup('pre_writeoff', req.user.id);
    if (!backupResult.success) {
      return res.status(500).json({ error: `Pre-writeoff backup failed: ${backupResult.error}. Write-off aborted.` });
    }
    console.log('Write-off: Pre-writeoff backup created successfully');

    const summary = { backupCreated: backupResult.filename };
    const dateFilter = olderThan ? { lt: new Date(olderThan) } : undefined;
    const sessionFilter = sessionId && sessionId !== 'all' ? sessionId : undefined;

    // Step 2: Delete media files from disk
    if (deleteMedia) {
      let deletedMediaCount = 0;
      const where = { mediaUrl: { not: null } };
      if (sessionFilter) where.sessionId = sessionFilter;
      if (dateFilter) where.timestamp = dateFilter;

      // Find messages with media that match the filter
      const mediaMessages = await prisma.message.findMany({ where, select: { mediaUrl: true } });

      for (const msg of mediaMessages) {
        if (msg.mediaUrl) {
          const filename = path.basename(msg.mediaUrl);
          const filepath = path.join(UPLOADS_DIR, filename);
          if (fs.existsSync(filepath)) {
            fs.unlinkSync(filepath);
            deletedMediaCount++;
          }
        }
      }

      // If no session or date filter, also clean up any orphaned files (not Report_ files)
      if (!sessionFilter && !dateFilter) {
        if (fs.existsSync(UPLOADS_DIR)) {
          const remainingFiles = fs.readdirSync(UPLOADS_DIR);
          for (const file of remainingFiles) {
            if (!file.startsWith('Report_')) {
              const filepath = path.join(UPLOADS_DIR, file);
              if (fs.statSync(filepath).isFile()) {
                fs.unlinkSync(filepath);
                deletedMediaCount++;
              }
            }
          }
        }
      }

      summary.deletedMediaFiles = deletedMediaCount;
    }

    // Step 3: Delete messages
    if (deleteMessages) {
      const where = {};
      if (sessionFilter) where.sessionId = sessionFilter;
      if (dateFilter) where.timestamp = dateFilter;

      const result = await prisma.message.deleteMany({ where });
      summary.deletedMessages = result.count;
    }

    // Step 4: Delete report schedules (if requested)
    if (deleteReportSchedules) {
      const result = await prisma.reportSchedule.deleteMany();
      summary.deletedReportSchedules = result.count;
    }

    // Step 5: Delete dictionary (if requested)
    if (deleteDictionary) {
      const result = await prisma.dictionary.deleteMany();
      summary.deletedDictionary = result.count;
    }

    // Step 6: Delete excluded chats (if requested)
    if (deleteExcludedChats) {
      const where = {};
      if (sessionFilter) where.sessionId = sessionFilter;
      const result = await prisma.excludedChat.deleteMany({ where });
      summary.deletedExcludedChats = result.count;
    }

    console.log('Write-off completed:', summary);
    res.json({ success: true, summary });
  } catch (error) {
    console.error('Error executing write-off:', error);
    res.status(500).json({ error: 'Failed to execute write-off: ' + error.message });
  }
});

module.exports = router;
