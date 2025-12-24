import express from 'express';
import { knexDB } from '../Database.js';
import { authenticateJWT } from '../AuthAPI/LoginAPI.js';

const router = express.Router();

// GET /holidays
router.get('/', authenticateJWT, async (req, res) => {
    try {
        const org_id = req.user.org_id;
        const holidays = await knexDB('holidays').where({ org_id });
        res.json({ ok: true, holidays });
    } catch (error) {
        console.error('Error fetching holidays:', error);
        res.status(500).json({ ok: false, message: 'Server error' });
    }
});

// POST /holidays
router.post('/', authenticateJWT, async (req, res) => {
    try {
        const org_id = req.user.org_id;
        const { holiday_name, holiday_date, holiday_type, applicable_json } = req.body;

        if (!holiday_name || !holiday_date) {
            return res.status(400).json({ ok: false, message: 'Missing required fields' });
        }

        const [id] = await knexDB('holidays').insert({
            org_id,
            holiday_name,
            holiday_date,
            holiday_type: holiday_type || 'Public',
            applicable_json: JSON.stringify(applicable_json || [])
        });

        res.json({ ok: true, message: 'Holiday added', holiday_id: id });
    } catch (error) {
        console.error('Error adding holiday:', error);
        res.status(500).json({ ok: false, message: 'Server error' });
    }
});

// DELETE /holidays/:id
router.delete('/:id', authenticateJWT, async (req, res) => {
    try {
        const { id } = req.params;
        const org_id = req.user.org_id;

        await knexDB('holidays')
            .where({ holiday_id: id, org_id })
            .del();

        res.json({ ok: true, message: 'Holiday deleted' });
    } catch (error) {
        console.error('Error deleting holiday:', error);
        res.status(500).json({ ok: false, message: 'Server error' });
    }
});

export default router;
