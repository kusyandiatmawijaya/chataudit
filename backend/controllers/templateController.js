const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

exports.getTemplates = async (req, res) => {
  try {
    const templates = await prisma.template.findMany({
      orderBy: { createdAt: 'desc' }
    });
    res.json(templates);
  } catch (error) {
    console.error('Error fetching templates:', error);
    res.status(500).json({ error: 'Failed to fetch templates' });
  }
};

exports.getTemplateById = async (req, res) => {
  try {
    const { id } = req.params;
    const template = await prisma.template.findUnique({
      where: { id }
    });
    if (!template) {
      return res.status(404).json({ error: 'Template not found' });
    }
    res.json(template);
  } catch (error) {
    console.error('Error fetching template:', error);
    res.status(500).json({ error: 'Failed to fetch template' });
  }
};

exports.createTemplate = async (req, res) => {
  try {
    const { name, type, header, body, footer } = req.body;
    let { mediaUrl } = req.body;
    
    if (req.file) {
      mediaUrl = `/uploads/broadcast_media/${req.file.filename}`;
    }
    
    if (!name || !type || !body) {
      return res.status(400).json({ error: 'Name, type, and body are required' });
    }

    const template = await prisma.template.create({
      data: {
        name,
        type,
        header,
        body,
        footer,
        mediaUrl
      }
    });
    res.status(201).json(template);
  } catch (error) {
    console.error('Error creating template:', error);
    res.status(500).json({ error: 'Failed to create template' });
  }
};

exports.updateTemplate = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, type, header, body, footer } = req.body;
    let { mediaUrl } = req.body;

    if (req.file) {
      mediaUrl = `/uploads/broadcast_media/${req.file.filename}`;
    }

    const template = await prisma.template.update({
      where: { id },
      data: {
        name,
        type,
        header,
        body,
        footer,
        mediaUrl
      }
    });
    res.json(template);
  } catch (error) {
    console.error('Error updating template:', error);
    res.status(500).json({ error: 'Failed to update template' });
  }
};

exports.deleteTemplate = async (req, res) => {
  try {
    const { id } = req.params;
    await prisma.template.delete({
      where: { id }
    });
    res.json({ message: 'Template deleted successfully' });
  } catch (error) {
    console.error('Error deleting template:', error);
    res.status(500).json({ error: 'Failed to delete template' });
  }
};

exports.getTemplateDashboard = async (req, res) => {
  try {
    const { id } = req.params;
    
    // Check if template exists
    const template = await prisma.template.findUnique({ where: { id } });
    if (!template) return res.status(404).json({ error: 'Template not found' });

    // Aggregate recipient statuses for all broadcasts of this template
    const stats = await prisma.broadcastRecipient.groupBy({
      by: ['status', 'deliveryStatus'],
      where: {
        broadcast: {
          templateId: id
        }
      },
      _count: {
        status: true
      }
    });

    let dashboard = {
      total: 0,
      sent: 0,
      pending: 0,
      failed: 0
    };

    stats.forEach(stat => {
      const count = stat._count.status;
      dashboard.total += count;
      
      if (stat.status === 'FAILED' || stat.deliveryStatus === 'ERROR') {
        dashboard.failed += count;
      } else if (stat.status === 'PENDING') {
        dashboard.pending += count;
      } else if (stat.status === 'SENT') {
        dashboard.sent += count;
      }
    });

    res.json(dashboard);
  } catch (error) {
    console.error('Error fetching template dashboard:', error);
    res.status(500).json({ error: 'Failed to fetch template dashboard' });
  }
};

exports.getTemplateHistory = async (req, res) => {
  try {
    const { id } = req.params;
    
    // Check if template exists
    const template = await prisma.template.findUnique({ where: { id } });
    if (!template) return res.status(404).json({ error: 'Template not found' });

    const history = await prisma.broadcastRecipient.findMany({
      where: {
        broadcast: {
          templateId: id
        }
      },
      include: {
        broadcast: {
          select: { name: true, sessionId: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    res.json(history);
  } catch (error) {
    console.error('Error fetching template history:', error);
    res.status(500).json({ error: 'Failed to fetch template history' });
  }
};
