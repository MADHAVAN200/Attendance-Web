import express from 'express';
import { knexDB } from '../database.js';
import { authenticateJWT } from '../middleware/auth.js';
import catchAsync from '../utils/catchAsync.js';

const router = express.Router();

// GET /notifications - Get user notifications
router.get('/', authenticateJWT, catchAsync(async (req, res) => {
    const user_id = req.user.user_id;
    const { limit = 20, unread_only = false } = req.query;

    let query = knexDB('notifications')
        .where({ user_id })
        .orderBy('created_at', 'desc')
        .limit(Math.min(parseInt(limit), 50));

    if (unread_only === 'true') {
        query = query.where({ is_read: 0 });
    }

    const notifications = await query;
    const unreadCount = await knexDB('notifications').where({ user_id, is_read: 0 }).count('notification_id as count').first();

    res.json({
        ok: true,
        data: notifications,
        unread_count: unreadCount.count
    });
}));

// PUT /notifications/:id/read - Mark as read
router.put('/:id/read', authenticateJWT, catchAsync(async (req, res) => {
    const user_id = req.user.user_id;
    const { id } = req.params;

    await knexDB('notifications')
        .where({ notification_id: id, user_id })
        .update({ is_read: 1 });

    res.json({ ok: true, message: 'Marked as read' });
}));

// PUT /notifications/read-all - Mark all as read
router.put('/read-all', authenticateJWT, catchAsync(async (req, res) => {
    const user_id = req.user.user_id;

    await knexDB('notifications')
        .where({ user_id, is_read: 0 })
        .update({ is_read: 1 });

    res.json({ ok: true, message: 'All notifications marked as read' });
}));

export default router;

