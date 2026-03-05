import catchAsync from '../../utils/catchAsync.js';
import * as NotificationService from '../../services/notifications/notificationService.js';
import * as LeaveService from '../../services/leaves/leaveService.js';

export const getMyHistory = catchAsync(async (req, res) => {
    const { user_id, org_id } = req.user;
    const leaves = await LeaveService.getMyHistory({ user_id, org_id });
    res.json({ ok: true, leaves });
});

export const submitLeaveRequest = catchAsync(async (req, res) => {
    const { user_id, org_id } = req.user;
    const { leave_type, start_date, end_date, reason } = req.body;

    if (!start_date || !end_date || !leave_type) {
        return res.status(400).json({ ok: false, message: "Missing required fields" });
    }

    try {
        const { insertId, responseAttachments } = await LeaveService.submitLeaveRequest({
            user_id,
            org_id,
            leave_type,
            start_date,
            end_date,
            reason,
            files: req.files
        });

        res.status(201).json({
            ok: true,
            message: "Leave request submitted",
            leave_id: insertId,
            attachments: responseAttachments
        });
    } catch (err) {
        if (err.status) return res.status(err.status).json({ ok: false, message: err.message });
        throw err;
    }
});

export const withdrawLeaveRequest = catchAsync(async (req, res) => {
    const { id } = req.params;
    const { user_id, org_id } = req.user;

    try {
        await LeaveService.withdrawLeaveRequest({ id, user_id, org_id });
        res.json({ ok: true, message: "Request withdrawn" });
    } catch (err) {
        if (err.status) return res.status(err.status).json({ ok: false, message: err.message });
        throw err;
    }
});

export const getPendingRequests = catchAsync(async (req, res) => {
    if (req.user.user_type !== 'admin' && req.user.user_type !== 'hr') {
        return res.status(403).json({ ok: false, message: "Access denied" });
    }

    const requests = await LeaveService.getPendingRequests({ org_id: req.user.org_id });
    res.json({ ok: true, requests });
});

export const getAdminHistory = catchAsync(async (req, res) => {
    if (req.user.user_type !== 'admin' && req.user.user_type !== 'hr') {
        return res.status(403).json({ ok: false, message: "Access denied" });
    }

    const { user_id, status, start_date, end_date } = req.query;
    const history = await LeaveService.getAdminHistory({
        org_id: req.user.org_id,
        user_id,
        status,
        start_date,
        end_date
    });

    res.json({ ok: true, history });
});

export const updateLeaveStatus = catchAsync(async (req, res) => {
    if (req.user.user_type !== 'admin' && req.user.user_type !== 'hr') {
        return res.status(403).json({ ok: false, message: "Access denied" });
    }

    const { id } = req.params;
    const { status, pay_type, pay_percentage, admin_comment } = req.body;

    try {
        const request = await LeaveService.updateLeaveStatus({
            id,
            org_id: req.user.org_id,
            status,
            pay_type,
            pay_percentage,
            admin_comment,
            reviewed_by: req.user.user_id
        });

        if (request) {
            // TODO: Implement notification handling
            // NotificationService.handleNotification({...});
        }

        res.json({ ok: true, message: `Request ${status}` });
    } catch (err) {
        if (err.status) return res.status(err.status).json({ ok: false, message: err.message });
        throw err;
    }
});