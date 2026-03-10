import { attendanceDB } from '../../config/database.js';
import { uploadFile, getFileUrl } from '../s3/s3Service.js';
import { sendEmail } from '../auth/emailService.js';

/**
 * Submit new feedback with optional file attachments and email notification.
 */
export async function submitFeedback(user_id, { title, description, type = 'FEEDBACK', files = [] }) {
    // 1. Insert feedback record
    const [feedback_id] = await attendanceDB('feedback').insert({
        user_id,
        type,
        title,
        description,
        status: 'OPEN',
        created_at: attendanceDB.fn.now(),
        updated_at: attendanceDB.fn.now()
    });

    // 2. Upload files and create attachment records
    const attachments = [];
    for (const file of files) {
        const timestamp = Date.now();
        const sanitizedName = file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
        const key = `${feedback_id}_${timestamp}_${sanitizedName}`;

        try {
            const uploadResult = await uploadFile({
                fileBuffer: file.buffer,
                key,
                directory: `feedback/${feedback_id}`,
                contentType: file.mimetype
            });

            await attendanceDB('feedback_attachments').insert({
                feedback_id,
                file_key: uploadResult.key,
                file_name: file.originalname,
                file_type: file.mimetype,
                file_size: file.size
            });

            attachments.push({
                file_name: file.originalname,
                file_size: file.size,
                file_type: file.mimetype
            });
        } catch (error) {
            console.error('Error uploading file in FeedbackService:', error);
        }
    }

    // 3. Send email notification
    try {
        const user = await attendanceDB('users').where('user_id', user_id).first();
        const submittedAt = new Date().toLocaleString('en-US', {
            dateStyle: 'medium',
            timeStyle: 'short'
        });

        const emailHtml = buildFeedbackEmailHtml({ type, title, description, submittedAt, user, user_id, feedback_id, attachments });

        const emailAttachments = files.map(file => ({
            filename: file.originalname,
            content: file.buffer,
            contentType: file.mimetype
        }));

        const adminEmails = process.env.ADMIN_EMAIL.split(',').map(email => email.trim());

        await sendEmail({
            to: adminEmails.join(', '),
            subject: title,
            html: emailHtml,
            attachments: emailAttachments
        });
    } catch (emailError) {
        console.error('Failed to send feedback email notification:', emailError);
    }

    return { feedback_id, attachments_count: attachments.length, attachments };
}

/**
 * Get list of feedback for admin view with attachments and signed URLs.
 */
export async function getFeedbackList({ status, type, limit = 50 } = {}) {
    let query = attendanceDB('feedback')
        .join('users', 'feedback.user_id', 'users.user_id')
        .select('feedback.*', 'users.user_name', 'users.email')
        .orderBy('feedback.created_at', 'desc')
        .limit(Math.min(parseInt(limit), 100));

    if (status) query = query.where('feedback.status', status);
    if (type) query = query.where('feedback.type', type);

    const feedbackRecords = await query;

    return await Promise.all(
        feedbackRecords.map(async (feedback) => {
            const attachments = await attendanceDB('feedback_attachments')
                .where('feedback_id', feedback.feedback_id)
                .select('*');

            const attachmentsWithUrls = await Promise.all(
                attachments.map(async (attachment) => {
                    try {
                        const { url } = await getFileUrl({
                            key: attachment.file_key,
                            expiresIn: 3600
                        });
                        return { ...attachment, url };
                    } catch (error) {
                        console.error('Error generating URL for attachment:', error);
                        return attachment;
                    }
                })
            );

            return { ...feedback, attachments: attachmentsWithUrls };
        })
    );
}

/**
 * Update feedback status.
 */
export async function updateStatus(id, status) {
    const updated = await attendanceDB('feedback')
        .where('feedback_id', id)
        .update({ status, updated_at: attendanceDB.fn.now() });

    return updated > 0;
}

// --- Email Template ---

function buildFeedbackEmailHtml({ type, title, description, submittedAt, user, user_id, feedback_id, attachments }) {
    const typeColor = type === 'BUG' ? '#7c3aed' : '#6366f1';
    const typeBgColor = type === 'BUG' ? '#ede9fe' : '#e0e7ff';

    return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<style>
body { margin:0; padding:0; width:100%!important; background-color:#F2F2F2; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif; }
.wrapper { width:100%; background-color:#F2F2F2; }
.container { width:100%; max-width:600px; margin:0 auto; background-color:#FFFFFF; }
.header { background-color:#2F3A45; padding:26px 20px; text-align:center; }
.header h1 { color:#FFFFFF; margin:0; font-size:22px; font-weight:600; }
.header p { color:#D1D5DB; margin-top:6px; font-size:14px; }
.content { padding:26px 20px; }
.badge { display:inline-block; padding:6px 12px; border-radius:4px; font-size:12px; font-weight:600; background-color:${typeBgColor}; color:${typeColor}; text-transform:uppercase; }
.date { font-size:14px; color:#6B7280; margin-left:12px; }
h2 { color:#1A1A1A; font-size:20px; margin-bottom:16px; }
.description-box, .info-card, .attachments { background-color:#FFFFFF; border:1px solid #D1D5DB; border-radius:6px; padding:16px; }
.label { font-size:12px; font-weight:600; color:#4B5563; text-transform:uppercase; margin-bottom:6px; }
.divider { height:1px; background-color:#D1D5DB; margin:24px 0; }
.info-row { margin-bottom:12px; }
.attachment-item { padding:8px 0; border-bottom:1px solid #D1D5DB; font-size:14px; color:#374151; }
.attachment-item:last-child { border-bottom:none; }
.footer { background-color:#F2F2F2; padding:16px; text-align:center; border-top:1px solid #D1D5DB; }
.footer p { font-size:13px; color:#6B7280; margin:4px 0; }
@media only screen and (max-width:480px) {
  .content { padding:18px 14px; }
  h2 { font-size:18px; }
  .header h1 { font-size:20px; }
  .date { display:block; margin-left:0; margin-top:6px; }
}
</style>
</head>
<body>
<div class="wrapper">
<div class="container">
    <div class="header">
        <h1>New Feedback Received</h1>
        <p>Mano Attendance System</p>
    </div>
    <div class="content">
        <div style="margin-bottom:18px;">
            <span class="badge">${type}</span>
            <span class="date">${submittedAt}</span>
        </div>
        <h2>${title}</h2>
        <div class="description-box">
            <div class="label">Description: ${description.replace(/\n/g, '<br>')}</div>
        </div>
        <div class="divider"></div>
        <div class="info-card">
            <div class="info-row"><div class="label">Submitted By: ${user ? user.user_name : 'Unknown'}</div></div>
            <div class="info-row"><div class="label">Email: ${user ? user.email : 'N/A'}</div></div>
            <div class="info-row"><div class="label">User ID: ${user_id}</div></div>
            <div class="info-row"><div class="label">Feedback ID: ${feedback_id}</div></div>
        </div>
        ${attachments.length > 0 ? `
        <div class="attachments" style="margin-top:22px;">
            <div class="label" style="margin-bottom:10px;">List of Documents Attached</div>
            ${attachments.map(a => `<div class="attachment-item">${a.file_name} — ${(a.file_size / 1024).toFixed(2)} KB</div>`).join('')}
        </div>` : ''}
    </div>
    <div class="footer">
        <p><strong>Mano Attendance System</strong></p>
        <p>This is an automated mail. Please do not reply.</p>
    </div>
</div>
</div>
</body>
</html>`;
}
