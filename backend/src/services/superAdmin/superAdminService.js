import { attendanceDB } from '../../config/database.js';

export const getDashboardStats = async () => {
    const [
        totalOrgsRes,
        totalUsersRes,
        pendingFeedbackRes,
        openAlertsRes
    ] = await Promise.all([
        attendanceDB('organizations').count('* as count').first(),
        attendanceDB('users').count('* as count').where('is_deleted', 0).first(),
        attendanceDB('feedback')
            .count('* as count')
            .whereIn('status', ['pending', 'open', 'OPEN', 'PENDING', ''])
            .orWhereNull('status')
            .first(),
        attendanceDB('security_alerts')
            .count('* as count')
            .whereIn('status', ['open', 'unseen', 'OPEN', 'UNSEEN'])
            .first()
    ]);

    return {
        totalOrgs: Number(totalOrgsRes?.count) || 0,
        totalUsers: Number(totalUsersRes?.count) || 0,
        pendingFeedback: Number(pendingFeedbackRes?.count) || 0,
        openAlerts: Number(openAlertsRes?.count) || 0,
    };
};
