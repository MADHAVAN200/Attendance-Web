import express from 'express';
import { knexDB } from '../database.js';
import { authenticateJWT } from '../middleware/auth.js';
import catchAsync from "../utils/catchAsync.js";

const router = express.Router();

// POST /dar/events/create
// Create a new event/meeting
router.post('/create', authenticateJWT, catchAsync(async (req, res) => {
    const { title, description, event_date, start_time, end_time, location, type } = req.body;

    // Basic formatting - Trust the frontend YYYY-MM-DD
    // const formattedDate = new Date(event_date).toISOString().split('T')[0];
    // If we re-parse with new Date(), we risk timezone shifts if server time differs.
    const formattedDate = event_date;

    const [event_id] = await knexDB("events_meetings").insert({
        org_id: req.user.org_id,
        user_id: req.user.user_id,
        title,
        description,
        event_date: formattedDate,
        start_time,
        end_time,
        location,
        type, // 'EVENT' or 'MEETING'
        created_at: knexDB.fn.now(),
        updated_at: knexDB.fn.now()
    });

    res.json({ ok: true, message: "Created successfully", event_id });
}));

// GET /dar/events/list
// List events (Filter by date range, type)
router.get('/list', authenticateJWT, catchAsync(async (req, res) => {
    const { date_from, date_to, type } = req.query;
    const org_id = req.user.org_id;

    let query = knexDB("events_meetings")
        .select(
            "*",
            knexDB.raw("DATE_FORMAT(event_date, '%Y-%m-%d') as event_date")
        )
        .where("org_id", org_id);

    if (date_from) {
        query.where("event_date", ">=", date_from);
    }
    if (date_to) {
        query.where("event_date", "<=", date_to);
    }
    if (type) {
        query.where("type", type);
    }

    // Sort by date then start time
    query.orderBy("event_date", "asc").orderBy("start_time", "asc");

    const events = await query;
    res.json({ ok: true, data: events });
}));

// PUT /dar/events/update/:id
router.put('/update/:event_id', authenticateJWT, catchAsync(async (req, res) => {
    const { event_id } = req.params;
    const updates = req.body;

    // Remove immutable fields if present
    delete updates.event_id;
    delete updates.org_id;
    delete updates.user_id; // Usually ownership doesn't change
    delete updates.created_at;

    updates.updated_at = knexDB.fn.now();

    await knexDB("events_meetings")
        .where({ event_id, org_id: req.user.org_id })
        .update(updates);

    res.json({ ok: true, message: "Updated successfully" });
}));

// DELETE /dar/events/delete/:id
router.delete('/delete/:event_id', authenticateJWT, catchAsync(async (req, res) => {
    const { event_id } = req.params;

    await knexDB("events_meetings")
        .where({ event_id, org_id: req.user.org_id })
        .del();

    res.json({ ok: true, message: "Deleted successfully" });
}));

export default router;
