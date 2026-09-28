const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// GET /api/prompt-templates
// Returns templates grouped by category
router.get('/', async (req, res) => {
  try {
    const templates = await prisma.promptTemplate.findMany({
      orderBy: [
        { category: 'asc' },
        { title: 'asc' }
      ]
    });
    
    // Group by category
    const grouped = templates.reduce((acc, curr) => {
      if (!acc[curr.category]) {
        acc[curr.category] = [];
      }
      acc[curr.category].push(curr);
      return acc;
    }, {});

    res.json(grouped);
  } catch (error) {
    console.error('Error fetching prompt templates:', error);
    res.status(500).json({ error: 'Failed to fetch prompt templates' });
  }
});

// GET /api/prompt-templates/raw
// Returns all templates as a flat array for management
router.get('/raw', async (req, res) => {
  try {
    const templates = await prisma.promptTemplate.findMany({
      orderBy: [
        { category: 'asc' },
        { title: 'asc' }
      ]
    });
    res.json(templates);
  } catch (error) {
    console.error('Error fetching raw prompt templates:', error);
    res.status(500).json({ error: 'Failed to fetch raw prompt templates' });
  }
});

// POST /api/prompt-templates
router.post('/', async (req, res) => {
  try {
    const { category, title, type, formFields, templateText } = req.body;
    const newTemplate = await prisma.promptTemplate.create({
      data: {
        category,
        title,
        type,
        formFields: type === 'FORM' ? formFields : null,
        templateText
      }
    });
    res.json(newTemplate);
  } catch (error) {
    console.error('Error creating prompt template:', error);
    res.status(500).json({ error: 'Failed to create prompt template' });
  }
});

// PUT /api/prompt-templates/:id
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { category, title, type, formFields, templateText } = req.body;
    const updatedTemplate = await prisma.promptTemplate.update({
      where: { id: parseInt(id) },
      data: {
        category,
        title,
        type,
        formFields: type === 'FORM' ? formFields : null,
        templateText
      }
    });
    res.json(updatedTemplate);
  } catch (error) {
    console.error('Error updating prompt template:', error);
    res.status(500).json({ error: 'Failed to update prompt template' });
  }
});

// DELETE /api/prompt-templates/:id
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await prisma.promptTemplate.delete({
      where: { id: parseInt(id) }
    });
    res.json({ message: 'Template deleted successfully' });
  } catch (error) {
    console.error('Error deleting prompt template:', error);
    res.status(500).json({ error: 'Failed to delete prompt template' });
  }
});

module.exports = router;
