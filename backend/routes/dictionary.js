const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();
const prisma = new PrismaClient();

// Middleware to check for DEVELOPER or ADMINISTRATOR role
const authorizeAdmin = (req, res, next) => {
  if (req.user.role !== 'DEVELOPER' && req.user.role !== 'ADMINISTRATOR') {
    return res.status(403).json({ error: 'Forbidden: Insufficient privileges' });
  }
  next();
};

// Get all dictionary terms (accessible by all authenticated users for viewing)
router.get('/', authenticateToken, async (req, res) => {
  try {
    const dictionaries = await prisma.dictionary.findMany({
      orderBy: { term: 'asc' }
    });
    res.json(dictionaries);
  } catch (error) {
    console.error('Error fetching dictionaries:', error);
    res.status(500).json({ error: 'Failed to fetch dictionaries' });
  }
});

// Create new term (restricted)
router.post('/', authenticateToken, authorizeAdmin, async (req, res) => {
  try {
    const { term, definition } = req.body;
    if (!term || !definition) {
      return res.status(400).json({ error: 'Term and definition are required' });
    }

    const newTerm = await prisma.dictionary.create({
      data: {
        term,
        definition
      }
    });

    res.json(newTerm);
  } catch (error) {
    console.error('Error creating dictionary term:', error);
    if (error.code === 'P2002') {
        return res.status(400).json({ error: 'Term already exists' });
    }
    res.status(500).json({ error: 'Failed to create dictionary term' });
  }
});

// Update term (restricted)
router.put('/:id', authenticateToken, authorizeAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { term, definition } = req.body;

    if (!term || !definition) {
      return res.status(400).json({ error: 'Term and definition are required' });
    }

    const updatedTerm = await prisma.dictionary.update({
      where: { id },
      data: {
        term,
        definition
      }
    });

    res.json(updatedTerm);
  } catch (error) {
    console.error('Error updating dictionary term:', error);
    if (error.code === 'P2002') {
        return res.status(400).json({ error: 'Term already exists' });
    }
    res.status(500).json({ error: 'Failed to update dictionary term' });
  }
});

// Delete term (restricted)
router.delete('/:id', authenticateToken, authorizeAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    await prisma.dictionary.delete({
      where: { id }
    });
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting dictionary term:', error);
    res.status(500).json({ error: 'Failed to delete dictionary term' });
  }
});

module.exports = router;
