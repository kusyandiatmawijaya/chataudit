const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

exports.getAllPersonas = async (req, res) => {
  try {
    const personas = await prisma.persona.findMany({
      orderBy: { createdAt: 'asc' }
    });
    res.json(personas);
  } catch (error) {
    console.error('Error fetching personas:', error);
    res.status(500).json({ error: 'Failed to fetch personas' });
  }
};

exports.getPersonaById = async (req, res) => {
  try {
    const { id } = req.params;
    const persona = await prisma.persona.findUnique({
      where: { id }
    });
    if (!persona) return res.status(404).json({ error: 'Persona not found' });
    res.json(persona);
  } catch (error) {
    console.error('Error fetching persona:', error);
    res.status(500).json({ error: 'Failed to fetch persona' });
  }
};

exports.createPersona = async (req, res) => {
  try {
    const { name, systemPrompt, toolAccess } = req.body;
    if (!name || !systemPrompt) {
      return res.status(400).json({ error: 'Name and systemPrompt are required' });
    }
    const persona = await prisma.persona.create({
      data: { name, systemPrompt, toolAccess: toolAccess || 'EXTERNAL' }
    });
    res.status(201).json(persona);
  } catch (error) {
    console.error('Error creating persona:', error);
    res.status(500).json({ error: 'Failed to create persona' });
  }
};

exports.updatePersona = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, systemPrompt, toolAccess } = req.body;
    const persona = await prisma.persona.update({
      where: { id },
      data: { name, systemPrompt, toolAccess: toolAccess || 'EXTERNAL' }
    });
    res.json(persona);
  } catch (error) {
    console.error('Error updating persona:', error);
    res.status(500).json({ error: 'Failed to update persona' });
  }
};

exports.deletePersona = async (req, res) => {
  try {
    const { id } = req.params;
    await prisma.persona.delete({
      where: { id }
    });
    res.json({ success: true, message: 'Persona deleted successfully' });
  } catch (error) {
    console.error('Error deleting persona:', error);
    res.status(500).json({ error: 'Failed to delete persona' });
  }
};
