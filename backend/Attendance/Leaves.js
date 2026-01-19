import express from 'express';
import { knexDB } from '../database.js';
import { authenticateJWT } from '../AuthAPI/LoginAPI.js';
import catchAsync from '../utils/catchAsync.js';
import NotificationService from '../services/NotificationService.js';
import { getEventSource } from '../utils/clientInfo.js';
import EventBus from '../utils/EventBus.js';

const router = express.Router();

// ┌──────────────────────────────────────────────────────────────────────────┐
// │ USER ENDPOINTS                                                           │
// └──────────────────────────────────────────────────────────────────────────┘

// GET /leaves/my-history - Get current user's leave history
router.get('/my-history', authenticateJWT, catchAsync(async (req, res) => {
    const { user_id, org_id } = req.user;

    const leaves = await knexDB('leave_requests')
        .where({ user_id, org_id })
        .orderBy('start_date', 'desc');

    res.json({ ok: true, leaves });
}));

// POST /leaves/request - Submit a leave request
router.post('/request', authenticateJWT, catchAsync(async (req, res) => {
    const { user_id, org_id, user_name } = req.user;
    const { leave_type, start_date, end_date, reason } = req.body;

    if (!start_date || !end_date || !leave_type) {
        return res.status(400).json({ ok: false, message: "Missing required fields" });
    }

    // Basic Validation: End date >= Start date
    if (new Date(end_date) < new Date(start_date)) {
        return res.status(400).json({ ok: false, message: "End date cannot be before start date" });
    }

    // Check for overlapping requests (optional but recommended)
    const overlap = await knexDB('leave_requests')
        .where({ user_id, org_id })
        .whereIn('status', ['Pending', 'Approved'])
        .where(builder => {
            builder.whereBetween('start_date', [start_date, end_date])
                .orWhereBetween('end_date', [start_date, end_date])
                .orWhere(inner => {
                    inner.where('start_date', '<', start_date)
                        .andWhere('end_date', '>', end_date);
                });
        })
        .first();

    if (overlap) {
        return res.status(400).json({ ok: false, message: "Use has an overlapping leave request." });
    }

    const [insertId] = await knexDB('leave_requests').insert({
        user_id,
        org_id,
        leave_type,
        start_date,
        end_date,
        reason,
        status: 'Pending'
    });

    // Notify Admins
    // We might need to find admins. For now, we log the event.
    // In a real app, we'd fetch admin IDs and send notifications.
    try {
        EventBus.emitActivityLog({
            user_id, org_id,
            event_type: 'LEAVE_REQUEST',
            event_source: getEventSource(req),
            object_type: 'LEAVE',
            object_id: insertId,
            description: `${user_name} requested ${leave_type} leave from ${start_date} to ${end_date}`,
            request_ip: req.ip,
            user_agent: req.get('User-Agent')
        });

        // Notify Admins (Future: Broadcast to 'admin' room via socket)
        // NotificationService.sendToRole('admin', ...); 
    } catch (e) { console.error("Log error", e); }

    res.status(201).json({ ok: true, message: "Leave request submitted", leave_id: insertId });
}));

// DELETE /leaves/request/:id - Withdraw request (Pending only)
router.delete('/request/:id', authenticateJWT, catchAsync(async (req, res) => {
    const { id } = req.params;
    const { user_id, org_id } = req.user;

    const request = await knexDB('leave_requests').where({ lr_id: id, user_id, org_id }).first();

    if (!request) {
        return res.status(404).json({ ok: false, message: "Request not found" });
    }

    if (request.status !== 'Pending') {
        return res.status(400).json({ ok: false, message: "Cannot withdraw processed request" });
    }

    await knexDB('leave_requests').where({ lr_id: id }).del();

    res.json({ ok: true, message: "Request withdrawn" });
}));


// ┌──────────────────────────────────────────────────────────────────────────┐
// │ ADMIN ENDPOINTS                                                          │
// └──────────────────────────────────────────────────────────────────────────┘

// GET /leaves/admin/pending - Get pending requests
router.get('/admin/pending', authenticateJWT, catchAsync(async (req, res) => {
    if (req.user.user_type !== 'admin' && req.user.user_type !== 'hr') {
        return res.status(403).json({ ok: false, message: "Access denied" });
    }

    const requests = await knexDB('leave_requests as lr')
        .join('users as u', 'lr.user_id', 'u.user_id')
        .select(
            'lr.*',
            'u.user_name',
            'u.email',
            'u.phone_no'
        )
        .where('lr.org_id', req.user.org_id)
        .where('lr.status', 'Pending')
        .orderBy('lr.start_date', 'asc');

    res.json({ ok: true, requests });
}));

// GET /leaves/admin/history - Get all requests (filtered)
router.get('/admin/history', authenticateJWT, catchAsync(async (req, res) => {
    if (req.user.user_type !== 'admin' && req.user.user_type !== 'hr') {
        return res.status(403).json({ ok: false, message: "Access denied" });
    }

    const { user_id, status, start_date, end_date } = req.query;

    let query = knexDB('leave_requests as lr')
        .join('users as u', 'lr.user_id', 'u.user_id')
        .select('lr.*', 'u.user_name')
        .where('lr.org_id', req.user.org_id);

    if (user_id) query = query.where('lr.user_id', user_id);
    if (status) query = query.where('lr.status', status);
    if (start_date) query = query.where('lr.start_date', '>=', start_date);
    if (end_date) query = query.where('lr.end_date', '<=', end_date);

    const history = await query.orderBy('lr.start_date', 'desc');
    res.json({ ok: true, history });
}));

// PUT /leaves/admin/status/:id - Approve/Reject/Update Status
router.put('/admin/status/:id', authenticateJWT, catchAsync(async (req, res) => {
    if (req.user.user_type !== 'admin' && req.user.user_type !== 'hr') {
        return res.status(403).json({ ok: false, message: "Access denied" });
    }

    const { id } = req.params;
    const { status, pay_type, pay_percentage, admin_comment } = req.body;

    if (!['Approved', 'Rejected'].includes(status)) {
        return res.status(400).json({ ok: false, message: "Invalid 5" });
    }

    if (status === 'Approved' && !pay_type) {
        return res.status(400).json({ ok: false, message: "Payment type required for approval (Paid, Unpaid, or Partial)" });
    }

    const updateData = {
        status,
        admin_comment,
        reviewed_by: req.user.user_id,
        reviewed_at: new Date()
    };

    if (status === 'Approved') {
        updateData.pay_type = pay_type;
        updateData.pay_percentage = pay_type === 'Partial' ? (pay_percentage || 50) : (pay_type === 'Paid' ? 100 : 0);
    }

    const affected = await knexDB('leave_requests')
        .where({ lr_id: id, org_id: req.user.org_id })
        .update(updateData);

    if (affected === 0) {
        return res.status(404).json({ ok: false, message: "Request not found" });
    }

    // Fetch user for notification
    const request = await knexDB('leave_requests').where({ lr_id: id }).first();
    if (request) {
        NotificationService.handleNotification({
            org_id: req.user.org_id,
            user_id: request.user_id,
            type: status === 'Approved' ? 'SUCCESS' : 'ERROR',
            title: `Leave Request ${status}`,
            message: `Your leave request from ${new Date(request.start_date).toLocaleDateString()} has been ${status.toLowerCase()}.`,
            related_entity_type: 'LEAVE',
            related_entity_id: id
        });
    }

    res.json({ ok: true, message: `Request ${status}` });
}));

export default router;
