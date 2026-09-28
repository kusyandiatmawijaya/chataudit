const emailService = require('../services/email/email.service');
const pino = require('pino');
const logger = pino({ level: process.env.LOG_LEVEL || 'info' });

/**
 * Controller to handle sending emails via the API.
 */
const sendEmail = async (req, res) => {
    try {
        const { to, subject, html, text, templateName, templateData, attachments } = req.body;

        // Basic validations
        if (!to) {
            return res.status(400).json({ success: false, message: 'Recipient (to) is required.' });
        }
        
        // Simple email regex validation
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(to)) {
            return res.status(400).json({ success: false, message: 'Invalid recipient email format.' });
        }

        if (!subject) {
            return res.status(400).json({ success: false, message: 'Subject is required.' });
        }

        if (!html && !text && !templateName) {
            return res.status(400).json({ success: false, message: 'Body content (html, text, or templateName) is required.' });
        }

        // Validate payload size (e.g. limiting attachments if necessary, can also be done via middleware)

        await emailService.sendEmail({
            to,
            subject,
            html,
            text,
            templateName,
            templateData,
            attachments
        });

        res.status(200).json({
            success: true,
            message: 'Email berhasil dikirim'
        });

    } catch (error) {
        // Log the actual error internally but send a safe message to the client
        logger.error({ err: error.message }, 'Error in email controller');

        // Provide a generic, safe response to the frontend
        res.status(500).json({
            success: false,
            message: 'Email gagal dikirim. Silakan coba lagi.'
        });
    }
};

module.exports = {
    sendEmail
};
