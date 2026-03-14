import catchAsync from '../../utils/catchAsync.js';
import * as DarRequestService from '../../services/darServices/requestsServices.js';
import { getOrgBuffer, validateActivityTime } from '../../services/darServices/activitiesServices.js';

export const createRequest = catchAsync(async (req, res) => {
    const { request_date, original_data, proposed_data, reason } = req.body;
    const { user_id, org_id } = req.user;

    if (!request_date || !proposed_data) {
        return res.status(400).json({ ok: false, message: "Missing required fields" });
    }

    const buffer = await getOrgBuffer(org_id);
    const tasks = Array.isArray(proposed_data) ? proposed_data : [];

    for (const task of tasks) {
        const sTime = task.start_time || task.startTime;
        const eTime = task.end_time || task.endTime;

        if (!sTime || !eTime) continue;

        const check = await validateActivityTime(user_id, request_date, sTime, eTime, buffer);
        if (!check.valid) {
            return res.status(400).json({ ok: false, message: `Invalid Task "${task.title}": ${check.message}` });
        }
    }

    const { request_id, isUpdate } = await DarRequestService.upsertRequest({
        org_id, user_id, request_date, original_data, proposed_data, reason
    });

    res.json({
        ok: true,
        message: isUpdate ? "Request updated successfully" : "Request submitted successfully",
        request_id
    });
});

export const listRequests = catchAsync(async (req, res) => {
    const { org_id } = req.user;
    const data = await DarRequestService.getPendingRequests({ org_id });
    res.json({ ok: true, data });
});

export const approveRequest = catchAsync(async (req, res) => {
    const { id } = req.params;
    const { org_id } = req.user;

    try {
        await DarRequestService.approveRequest({ id, org_id });
        res.json({ ok: true, message: "Request approved and changes applied." });
    } catch (err) {
        if (err.status) return res.status(err.status).json({ ok: false, message: err.message });
        throw err;
    }
});

export const rejectRequest = catchAsync(async (req, res) => {
    const { id } = req.params;
    const { org_id } = req.user;
    const { comment } = req.body;

    try {
        await DarRequestService.rejectRequest({ id, org_id, comment });
        res.json({ ok: true, message: "Request rejected." });
    } catch (err) {
        if (err.status) return res.status(err.status).json({ ok: false, message: err.message });
        throw err;
    }
});