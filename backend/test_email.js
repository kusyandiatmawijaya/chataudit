require('dotenv').config();
const emailService = require('./services/email/email.service');

async function testEmail() {
    console.log('Testing SMTP connection...');
    const isConnected = await emailService.verifyConnection();
    if (!isConnected) {
        console.error('Failed to connect to SMTP server. Check credentials in .env.');
        process.exit(1);
    }

    console.log('Connection successful. Attempting to send test email...');

    // CHANGE THIS to your own email address to receive the test email
    const recipient = 'kusyandi@padmasaripangan.com';

    try {
        const result = await emailService.sendEmail({
            to: recipient,
            subject: 'Test Email - System Verification',
            templateName: 'testEmail',
            templateData: {
                note: 'This email was generated from the test script.'
            }
        });

        console.log('Email sent successfully!', result);
        process.exit(0);
    } catch (error) {
        console.error('Failed to send email:', error.message);
        process.exit(1);
    }
}

testEmail();
