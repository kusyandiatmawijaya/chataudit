const nodemailer = require('nodemailer');
const logger = require('pino')();
const { templates } = require('./email.template');

class EmailService {
    constructor() {
        this.transporter = null;
        this.isInitialized = false;
    }

    init() {
        if (this.isInitialized) return;

        try {
            // Setup Nodemailer transporter reusing the connection
            this.transporter = nodemailer.createTransport({
                host: process.env.SMTP_HOST,
                port: Number(process.env.SMTP_PORT),
                secure: process.env.SMTP_SECURE === 'true',
                auth: {
                    user: process.env.SMTP_USER,
                    pass: process.env.SMTP_PASSWORD
                },
                pool: true, // Use pooled connection for efficiency
                maxConnections: 5,
                maxMessages: 100
            });
            this.isInitialized = true;
            logger.info('Email service transporter initialized.');
        } catch (error) {
            logger.error({ err: error.message }, 'Failed to initialize email transporter');
            throw new Error('EMAIL_CONFIGURATION_ERROR');
        }
    }

    async verifyConnection() {
        if (!this.isInitialized) this.init();
        try {
            await this.transporter.verify();
            logger.info('SMTP connection verified successfully.');
            return true;
        } catch (error) {
            logger.error({ err: error.message }, 'SMTP connection verification failed.');
            return false;
        }
    }

    /**
     * Send an email.
     * @param {Object} options 
     * @param {string} options.to Recipient email address
     * @param {string} options.subject Email subject
     * @param {string} [options.html] HTML body of the email
     * @param {string} [options.text] Plain text body of the email
     * @param {Array} [options.attachments] Optional array of attachments
     * @param {string} [options.templateName] Optional template name to use instead of raw HTML
     * @param {Object} [options.templateData] Data to pass to the template
     */
    async sendEmail(options) {
        if (!this.isInitialized) this.init();

        const { to, subject, html, text, attachments, templateName, templateData } = options;

        if (!to) throw new Error('INVALID_RECIPIENT');
        if (!subject) throw new Error('MISSING_SUBJECT');
        
        let finalHtml = html;
        if (templateName && templates[templateName]) {
            finalHtml = templates[templateName](templateData || {});
        }

        if (!finalHtml && !text) {
            throw new Error('MISSING_CONTENT');
        }

        // Hardcode the sender to prevent spoofing from frontend
        const defaultFrom = `"Padma Sari Pangan" <${process.env.SMTP_USER}>`;

        const mailOptions = {
            from: defaultFrom,
            to,
            subject,
            html: finalHtml,
            text,
            attachments
        };

        const startTime = Date.now();

        try {
            const info = await this.transporter.sendMail(mailOptions);
            const duration = Date.now() - startTime;
            
            logger.info({
                event: 'email_sent',
                recipient: to,
                subject: subject,
                messageId: info.messageId,
                duration: `${duration}ms`
            }, 'Email sent successfully');

            return {
                success: true,
                messageId: info.messageId
            };
        } catch (error) {
            const duration = Date.now() - startTime;
            
            logger.error({
                event: 'email_send_error',
                recipient: to,
                subject: subject,
                err: error.message,
                code: error.code,
                command: error.command,
                duration: `${duration}ms`
            }, 'Failed to send email');

            // Categorize errors for internal tracking, but do not leak details
            let errorCategory = 'EMAIL_SEND_ERROR';
            if (error.code === 'EAUTH') errorCategory = 'SMTP_AUTH_ERROR';
            if (error.code === 'ECONNECTION') errorCategory = 'SMTP_CONNECTION_ERROR';

            throw new Error(errorCategory);
        }
    }
}

// Export as a singleton
module.exports = new EmailService();
