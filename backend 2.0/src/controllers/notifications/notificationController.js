import express from 'express';
import catchAsync from '../../utils/catchAsync.js';
import AppError from '../../utils/AppError.js';
import {
    getNotifications as getNotificationsService
}
from '../../services/notifications/notificationService.js';

export const getNotifications = catchAsync(async (req, res, next) => {

    const user_id = req.user.user_id;


    if (!user_id) {

        return next(
            new AppError(
                'User not authenticated',
                401
            )
        );

    }
    const {
        limit = 20,
        unread_only = false
    } = req.query;
    
    const result =
    await getNotificationsService(
        user_id,
        limit,
        unread_only
    );


    res.json({

        ok: true,

        data: result.notifications,

        unread_count:
        result.unread_count
    });

});

export const markAsRead = catchAsync(async (req, res, next) => {

    const user_id =
    req.user.user_id;
    const { id } = req.params;

    if (!id) {

        throw new AppError(
            'Notification ID required',
            400
        );

    }

    const count =
    await markNotificationAsRead(
        user_id,
        id
    );

    if (count === 0) {

        throw new AppError(
            'Notification not found',
            404
        );

    }

    res.json({

        ok: true,

        message:
        'Marked as read'

    });

});

export const markAllAsRead =
catchAsync(async (req, res, next) => {

    const user_id =
    req.user.user_id;
    if (!user_id) {

        throw new AppError(
            'User not authenticated',
            401
        );

    }

    const count =
    await markAllNotificationsAsRead(
        user_id
    );

    res.json({

        ok: true,

        message:
        'All notifications marked as read',

        updated_count: count
    });
});

