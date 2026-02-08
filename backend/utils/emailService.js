import nodemailer from 'nodemailer';

/**
 * Sends an email using Gmail SMTP with credentials from .env
 * @param {Object} options - Email options
 * @param {string} options.to - Recipient email
 * @param {string} options.subject - Email subject
 * @param {string} [options.text] - Plain text body
 * @param {string} [options.html] - HTML body
 * @param {Array} [options.attachments] - Optional attachments
 */
export const sendEmail = async ({ to, subject, text, html, attachments }) => {
    // Trim environment variables to prevent issues with stray whitespace
    const user = process.env.GMAIL_USER?.trim();
    const clientId = process.env.GMAIL_CLIENT_ID?.trim();
    const clientSecret = process.env.GMAIL_CLIENT_SECRET?.trim();
    const refreshToken = process.env.GMAIL_REFRESH_TOKEN?.trim();

    if (!user || !clientId || !clientSecret || !refreshToken) {
        console.error('[EMAIL ERROR] Missing OAuth2 credentials in .env');
        return { ok: false, error: 'Missing email configuration' };
    }

    try {
        const transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                type: 'OAuth2',
                user,
                clientId,
                clientSecret,
                refreshToken,
            }
        });

        const mailOptions = {
            from: `"Mano Attendance System" <${user}>`,
            to,
            subject,
            text,
            html,
            attachments,
        };

        const info = await transporter.sendMail(mailOptions);
        console.log('Email sent successfully: %s', info.messageId);
        return { ok: true, messageId: info.messageId };
    } catch (error) {
        console.error('Error sending email:', error);
        return { ok: false, error: error.message };
    }
};

export default { sendEmail };
