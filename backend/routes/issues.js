const express = require('express');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const router = express.Router();

// Create an Issue
router.post('/', async (req, res) => {
  try {
    const { sourceModule, title, queryParameters, initialSnapshot, aiSummary, createdBy } = req.body;
    
    if (!sourceModule || !title || !queryParameters || !initialSnapshot || !createdBy) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const issue = await prisma.issue.create({
      data: {
        sourceModule,
        title,
        queryParameters,
        initialSnapshot,
        aiSummary,
        createdBy,
      }
    });

    res.status(201).json({ success: true, issue });
  } catch (error) {
    console.error('Error creating issue:', error);
    res.status(500).json({ error: 'Failed to create issue', details: error.message });
  }
});

// List all Issues
router.get('/', async (req, res) => {
  try {
    const issues = await prisma.issue.findMany({
      include: {
        user: { select: { username: true } },
        tasks: true
      },
      orderBy: { createdAt: 'desc' }
    });
    res.json({ success: true, issues });
  } catch (error) {
    console.error('Error listing issues:', error);
    res.status(500).json({ error: 'Failed to list issues', details: error.message });
  }
});

module.exports = router;
