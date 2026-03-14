import { attendanceDB } from '../../config/database.js';
import catchAsync from '../../utils/catchAsync.js';
import AppError from '../../utils/AppError.js';


export const getNotifications = async (
    user_id,
    limit,
    unread_only
) => {
    let query = attendanceDB('notifications')
        .where({ user_id })
        .orderBy('created_at', 'desc')
        .limit(Math.min(parseInt(limit), 50));

    if (unread_only === 'true') {

        query = query.where({ is_read: 0 });
    }

    const notifications = await query;
    const unreadResult = await attendanceDB('notifications')
        .where({
            user_id,
            is_read: 0
        })
        .count('notification_id as count')
        .first();

    return {

        notifications,

        unread_count:
            unreadResult?.count || 0

    };

};

export const markNotificationAsRead = async (
    user_id,
    notification_id
) => {
    const count = await attendanceDB('notifications')
        .where({
            notification_id,
            user_id
        })
        .update({
            is_read: 1
        });
    return count;
};

export const markAllNotificationsAsRead = async (user_id) => {

    const count = await attendanceDB('notifications')
        .where({
            user_id,
            is_read: 0
        })
        .update({
            is_read: 1
        });


    return count;

};

