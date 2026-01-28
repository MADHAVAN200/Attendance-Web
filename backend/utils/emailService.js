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
    try {
        const transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                type: 'OAuth2',
                user: process.env.GMAIL_USER,
                clientId: process.env.GMAIL_CLIENT_ID,
                clientSecret: process.env.GMAIL_CLIENT_SECRET,
                refreshToken: process.env.GMAIL_REFRESH_TOKEN,
            },
        });

        const mailOptions = {
            from: `"Mano Attendance System" <${process.env.GMAIL_USER}>`,
            to,
            subject,
            text,
            html,
            attachments,
        };

        const info = await transporter.sendMail(mailOptions);
        console.log('Email sent: %s', info.messageId);
        return { ok: true, messageId: info.messageId };
    } catch (error) {
        console.error('Error sending email:', error);
        return { ok: false, error: error.message };
    }
};

export default { sendEmail };
