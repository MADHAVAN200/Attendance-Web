import express from 'express';
import { knexDB } from '../database.js';
import { authenticateJWT } from '../middleware/auth.js';
import catchAsync from '../utils/catchAsync.js';
import NotificationService from '../services/NotificationService.js';
import { getEventSource } from '../utils/clientInfo.js';
import EventBus from '../utils/EventBus.js';
import multer from 'multer';
import * as S3Service from '../s3/s3Service.js';

// Multer Setup (Memory Storage)
const storage = multer.memoryStorage();
const upload = multer({
    storage,
    limits: { fileSize: 5 * 1024 * 1024, files: 5 }, // 5MB limit, max 5 files
    fileFilter: (req, file, cb) => {
        const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
        if (allowedTypes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('Invalid file type. Only Images and PDFs are allowed.'));
        }
    }
});

const router = express.Router();

// ┌──────────────────────────────────────────────────────────────────────────┐
// │ USER ENDPOINTS                                                           │
// └──────────────────────────────────────────────────────────────────────────┘

// GET /leaves/my-history - Get current user's leave history
router.get('/my-history', authenticateJWT, catchAsync(async (req, res) => {
    const { user_id, org_id } = req.user;

    const leaves = await knexDB('leave_requests')
        .where({ user_id, org_id })
        .orderBy('applied_at', 'desc');

    // Fetch Attachments
    const leaveIds = leaves.map(l => l.lr_id);
    if (leaveIds.length > 0) {
        const attachments = await knexDB('leave_attachments').whereIn('leave_id', leaveIds);

        // Map attachments to leaves with signed URLs
        const attachmentMap = new Map();

        await Promise.all(attachments.map(async (a) => {
            const { url } = await S3Service.getFileUrl({ key: a.file_key });
            const item = { ...a, file_url: url };

            if (!attachmentMap.has(a.leave_id)) {
                attachmentMap.set(a.leave_id, []);
            }
            attachmentMap.get(a.leave_id).push(item);
        }));

        leaves.forEach(leave => {
            leave.attachments = attachmentMap.get(leave.lr_id) || [];
        });
    } else {
        leaves.forEach(l => l.attachments = []);
    }

    res.json({ ok: true, leaves });
}));

// POST /leaves/request - Submit a leave request
router.post('/request', authenticateJWT, upload.array('attachments', 5), catchAsync(async (req, res) => {
    const { user_id, org_id, user_name } = req.user;
    const { leave_type, start_date, end_date, reason } = req.body;

    if (!start_date || !end_date || !leave_type) {
        return res.status(400).json({ ok: false, message: "Missing required fields" });
    }

    // Basic Validation: End date >= Start date
    const start = new Date(start_date);
    const end = new Date(end_date);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
        return res.status(400).json({ ok: false, message: "Invalid date format" });
    }

    if (end < start) {
        return res.status(400).json({ ok: false, message: "End date cannot be before start date" });
    }

    // Format for SQL (YYYY-MM-DD) to avoid quote issues
    const formatSQLDate = (d) => d.toISOString().split('T')[0];
    const sqlStart = formatSQLDate(start);
    const sqlEnd = formatSQLDate(end);

    // Check for overlapping requests (optional but recommended)
    const overlap = await knexDB('leave_requests')
        .where({ user_id, org_id })
        .whereIn('status', ['Pending', 'Approved']) // Changed to Title Case
        .where(builder => {
            builder.whereBetween('start_date', [sqlStart, sqlEnd])
                .orWhereBetween('end_date', [sqlStart, sqlEnd])
                .orWhere(inner => {
                    inner.where('start_date', '<', sqlStart)
                        .andWhere('end_date', '>', sqlEnd);
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
        start_date: sqlStart,
        end_date: sqlEnd,
        reason,
        status: 'Pending',
        applied_at: new Date()
    });

    // Handle Attachments
    if (req.files && req.files.length > 0) {
        const attachmentPromises = req.files.map(async (file) => {
            const timestamp = Date.now();
            const cleanName = file.originalname.replace(/[^a-zA-Z0-9.]/g, '_');
            const key = cleanName; // Use filename directly as requested
            const directory = `leaves/${insertId}`; // Structure: leaves/<leave_id>/<filename>

            const uploadResult = await S3Service.uploadFile({
                fileBuffer: file.buffer,
                key: key,
                directory: directory,
                contentType: file.mimetype
            });

            // Generate signed URL for immediate response
            const { url: signedUrl } = await S3Service.getFileUrl({ key: key, directory: `leaves/${insertId}` });

            return {
                leave_id: insertId,
                file_key: `leaves/${insertId}/${key}`, // Store full key
                file_type: file.mimetype,
                _signedUrl: signedUrl // Temporary for response
            };
        });

        const attachmentsData = await Promise.all(attachmentPromises);

        // Separate DB data from Response data
        const dbInserts = attachmentsData.map(({ _signedUrl, ...rest }) => rest);
        await knexDB('leave_attachments').insert(dbInserts);

        // Response data
        const responseAttachments = attachmentsData.map(a => ({
            file_key: a.file_key,
            file_url: a._signedUrl,
            file_type: a.file_type
        }));

        res.status(201).json({
            ok: true,
            message: "Leave request submitted",
            leave_id: insertId,
            attachments: responseAttachments
        });
    } else {
        res.status(201).json({ ok: true, message: "Leave request submitted", leave_id: insertId, attachments: [] });
    }
}));

// DELETE /leaves/request/:id - Withdraw request (Pending only)
router.delete('/request/:id', authenticateJWT, catchAsync(async (req, res) => {
    const { id } = req.params;
    const { user_id, org_id } = req.user;

    const request = await knexDB('leave_requests').where({ lr_id: id, user_id, org_id }).first();

    if (!request) {
        return res.status(404).json({ ok: false, message: "Request not found" });
    }

    if (request.status !== 'Pending') { // Changed to Title Case
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
        .orderBy('lr.applied_at', 'asc');

    // Attach attachments
    const leaveIds = requests.map(l => l.lr_id);
    if (leaveIds.length > 0) {
        const attachments = await knexDB('leave_attachments').whereIn('leave_id', leaveIds);
        const attachmentMap = new Map();

        await Promise.all(attachments.map(async (a) => {
            const { url } = await S3Service.getFileUrl({ key: a.file_key });
            const item = { ...a, file_url: url };

            if (!attachmentMap.has(a.leave_id)) {
                attachmentMap.set(a.leave_id, []);
            }
            attachmentMap.get(a.leave_id).push(item);
        }));

        requests.forEach(req => {
            req.attachments = attachmentMap.get(req.lr_id) || [];
        });
    }

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

    const history = await query.orderBy('lr.applied_at', 'desc');


    // Attach attachments
    const leaveIds = history.map(l => l.lr_id);
    if (leaveIds.length > 0) {
        const attachments = await knexDB('leave_attachments').whereIn('leave_id', leaveIds);
        const attachmentMap = new Map();

        await Promise.all(attachments.map(async (a) => {
            const { url } = await S3Service.getFileUrl({ key: a.file_key });
            const item = { ...a, file_url: url };

            if (!attachmentMap.has(a.leave_id)) {
                attachmentMap.set(a.leave_id, []);
            }
            attachmentMap.get(a.leave_id).push(item);
        }));

        history.forEach(h => {
            h.attachments = attachmentMap.get(h.lr_id) || [];
        });
    }

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
        return res.status(400).json({ ok: false, message: "Invalid status" });
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
