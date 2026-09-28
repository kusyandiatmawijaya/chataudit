const express = require('express');
const bcrypt = require('bcryptjs');
const { PrismaClient } = require('@prisma/client');
const { authenticateToken, authorizeRole } = require('../middleware/auth');

const router = express.Router();
const prisma = new PrismaClient();

const checkSessionAccess = async (actorId, actorRole, sessionIds) => {
  if (actorRole === 'DEVELOPER') return true;
  if (!sessionIds || sessionIds.length === 0) return true;
  
  const allowedSessions = await prisma.session.findMany({
    where: {
      sessionId: { in: sessionIds },
      users: { some: { id: actorId } }
    },
    select: { sessionId: true }
  });
  
  return allowedSessions.length === sessionIds.length;
};

// Only DEVELOPER and ADMINISTRATOR can manage users
router.use(authenticateToken, authorizeRole('DEVELOPER', 'ADMINISTRATOR'));

// Get all users
router.get('/', async (req, res) => {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        username: true,
        role: true,
        profilePic: true,
        whatsappId: true,
        phoneNumber: true,
        telegramId: true,
        email: true,
        createdAt: true,
        sessions: { select: { sessionId: true, name: true } }
      },
      orderBy: { createdAt: 'desc' }
    });
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// Create new user
router.post('/', async (req, res) => {
  try {
    const { username, password, role, sessionIds = [], whatsappId, phoneNumber, telegramId, email } = req.body;
    
    if (!username || !password || !role) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Only DEVELOPER can create another DEVELOPER
    if (role === 'DEVELOPER' && req.user.role !== 'DEVELOPER') {
      return res.status(403).json({ error: 'Only developers can create other developers' });
    }

    const hasAccess = await checkSessionAccess(req.user.id, req.user.role, sessionIds);
    if (!hasAccess) {
      return res.status(403).json({ error: 'You do not have access to assign some of the selected devices' });
    }

    const existingUser = await prisma.user.findUnique({ where: { username } });
    if (existingUser) {
      return res.status(400).json({ error: 'Username already exists' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
      data: {
        username,
        password: hashedPassword,
        role,
        whatsappId: whatsappId || null,
        phoneNumber: phoneNumber || null,
        telegramId: telegramId || null,
        email: email || null,
        sessions: {
          connect: sessionIds.map(sid => ({ sessionId: sid }))
        }
      },
      select: { id: true, username: true, role: true, whatsappId: true, phoneNumber: true, telegramId: true, email: true, sessions: true }
    });
    
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: 'Failed to create user' });
  }
});

// Update user (role and/or password)
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { password, role, sessionIds, whatsappId, phoneNumber, telegramId, email } = req.body;
    
    const userToUpdate = await prisma.user.findUnique({ where: { id } });
    if (!userToUpdate) return res.status(404).json({ error: 'User not found' });

    // Protect DEVELOPER accounts from being modified by ADMINISTRATORS
    if (userToUpdate.role === 'DEVELOPER' && req.user.role !== 'DEVELOPER') {
       return res.status(403).json({ error: 'Cannot modify developer accounts' });
    }
    
    // Protect modifying to DEVELOPER role
    if (role === 'DEVELOPER' && req.user.role !== 'DEVELOPER') {
       return res.status(403).json({ error: 'Cannot assign developer role' });
    }

    const updateData = {};
    if (role) updateData.role = role;
    if (password) {
      updateData.password = await bcrypt.hash(password, 10);
    }
    if (whatsappId !== undefined) updateData.whatsappId = whatsappId || null;
    if (phoneNumber !== undefined) updateData.phoneNumber = phoneNumber || null;
    if (telegramId !== undefined) updateData.telegramId = telegramId || null;
    if (email !== undefined) updateData.email = email || null;
    
    if (Array.isArray(sessionIds)) {
      const hasAccess = await checkSessionAccess(req.user.id, req.user.role, sessionIds);
      if (!hasAccess) {
        return res.status(403).json({ error: 'You do not have access to assign some of the selected devices' });
      }
      updateData.sessions = {
        set: sessionIds.map(sid => ({ sessionId: sid }))
      };
    }

    const user = await prisma.user.update({
      where: { id },
      data: updateData,
      select: { id: true, username: true, role: true, whatsappId: true, phoneNumber: true, telegramId: true, email: true, sessions: true }
    });
    
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update user' });
  }
});

// Delete user
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    if (id === req.user.id) {
      return res.status(400).json({ error: 'Cannot delete yourself' });
    }

    const userToDelete = await prisma.user.findUnique({ where: { id } });
    if (!userToDelete) return res.status(404).json({ error: 'User not found' });

    // Protect DEVELOPER accounts
    if (userToDelete.role === 'DEVELOPER' && req.user.role !== 'DEVELOPER') {
       return res.status(403).json({ error: 'Cannot delete developer accounts' });
    }

    await prisma.user.delete({ where: { id } });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete user' });
  }
});

module.exports = router;
