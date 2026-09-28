const express = require('express');
const router = express.Router();
const syncController = require('../controllers/syncController');

// Get all sync settings
router.get('/settings', syncController.getSettings);

// Save or update sync settings
router.post('/settings', syncController.saveSettings);

// Delete a sync setting
router.delete('/settings/:id', syncController.deleteSetting);

// Get sync logs
router.get('/logs', syncController.getLogs);

// Run manual sync for a specific module
router.post('/run', syncController.runSync);

// SSE Endpoint for progress bar
router.get('/progress', syncController.streamProgress);

// Inbound Push Webhook: External ERP pushes data directly
router.post('/push/:module', syncController.receivePush);

module.exports = router;
