import express from 'express';
import { knexDB } from '../Database.js';
import { authenticateJWT } from '../AuthAPI/LoginAPI.js';

const router = express.Router();

// === SHIFTS ===

// GET /policies/shifts
router.get('/shifts', authenticateJWT, async (req, res) => {
    try {
        const org_id = req.user.org_id;
        const shifts = await knexDB('shifts').where({ org_id });
        res.json({ ok: true, shifts });
    } catch (error) {
        console.error('Error fetching shifts:', error);
        res.status(500).json({ ok: false, message: 'Server error' });
    }
});

// POST /policies/shifts
router.post('/shifts', authenticateJWT, async (req, res) => {
    try {
        const org_id = req.user.org_id;
        const { shift_name, shift_type, start_time, end_time, grace_period_mins, is_overtime_enabled, overtime_threshold_hours } = req.body;

        const [id] = await knexDB('shifts').insert({
            org_id,
            shift_name,
            shift_type: shift_type || 'Fixed',
            start_time,
            end_time,
            grace_period_mins: grace_period_mins || 0,
            is_overtime_enabled: is_overtime_enabled ? 1 : 0,
            overtime_threshold_hours: overtime_threshold_hours || 8.0
        });

        res.json({ ok: true, message: 'Shift created', shift_id: id });
    } catch (error) {
        console.error('Error creating shift:', error);
        res.status(500).json({ ok: false, message: 'Server error' });
    }
});

// === AUTOMATION POLICIES ===

// GET /policies/automation
router.get('/automation', authenticateJWT, async (req, res) => {
    try {
        const org_id = req.user.org_id;
        const policies = await knexDB('automation_policies').where({ org_id });
        res.json({ ok: true, policies });
    } catch (error) {
        console.error('Error fetching policies:', error);
        res.status(500).json({ ok: false, message: 'Server error' });
    }
});

// POST /policies/automation
router.post('/automation', authenticateJWT, async (req, res) => {
    try {
        const org_id = req.user.org_id;
        const { policy_name, policy_logic_json } = req.body;

        const [id] = await knexDB('automation_policies').insert({
            org_id,
            policy_name,
            policy_logic_json: JSON.stringify(policy_logic_json || {}),
            is_active: 1
        });

        res.json({ ok: true, message: 'Policy saved', policy_id: id });
    } catch (error) {
        console.error('Error saving policy:', error);
        res.status(500).json({ ok: false, message: 'Server error' });
    }
});

export default router;
