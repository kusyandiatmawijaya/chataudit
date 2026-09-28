const express = require('express');
const router = express.Router();
const broadcastController = require('../controllers/broadcastController');

router.get('/', broadcastController.getBroadcasts);
router.get('/:id', broadcastController.getBroadcastById);
router.post('/', broadcastController.createBroadcast);
router.delete('/:id', broadcastController.deleteBroadcast);
router.post('/recipients/:recipientId/resend', broadcastController.resendMessage);

module.exports = router;
