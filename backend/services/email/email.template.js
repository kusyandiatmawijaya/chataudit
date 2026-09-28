/**
 * Email templates definitions.
 * Provides basic html structure for various types of emails.
 */

const baseTemplate = (content) => `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Padma Sari Pangan</title>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { padding: 20px; max-width: 600px; margin: 0 auto; border: 1px solid #ddd; }
        .header { background: #f4f4f4; padding: 10px 20px; text-align: center; border-bottom: 1px solid #ddd; }
        .content { padding: 20px; }
        .footer { text-align: center; font-size: 12px; color: #888; margin-top: 20px; border-top: 1px solid #ddd; padding-top: 10px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h2>Padma Sari Pangan</h2>
        </div>
        <div class="content">
            ${content}
        </div>
        <div class="footer">
            <p>&copy; ${new Date().getFullYear()} Padma Sari Pangan. All rights reserved.</p>
        </div>
    </div>
</body>
</html>
`;

const templates = {
    testEmail: (data) => {
        const content = `
            <p>Email berhasil dikirim dari aplikasi.</p>
            <p>Ini adalah email percobaan.</p>
            <hr/>
            <p><strong>Note:</strong> ${data?.note || 'Tidak ada catatan tambahan.'}</p>
        `;
        return baseTemplate(content);
    },
    // Future templates can be added here:
    // invoice: (data) => { ... },
    // orderConfirmation: (data) => { ... },
    // passwordReset: (data) => { ... },
};

module.exports = {
    templates,
    baseTemplate
};
