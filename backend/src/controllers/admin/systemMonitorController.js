import { attendanceDB } from '../../config/database.js';
import AppError from '../../utils/AppError.js';
import { getFileUrl } from '../../services/s3/s3Service.js';

// --- Security Alerts ---
export const getSecurityAlerts = async (req, res, next) => {
    try {
        const alerts = await attendanceDB('security_alerts')
            .leftJoin('users', 'security_alerts.user_id', 'users.user_id')
            .leftJoin('organizations', 'security_alerts.org_id', 'organizations.org_id')
            .select(
                'security_alerts.*',
                'users.user_name', 'users.email',
                'organizations.org_name'
            )
            .orderBy('security_alerts.created_at', 'desc');

        res.status(200).json({ status: 'success', data: alerts });
    } catch (error) {
        next(error);
    }
};

export const updateSecurityAlertStatus = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { status } = req.body; // 'open', 'resolved'

        if (!['open', 'resolved'].includes(status)) {
            throw new AppError("Status must be 'open' or 'resolved'", 400);
        }

        const affected = await attendanceDB('security_alerts')
            .where({ id })
            .update({ status });

        if (affected === 0) throw new AppError("Security alert not found", 404);

        res.status(200).json({ status: 'success', message: 'Alert status updated successfully' });
    } catch (error) {
        next(error);
    }
};

// --- User Feedback ---
export const getUserFeedback = async (req, res, next) => {
    try {
        const feedback = await attendanceDB('feedback')
            .leftJoin('users', 'feedback.user_id', 'users.user_id')
            .leftJoin('organizations', 'users.org_id', 'organizations.org_id')
            .select(
                'feedback.*',
                'users.user_name', 'users.email',
                'organizations.org_name', 'organizations.org_id'
            )
            .orderBy('feedback.created_at', 'desc');

        // Fetch attachments for all feedback
        const feedbackIds = feedback.map(f => f.feedback_id);
        let attachments = [];
        if (feedbackIds.length > 0) {
            attachments = await attendanceDB('feedback_attachments')
                .whereIn('feedback_id', feedbackIds)
                .select('attachment_id', 'feedback_id', 'file_name', 'file_key', 'file_type');
        }

        // Generate map of attachments
        const feedbackAttachmentsMap = {};
        for (const attachment of attachments) {
            if (!feedbackAttachmentsMap[attachment.feedback_id]) {
                feedbackAttachmentsMap[attachment.feedback_id] = [];
            }
            let url = null;
            try {
                if (attachment.file_key) {
                    const res = await getFileUrl({ key: attachment.file_key });
                    if (res.success) url = res.url;
                }
            } catch (err) { }

            feedbackAttachmentsMap[attachment.feedback_id].push({
                ...attachment,
                url
            });
        }

        // Stitch attachments
        const feedbackWithAttachments = feedback.map(f => ({
            ...f,
            attachments: feedbackAttachmentsMap[f.feedback_id] || []
        }));

        res.status(200).json({ status: 'success', data: feedbackWithAttachments });
    } catch (error) {
        next(error);
    }
};

export const updateFeedbackStatus = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { status } = req.body; // 'pending', 'reviewed', 'resolved'

        if (!['pending', 'reviewed', 'resolved'].includes(status)) {
            throw new AppError("Invalid feedback status", 400);
        }

        const affected = await attendanceDB('feedback')
            .where({ feedback_id: id })
            .update({ status, updated_at: attendanceDB.fn.now() });

        if (affected === 0) throw new AppError("Feedback not found", 404);

        res.status(200).json({ status: 'success', message: 'Feedback status updated successfully' });
    } catch (error) {
        next(error);
    }
};

// --- System Logs ---
export const getErrorLogs = async (req, res, next) => {
    try {
        const logs = await attendanceDB('application_error_logs')
            .leftJoin('users', 'application_error_logs.user_id', 'users.user_id')
            .leftJoin('organizations', 'application_error_logs.org_id', 'organizations.org_id')
            .select(
                'application_error_logs.*',
                'users.user_name', 'users.email',
                'organizations.org_name'
            )
            .orderBy('application_error_logs.occurred_at', 'desc')
            .limit(1000); // Prevent massive payloads

        res.status(200).json({ status: 'success', data: logs });
    } catch (error) {
        next(error);
    }
};

export const getActivityLogs = async (req, res, next) => {
    try {
        const logs = await attendanceDB('user_activity_logs')
            .leftJoin('users', 'user_activity_logs.user_id', 'users.user_id')
            .leftJoin('organizations', 'user_activity_logs.org_id', 'organizations.org_id')
            .select(
                'user_activity_logs.*',
                'users.user_name', 'users.email',
                'organizations.org_name'
            )
            .orderBy('user_activity_logs.occurred_at', 'desc')
            .limit(1000);

        res.status(200).json({ status: 'success', data: logs });
    } catch (error) {
        next(error);
    }
};
