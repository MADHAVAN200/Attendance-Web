import { attendanceDB } from '../../config/database.js';

export const getDashboardStats = async () => {
    const [
        totalOrgsRes,
        totalUsersRes,
        activeSubsRes,
        pendingAlertsRes
    ] = await Promise.all([
        attendanceDB('organizations').count('* as count').first(),
        attendanceDB('users').count('* as count').where('is_deleted', 0),
        attendanceDB('organizations').count('* as count').where('status', 'active'),
        attendanceDB('security_alerts').count('* as count').where('status', 'open')
    ]);

    return {
        totalOrgs: totalOrgsRes.count || 0,
        totalUsers: totalUsersRes.count || 0,
        activeSubscriptions: activeSubsRes.count || 0,
        pendingRequests: pendingAlertsRes.count || 0,
    };
};
