const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Get all general report schedules
router.get('/', async (req, res) => {
    try {
        const schedules = await prisma.generalReportSchedule.findMany({
            orderBy: { createdAt: 'asc' }
        });
        res.json(schedules);
    } catch (error) {
        console.error('Error fetching general report schedules:', error);
        res.status(500).json({ error: 'Failed to fetch schedules' });
    }
});

// Update a schedule (time or isActive or senderSessionId)
router.patch('/:id', async (req, res) => {
    const { id } = req.params;
    const { scheduleTime, isActive, senderSessionId } = req.body;
    
    try {
        const dataToUpdate = {};
        if (scheduleTime !== undefined) dataToUpdate.scheduleTime = scheduleTime;
        if (isActive !== undefined) dataToUpdate.isActive = isActive;
        if (senderSessionId !== undefined) dataToUpdate.senderSessionId = senderSessionId;

        const updated = await prisma.generalReportSchedule.update({
            where: { id },
            data: dataToUpdate
        });
        res.json(updated);
    } catch (error) {
        console.error(`Error updating general report schedule ${id}:`, error);
        res.status(500).json({ error: 'Failed to update schedule' });
    }
});

// Create/Init a schedule (Optional, usually used once)
router.post('/init', async (req, res) => {
    try {
        const existing = await prisma.generalReportSchedule.findUnique({
            where: { reportId: 'salesman_monthly' }
        });

        if (!existing) {
            const created = await prisma.generalReportSchedule.create({
                data: {
                    name: 'Salesman Monthly Report',
                    reportId: 'salesman_monthly',
                    scheduleTime: '07:00',
                    isActive: true
                }
            });
            return res.json({ success: true, data: created });
        }
        res.json({ success: true, data: existing, message: 'Already exists' });
    } catch (error) {
        console.error('Error init general report schedule:', error);
        res.status(500).json({ error: 'Failed to init schedule' });
    }
});

// Preview a report
router.get('/preview/:reportId', async (req, res) => {
    const { reportId } = req.params;
    try {
        if (reportId === 'salesman_monthly') {
            const { generatePreviewReport } = require('../services/salesmanReportService');
            const filepath = await generatePreviewReport();
            return res.sendFile(filepath);
        }
        res.status(404).json({ error: 'Preview not supported for this report ID' });
    } catch (error) {
        console.error(`Error generating preview for ${reportId}:`, error);
        res.status(500).json({ error: 'Failed to generate preview: ' + error.message });
    }
});

module.exports = router;
