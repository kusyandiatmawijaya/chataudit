const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();
const BACKUP_DIR = path.join(__dirname, '..', 'backups');

// Strip Prisma-specific query params (like ?schema=public) that pg_dump/psql don't understand
const getCleanDbUrl = () => {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) throw new Error('DATABASE_URL is not set in environment variables');
  // Remove query string entirely — pg_dump only needs the base connection URI
  return dbUrl.split('?')[0];
};

// Ensure backup directory exists
const getBackupDir = () => {
  if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
  }
  return BACKUP_DIR;
};

/**
 * Create a database backup using pg_dump.
 * @param {string} type - 'scheduled' | 'manual' | 'pre_writeoff'
 * @param {string|null} userId - ID of the user who triggered the backup (null for scheduled)
 * @returns {object} - { success, filename, fileSize, logId }
 */
const createBackup = async (type = 'manual', userId = null) => {
  const backupDir = getBackupDir();
  const now = new Date();
  const dateStr = now.toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const filename = `backup_${type}_${dateStr}.sql`;
  const filepath = path.join(backupDir, filename);

  try {
    const dbUrl = getCleanDbUrl();

    // Use pg_dump with the cleaned DATABASE_URL
    const cmd = `pg_dump "${dbUrl}" --no-owner --no-acl -f "${filepath}"`;
    execSync(cmd, { timeout: 120000 }); // 2 minute timeout

    // Get file size
    const stats = fs.statSync(filepath);
    const fileSize = stats.size;

    // Log to database
    const log = await prisma.backupLog.create({
      data: {
        filename,
        fileSize: BigInt(fileSize),
        status: 'success',
        type,
        createdBy: userId
      }
    });

    console.log(`Backup created successfully: ${filename} (${(fileSize / 1024).toFixed(1)} KB)`);
    return { success: true, filename, fileSize, logId: log.id };
  } catch (error) {
    console.error('Backup failed:', error.message);

    // Log failure to database
    const log = await prisma.backupLog.create({
      data: {
        filename,
        fileSize: BigInt(0),
        status: 'failed',
        type,
        errorMessage: error.message,
        createdBy: userId
      }
    });

    // Clean up partial file if exists
    if (fs.existsSync(filepath)) {
      fs.unlinkSync(filepath);
    }

    return { success: false, error: error.message, logId: log.id };
  }
};

/**
 * Restore a database from a backup file.
 * Uses psql to execute the SQL dump, dropping and recreating tables.
 * @param {string} logId - ID of the BackupLog entry to restore from
 * @returns {object} - { success, message }
 */
const restoreBackup = async (logId) => {
  try {
    const log = await prisma.backupLog.findUnique({ where: { id: logId } });
    if (!log) {
      throw new Error('Backup log not found');
    }
    if (log.status !== 'success') {
      throw new Error('Cannot restore from a failed backup');
    }

    const filepath = path.join(getBackupDir(), log.filename);
    if (!fs.existsSync(filepath)) {
      throw new Error(`Backup file not found: ${log.filename}`);
    }

    const dbUrl = getCleanDbUrl();

    // Execute restore using psql
    // --single-transaction ensures all-or-nothing restore
    const cmd = `psql "${dbUrl}" -f "${filepath}" --single-transaction`;
    execSync(cmd, { timeout: 300000 }); // 5 minute timeout

    console.log(`Database restored successfully from: ${log.filename}`);
    return { success: true, message: `Database restored from ${log.filename}` };
  } catch (error) {
    console.error('Restore failed:', error.message);
    return { success: false, error: error.message };
  }
};

/**
 * Remove backup files older than the specified retention period.
 * @param {number} retentionDays - Number of days to keep backups
 * @returns {object} - { deletedCount, deletedFiles }
 */
const cleanupOldBackups = async (retentionDays = 30) => {
  const backupDir = getBackupDir();
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

  const deletedFiles = [];

  try {
    // Find old backup logs
    const oldLogs = await prisma.backupLog.findMany({
      where: {
        createdAt: {
          lt: cutoffDate
        }
      }
    });

    for (const log of oldLogs) {
      // Delete the file
      const filepath = path.join(backupDir, log.filename);
      if (fs.existsSync(filepath)) {
        fs.unlinkSync(filepath);
        deletedFiles.push(log.filename);
      }

      // Delete the log entry
      await prisma.backupLog.delete({ where: { id: log.id } });
    }

    if (deletedFiles.length > 0) {
      console.log(`Cleanup: Deleted ${deletedFiles.length} old backups (older than ${retentionDays} days)`);
    }

    return { deletedCount: deletedFiles.length, deletedFiles };
  } catch (error) {
    console.error('Cleanup error:', error.message);
    return { deletedCount: 0, deletedFiles: [], error: error.message };
  }
};

module.exports = { createBackup, restoreBackup, cleanupOldBackups, getBackupDir, BACKUP_DIR };
