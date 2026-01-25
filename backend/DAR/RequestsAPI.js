import express from 'express';
import { knexDB } from '../database.js';
import { authenticateJWT } from '../AuthAPI/LoginAPI.js';
import catchAsync from "../utils/catchAsync.js";

import { getOrgBuffer, validateActivityTime } from './ActivitiesAPI.js'; // Import Helpers

const router = express.Router();

// POST /dar/requests/create
// User submits a request to change past data
router.post('/create', authenticateJWT, catchAsync(async (req, res) => {
    const { request_date, original_data, proposed_data } = req.body;
    const { user_id, org_id } = req.user;

    // Basic Validation
    if (!request_date || !proposed_data) {
        return res.status(400).json({ ok: false, message: "Missing required fields" });
    }

    // --- LOGICAL VALIDATION START (Attendance Check) ---
    const buffer = await getOrgBuffer(org_id);
    const tasks = Array.isArray(proposed_data) ? proposed_data : [];

    for (const task of tasks) {
        const sTime = task.start_time || task.startTime;
        const eTime = task.end_time || task.endTime;

        if (!sTime || !eTime) continue;

        // Validate strictly (Execution Mode logic applies since date is past)
        const check = await validateActivityTime(user_id, request_date, sTime, eTime, buffer);
        if (!check.valid) {
            return res.status(400).json({ ok: false, message: `Invalid Task "${task.title}": ${check.message}` });
        }
    }
    // --- LOGICAL VALIDATION END ---

    // Check for existing PENDING request for this user + date
    const existingRequest = await knexDB("dar_requests")
        .where({
            user_id,
            request_date, // assuming date string format matches
            status: 'PENDING'
        })
        .first();

    let request_id;

    if (existingRequest) {
        // Update existing request
        await knexDB("dar_requests")
            .where({ request_id: existingRequest.request_id })
            .update({
                proposed_data: JSON.stringify(proposed_data),
                updated_at: knexDB.fn.now()
                // We keep original_data as is, assuming the baseline hasn't changed. 
                // Alternatively, we could update original_data too if passed.
            });
        request_id = existingRequest.request_id;
    } else {
        // Insert new Request
        const [id] = await knexDB("dar_requests").insert({
            org_id,
            user_id,
            request_date,
            original_data: JSON.stringify(original_data || []),
            proposed_data: JSON.stringify(proposed_data),
            status: 'PENDING',
            created_at: knexDB.fn.now()
        });
        request_id = id;
    }

    res.json({ ok: true, message: existingRequest ? "Request updated successfully" : "Request submitted successfully", request_id });
}));

// GET /dar/requests/list
// Admin fetches pending requests
router.get('/list', authenticateJWT, catchAsync(async (req, res) => {
    const { org_id } = req.user;

    // Join with Users table to get names
    // Typically admin only, but for now we just check org_id
    const requests = await knexDB("dar_requests")
        .join("users", "dar_requests.user_id", "users.user_id")
        .select(
            "dar_requests.*",
            "users.user_name as user_name",
            "users.email as user_email",
            knexDB.raw("DATE_FORMAT(dar_requests.request_date, '%Y-%m-%d') as request_date_str")
        )
        .where("dar_requests.org_id", org_id)
        .where("dar_requests.status", 'PENDING') // Only pending by default? Or all? Let's show all for history if needed, but for now PENDING.
        .orderBy("dar_requests.created_at", "desc");

    // Parse JSON fields
    const formatted = requests.map(r => ({
        ...r,
        request_date: r.request_date_str,
        original_data: typeof r.original_data === 'string' ? JSON.parse(r.original_data) : r.original_data,
        proposed_data: typeof r.proposed_data === 'string' ? JSON.parse(r.proposed_data) : r.proposed_data
    }));

    res.json({ ok: true, data: formatted });
}));

// POST /dar/requests/approve/:id
// Admin approves a request -> Applies changes to `daily_activities`
router.post('/approve/:id', authenticateJWT, catchAsync(async (req, res) => {
    const { id } = req.params;
    const { org_id } = req.user; // Ensure admin belongs to same org

    const request = await knexDB("dar_requests")
        .select("*", knexDB.raw("DATE_FORMAT(request_date, '%Y-%m-%d') as request_date_str"))
        .where({ request_id: id, org_id }).first();

    if (!request) {
        return res.status(404).json({ ok: false, message: "Request not found" });
    }

    if (request.status !== 'PENDING') {
        return res.status(400).json({ ok: false, message: "Request already processed" });
    }

    const proposedTasks = typeof request.proposed_data === 'string' ? JSON.parse(request.proposed_data) : request.proposed_data;
    // Use the string directly from DB to avoid JS Timezone shifts (e.g. IST to UTC backshift)
    const targetDate = request.request_date_str;

    // Transaction to ensure atomicity
    await knexDB.transaction(async (trx) => {
        // 1. DELETE existing activities for that User + Date
        await trx("daily_activities")
            .where({ user_id: request.user_id, org_id })
            .whereRaw("DATE(activity_date) = ?", [targetDate])
            .del();

        // 2. INSERT new tasks as COMPLETED
        if (proposedTasks.length > 0) {
            const inserts = proposedTasks.map(t => ({
                org_id,
                user_id: request.user_id,
                activity_date: targetDate,
                start_time: t.start_time,
                end_time: t.end_time,
                title: t.title,
                description: t.description,
                activity_type: t.activity_type || 'TASK',
                status: 'COMPLETED', // Approved retro-edits are always COMPLETED
                created_at: knexDB.fn.now()
            }));
            await trx("daily_activities").insert(inserts);
        }

        // 3. UPDATE request status
        await trx("dar_requests")
            .where({ request_id: id })
            .update({ status: 'APPROVED', updated_at: knexDB.fn.now() });
    });

    res.json({ ok: true, message: "Request approved and changes applied." });
}));

// POST /dar/requests/reject/:id
router.post('/reject/:id', authenticateJWT, catchAsync(async (req, res) => {
    const { id } = req.params;
    const { org_id } = req.user;
    const { comment } = req.body;

    const updated = await knexDB("dar_requests")
        .where({ request_id: id, org_id })
        .update({
            status: 'REJECTED',
            admin_comment: comment,
            updated_at: knexDB.fn.now()
        });

    if (!updated) {
        return res.status(404).json({ ok: false, message: "Request not found" });
    }

    res.json({ ok: true, message: "Request rejected." });
}));

export default router;
