const express = require('express');
const router = express.Router();
const telegramBotController = require('../controllers/telegramBotController');

router.get('/', telegramBotController.getAllBots);
router.get('/:id', telegramBotController.getBotById);
router.post('/', telegramBotController.createBot);
router.put('/:id', telegramBotController.updateBot);
router.delete('/:id', telegramBotController.deleteBot);

module.exports = router;
