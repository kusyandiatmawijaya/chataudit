const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// GET /api/print-jobs
// Poll endpoint for local print server
router.get('/', async (req, res) => {
    const { token } = req.query;
    
    try {
        // Validate token against AppSetting or ENV
        const setting = await prisma.appSetting.findUnique({ where: { key: 'PRINT_SERVER_TOKEN' } });
        const expectedToken = setting ? setting.value : process.env.PRINT_SERVER_TOKEN;
        
        if (expectedToken && token !== expectedToken) {
            return res.status(401).json({ error: 'Unauthorized: Invalid Token' });
        }

        const jobs = await prisma.printJob.findMany({
            where: { status: 'PENDING' },
            orderBy: { createdAt: 'asc' }
        });

        const response = jobs.map(job => ({
            id: job.id,
            copies: job.copies,
            base64_data: job.base64_data,
            file_url: job.file_url,
            printer_name: job.printer_name
        }));

        res.json(response);
    } catch (error) {
        console.error('Error fetching print jobs:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// POST /api/print-jobs/:id/ack
// Acknowledge print job as done
router.post('/:id/ack', async (req, res) => {
    const { id } = req.params;
    try {
        await prisma.printJob.update({
            where: { id },
            data: { status: 'PRINTED' }
        });
        res.json({ success: true, message: 'Print job updated to PRINTED' });
    } catch (error) {
        console.error('Error updating print job:', error);
        res.status(500).json({ error: 'Failed to acknowledge print job' });
    }
});

module.exports = router;
