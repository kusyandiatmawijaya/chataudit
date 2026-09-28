const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

exports.getAllContacts = async (req, res) => {
  try {
    const contacts = await prisma.contact.findMany({
      include: {
        persona: true
      },
      orderBy: { updatedAt: 'desc' }
    });
    res.json(contacts);
  } catch (error) {
    console.error('Error fetching contacts:', error);
    res.status(500).json({ error: 'Failed to fetch contacts' });
  }
};

exports.updateContactPersona = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, personaId, group, isAllowed, kodeCustomer, kodeSales, kodeGudang, realPhoneNumber, notes, unban } = req.body;
    
    // validate
    let updateData = { 
      name,
      group,
      isAllowed: isAllowed !== undefined ? isAllowed : undefined,
      realPhoneNumber: realPhoneNumber || null,
      personaId: personaId || null,
      kodeCustomer: kodeCustomer || null,
      kodeSales: kodeSales || null,
      kodeGudang: kodeGudang || null,
      notes: notes || null
    };

    if (unban) {
      updateData.isAllowed = true;
      updateData.botStatus = 'BOT_ACTIVE';
      updateData.strikeCount = 0;
    }

    const contact = await prisma.contact.update({
      where: { id },
      data: updateData,
      include: {
        persona: true
      }
    });
    res.json(contact);
  } catch (error) {
    console.error('Error updating contact:', error);
    res.status(500).json({ error: 'Failed to update contact' });
  }
};

exports.deleteContact = async (req, res) => {
  try {
    const { id } = req.params;
    await prisma.contact.delete({
      where: { id }
    });
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting contact:', error);
    res.status(500).json({ error: 'Failed to delete contact' });
  }
};
