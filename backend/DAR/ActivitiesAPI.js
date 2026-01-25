import express from 'express';
import { knexDB } from '../database.js';
import { authenticateJWT } from '../AuthAPI/LoginAPI.js';
import catchAsync from "../utils/catchAsync.js";

const router = express.Router();

// Helper: Get Org Buffer Settings
export async function getOrgBuffer(org_id) {
    const settings = await knexDB("dar_settings").where({ org_id }).first();
    return settings ? settings.buffer_minutes : 30; // Default 30 mins
}

// Helper: Validation Logic
export async function validateActivityTime(user_id, date, start_time, end_time, buffer_minutes) {
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];

    // 1. Check Future Constraint (Planning Mode vs Execution Mode)
    if (date > todayStr) {
        // FUTURE: Planning Mode
        // We do NOT check attendance or buffer. Just allow it.
        return { valid: true, mode: 'PLANNING' };
    }

    // TODAY/PAST: Execution Mode (Strict Checks)
    const activityEndDateTime = new Date(`${date}T${end_time}`);
    const allowedEndDateTime = new Date(now.getTime() + buffer_minutes * 60000);

    // If activity date is today, check strict future buffer
    if (date === todayStr) {
        if (activityEndDateTime > allowedEndDateTime) {
            return { valid: false, message: `Cannot log future tasks (Buffer: ${buffer_minutes}m). Allowed until: ${allowedEndDateTime.toLocaleTimeString()}` };
        }
    }

    // 2. Check Attendance Window (Time In / Time Out)
    const attendance = await knexDB("attendance_records")
        .where("user_id", user_id)
        .whereRaw("DATE(time_in) = ?", [date])
        .orderBy("time_in", "asc");

    if (!attendance || attendance.length === 0) {
        return { valid: false, message: "No attendance record found for this date." };
    }

    // Convert strings to Comparable Values (Minutes from midnight or Date objects)
    const getMinutes = (timeStr) => {
        // timeStr is "09:00:00"
        if (!timeStr) return null;
        // If it's a full Date string from DB
        if (timeStr.includes('T') || timeStr.includes('-')) {
            const d = new Date(timeStr);
            return d.getHours() * 60 + d.getMinutes();
        }
        const [h, m] = timeStr.split(':').map(Number);
        return h * 60 + m;
    };

    const startMins = getMinutes(start_time);
    const endMins = getMinutes(end_time);

    let isWithinSession = false;

    for (const session of attendance) {
        // database time_in is usually datetime
        const sessionStart = new Date(session.time_in);
        const sessStartMins = sessionStart.getHours() * 60 + sessionStart.getMinutes();

        let sessEndMins = 24 * 60; // End of day default
        if (session.time_out) {
            const sessionEnd = new Date(session.time_out);
            sessEndMins = sessionEnd.getHours() * 60 + sessionEnd.getMinutes();
        } else {
            // Currently checked in: Valid up to NOW + Buffer
            sessEndMins = 24 * 60;
        }

        // Check containment: SessionStart <= TaskStart AND TaskEnd <= SessionEnd
        if (startMins >= sessStartMins && endMins <= sessEndMins) {
            isWithinSession = true;
            break;
        }
    }

    if (!isWithinSession) {
        return { valid: false, message: `Task time (${start_time}-${end_time}) must be within a valid 'Time In' session.` };
    }

    return { valid: true, mode: 'EXECUTION' };
}

// Helper: Shared Validation & Status Determination
async function processActivityValidation(org_id, user_id, body) {
    const { activity_date, start_time, end_time } = body;
    const buffer = await getOrgBuffer(org_id);
    const check = await validateActivityTime(user_id, activity_date, start_time, end_time, buffer);

    if (!check.valid) {
        throw new Error(check.message); // Will be caught by catchAsync
    }

    return check.mode === 'PLANNING' ? 'PLANNED' : 'COMPLETED';
}

// POST /dar/activities/create
router.post('/create', authenticateJWT, catchAsync(async (req, res) => {
    const { activity_date, start_time, end_time, title, description, activity_type } = req.body;
    const { user_id, org_id } = req.user;

    let status;
    try {
        status = await processActivityValidation(org_id, user_id, req.body);
    } catch (err) {
        return res.status(400).json({ ok: false, message: err.message });
    }

    const [activity_id] = await knexDB("daily_activities").insert({
        org_id,
        user_id,
        activity_date,
        start_time,
        end_time,
        title,
        description,
        activity_type,
        status,
        created_at: knexDB.fn.now(),
    });

    res.json({ ok: true, message: "Activity logged successfully", activity_id, status });
}));

// PUT /dar/activities/update/:id
router.put('/update/:activity_id', authenticateJWT, catchAsync(async (req, res) => {
    const { activity_id } = req.params;
    const { activity_date, start_time, end_time, title, description, activity_type } = req.body;
    const { user_id, org_id } = req.user;

    let status;
    try {
        status = await processActivityValidation(org_id, user_id, req.body);
    } catch (err) {
        return res.status(400).json({ ok: false, message: err.message });
    }

    await knexDB("daily_activities")
        .where({ activity_id, org_id, user_id })
        .update({
            activity_date,
            start_time,
            end_time,
            title,
            description,
            activity_type,
            status,
            updated_at: knexDB.fn.now()
        });

    res.json({ ok: true, message: "Activity updated successfully", status });
}));

// DELETE /dar/activities/delete/:id
router.delete('/delete/:activity_id', authenticateJWT, catchAsync(async (req, res) => {
    const { activity_id } = req.params;
    const { user_id, org_id } = req.user;

    const deleted = await knexDB("daily_activities")
        .where({ activity_id, org_id, user_id })
        .del();

    if (!deleted) {
        return res.status(404).json({ ok: false, message: "Activity not found or unauthorized" });
    }

    res.json({ ok: true, message: "Activity deleted successfully" });
}));
// GET /dar/activities/list
router.get('/list', authenticateJWT, catchAsync(async (req, res) => {
    const { date, date_from, date_to } = req.query;
    const { user_id, org_id } = req.user;

    let query = knexDB("daily_activities")
        .select(
            "*",
            knexDB.raw("DATE_FORMAT(activity_date, '%Y-%m-%d') as activity_date")
        )
        .where({ org_id, user_id });

    if (date) {
        query.where("activity_date", date);
    } else if (date_from && date_to) {
        query.whereBetween("activity_date", [date_from, date_to]);
    }

    const data = await query.orderBy("activity_date", "asc").orderBy("start_time", "asc");

    res.json({ ok: true, data });
}));

// GET /dar/activities/settings
router.get('/settings', authenticateJWT, catchAsync(async (req, res) => {
    const buffer = await getOrgBuffer(req.user.org_id);
    res.json({ ok: true, buffer_minutes: buffer });
}));

export default router;
