const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { initTelegramBot } = require('../telegram'); // to restart/re-init if needed
// Actually initTelegramBot is an async function that loops all bots.
// Wait, calling initTelegramBot again might start duplicate polling for existing bots.
// It's safer to just require PM2 restart or provide a restart endpoint that cleans up first.
// For now, let's just do CRUD.

exports.getAllBots = async (req, res) => {
    try {
        const bots = await prisma.telegramBot.findMany({
            orderBy: { createdAt: 'desc' }
        });
        res.json(bots);
    } catch (error) {
        console.error('Error fetching bots:', error);
        res.status(500).json({ error: 'Failed to fetch bots' });
    }
};

exports.getBotById = async (req, res) => {
    try {
        const { id } = req.params;
        const bot = await prisma.telegramBot.findUnique({ where: { id } });
        if (!bot) return res.status(404).json({ error: 'Bot not found' });
        res.json(bot);
    } catch (error) {
        console.error('Error fetching bot:', error);
        res.status(500).json({ error: 'Failed to fetch bot' });
    }
};

exports.createBot = async (req, res) => {
    try {
        const { token, name, type, isActive } = req.body;
        const bot = await prisma.telegramBot.create({
            data: { token, name, type, isActive }
        });
        res.status(201).json(bot);
    } catch (error) {
        console.error('Error creating bot:', error);
        res.status(500).json({ error: 'Failed to create bot' });
    }
};

exports.updateBot = async (req, res) => {
    try {
        const { id } = req.params;
        const { token, name, type, isActive } = req.body;
        const bot = await prisma.telegramBot.update({
            where: { id },
            data: { token, name, type, isActive }
        });
        res.json(bot);
    } catch (error) {
        console.error('Error updating bot:', error);
        res.status(500).json({ error: 'Failed to update bot' });
    }
};

exports.deleteBot = async (req, res) => {
    try {
        const { id } = req.params;
        const sessionId = `telegram-${id}`;
        
        await prisma.telegramBot.delete({ where: { id } });
        
        // Cleanup session
        try {
            await prisma.session.delete({ where: { sessionId } });
        } catch (err) {
            // ignore if session doesn't exist
        }
        
        res.json({ message: 'Bot deleted successfully' });
    } catch (error) {
        console.error('Error deleting bot:', error);
        res.status(500).json({ error: 'Failed to delete bot' });
    }
};
