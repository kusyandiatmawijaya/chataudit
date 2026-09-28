const express = require('express');
const router = express.Router();
const { sendEmail } = require('../controllers/email.controller');

// Note: authentication middleware is applied in server.js for this route group
// e.g. app.use('/api/email', authenticateToken, emailRoutes)

// POST /api/email/send
router.post('/send', sendEmail);

module.exports = router;
