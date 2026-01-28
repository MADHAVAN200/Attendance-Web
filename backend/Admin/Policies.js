import express from 'express';
import { knexDB } from '../database.js';
import { authenticateJWT } from '../middleware/auth.js';
import AppError from "../utils/AppError.js";
import catchAsync from "../utils/catchAsync.js";

const ensureAdmin = (req, res, next) => {
    if (req.user.user_type === 'admin') {
        return next();
    }
    return res.status(403).json({ ok: false, message: "Access denied. Admins only." });
};

const formatTime = (t) => {
    if (!t) return null;
    // Append seconds if missing (simple check for HH:mm)
    if (String(t).length === 5) return t + ":00";
    return t;
};

const router = express.Router();

// GET /policies/config
router.get('/config', authenticateJWT, ensureAdmin, catchAsync(async (req, res) => {
    // try removed
    const org_id = req.user.org_id;
    const shifts = await knexDB('shifts').where({ org_id }); // This seems to be fetching shifts, not general config. User might intend to change this later.
    res.json({ ok: true, shifts });
}));

// === SHIFTS ===


// GET /policies/shifts
router.get('/shifts', authenticateJWT, catchAsync(async (req, res) => {
    const org_id = req.user.org_id;
    const shifts = await knexDB('shifts').where({ org_id });
    console.log(shifts);

    // Parse JSON rules for frontend compatibility (Simulate columns)
    const parsedShifts = shifts.map(s => {
        const rules = typeof s.policy_rules === 'string' ? JSON.parse(s.policy_rules) : (s.policy_rules || {});
        return {
            shift_id: s.shift_id,
            shift_name: s.shift_name,
            org_id: s.org_id,
            // Map JSON back to legacy fields for frontend
            start_time: rules.shift_timing?.start_time || null,
            end_time: rules.shift_timing?.end_time || null,
            grace_period_mins: rules.grace_period?.minutes || 0,
            is_overtime_enabled: rules.overtime?.enabled ? 1 : 0,
            overtime_threshold_hours: rules.overtime?.threshold || 8.0,
            policy_rules: rules
        };
    });

    res.json({ ok: true, shifts: parsedShifts });
}));

// POST /policies/shifts
router.post('/shifts', authenticateJWT, catchAsync(async (req, res) => {
    const org_id = req.user.org_id;
    const {
        shift_name, start_time, end_time, grace_period_mins,
        is_overtime_enabled, overtime_threshold_hours,
        policy_rules
    } = req.body;

    // Bundle columns into JSON logic structure
    const rules = policy_rules || {};
    const finalRules = {
        ...rules,
        shift_timing: {
            start_time,
            end_time
        },
        grace_period: {
            minutes: Number(grace_period_mins) || 0
        },
        overtime: {
            enabled: is_overtime_enabled ? true : false,
            threshold: Number(overtime_threshold_hours) || 8
        },
        entry_requirements: rules.entry_requirements || { selfie: true, geofence: true }
    };

    const [id] = await knexDB('shifts').insert({
        org_id,
        shift_name,
        // No legacy columns used
        policy_rules: JSON.stringify(finalRules)
    });

    res.json({ ok: true, message: 'Shift created', shift_id: id });
}));

// PUT /policies/shifts/:shift_id
router.put('/shifts/:shift_id', authenticateJWT, catchAsync(async (req, res) => {
    const org_id = req.user.org_id;
    const { shift_id } = req.params;
    const {
        shift_name,
        policy_rules = {}
    } = req.body;

    const updates = {
        shift_name,
        policy_rules: JSON.stringify(policy_rules)
    };

    const affected = await knexDB('shifts')
        .where({ shift_id, org_id })
        .update(updates);

    if (affected === 0) {
        return res.status(404).json({ ok: false, message: "Shift not found or unauthorized" });
    }

    res.json({ ok: true, message: 'Shift updated' });
}));

// DELETE /policies/shifts/:shift_id
router.delete('/shifts/:shift_id', authenticateJWT, catchAsync(async (req, res) => {
    const org_id = req.user.org_id;
    const { shift_id } = req.params;

    // Check if shift is assigned to any user
    const usersCount = await knexDB('users').where({ shift_id }).count('user_id as count').first();
    if (usersCount.count > 0) {
        return res.status(400).json({ ok: false, message: `Cannot delete shift. It is assigned to ${usersCount.count} users.` });
    }

    const affected = await knexDB('shifts')
        .where({ shift_id, org_id })
        .del();

    if (affected === 0) {
        return res.status(404).json({ ok: false, message: "Shift not found" });
    }

    res.json({ ok: true, message: 'Shift deleted' });
}));

export default router;
