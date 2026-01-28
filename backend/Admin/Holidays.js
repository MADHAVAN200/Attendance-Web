import express from 'express';
import { knexDB } from '../database.js';
import { authenticateJWT } from '../middleware/auth.js';
import AppError from "../utils/AppError.js";
import catchAsync from "../utils/catchAsync.js";

const router = express.Router();

// Middleware to ensure user is admin
const ensureAdmin = (req, res, next) => {
    if (req.user.user_type === 'admin') {
        return next();
    }
    return res.status(403).json({ ok: false, message: "Access denied. Admins only." });
};

// GET /holidays
router.get('/', authenticateJWT, catchAsync(async (req, res) => {
    // try removed
    const org_id = req.user.org_id;
    // Format date as YYYY-MM-DD string to avoid timezone confusion (e.g. 18:30 prev day)
    const holidays = await knexDB('holidays')
        .select(
            '*',
            knexDB.raw("DATE_FORMAT(holiday_date, '%Y-%m-%d') as holiday_date")
        )
        .where({ org_id });
    res.json({ ok: true, holidays });
}));

// POST / - Bulk or Single Insert
router.post('/', authenticateJWT, catchAsync(async (req, res) => {
    const org_id = req.user.org_id;
    let holidaysToInsert = [];

    // Check if input is an array or has a 'holidays' key
    if (Array.isArray(req.body)) {
        holidaysToInsert = req.body;
    } else if (req.body.holidays && Array.isArray(req.body.holidays)) {
        holidaysToInsert = req.body.holidays;
    } else {
        // Single object case
        holidaysToInsert = [req.body];
    }

    if (holidaysToInsert.length === 0) {
        return res.status(400).json({ ok: false, message: 'No holiday data provided' });
    }

    // Validate and prepare data
    const prepareData = holidaysToInsert.map(h => {
        if (!h.holiday_name || !h.holiday_date) {
            throw new AppError('Missing required fields (holiday_name, holiday_date) in one or more entries', 400);
        }
        return {
            org_id,
            holiday_name: h.holiday_name,
            holiday_date: h.holiday_date,
            holiday_type: h.holiday_type || 'Public',
            applicable_json: JSON.stringify(h.applicable_json || [])
        };
    });

    await knexDB.transaction(async (trx) => {
        await trx('holidays').insert(prepareData);
    });

    res.json({ ok: true, message: `${prepareData.length} holiday(s) added successfully` });
}));

// PUT /:id - Single Update
router.put('/:id', authenticateJWT, catchAsync(async (req, res) => {
    const { id } = req.params;
    const org_id = req.user.org_id;
    const { holiday_name, holiday_date, holiday_type, applicable_json } = req.body;

    const updates = {};
    if (holiday_name) updates.holiday_name = holiday_name;
    if (holiday_date) updates.holiday_date = holiday_date;
    if (holiday_type) updates.holiday_type = holiday_type;
    if (applicable_json) updates.applicable_json = JSON.stringify(applicable_json);

    const count = await knexDB('holidays')
        .where({ holiday_id: id, org_id })
        .update(updates);

    if (count === 0) return res.status(404).json({ ok: false, message: 'Holiday not found' });

    res.json({ ok: true, message: 'Holiday updated' });
}));

// DELETE / - Bulk Delete
router.delete('/', authenticateJWT, catchAsync(async (req, res) => {
    const org_id = req.user.org_id;
    const { ids } = req.body;

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
        return res.status(400).json({ ok: false, message: 'Please provide an array of "ids" to delete' });
    }

    const count = await knexDB('holidays')
        .where({ org_id })
        .whereIn('holiday_id', ids)
        .del();

    res.json({ ok: true, message: `${count} holiday(s) deleted` });
}));

export default router;
