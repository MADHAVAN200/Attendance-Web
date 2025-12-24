import express from 'express';
import { knexDB } from '../Database.js';
import { authenticateJWT } from '../AuthAPI/LoginAPI.js';

const router = express.Router();

// Middleware to ensure user is admin (simple check for now)
const ensureAdmin = (req, res, next) => {
    // Check based on designation or explicit 'is_admin' flag (if added later)
    // For now, let's assume if they have 'admin' in designation or explicit permission
    // Or just rely on JWT authenticateJWT to verify identity.
    // TODO: Implement proper Role Based Access Control (RBAC)
    next();
};

// GET /locations - List all active locations for the user's org
router.get('/', authenticateJWT, async (req, res) => {
    try {
        const org_id = req.user.org_id;
        const locations = await knexDB('work_locations')
            .where({ org_id, is_active: 1 });
        res.json({ ok: true, locations });
    } catch (error) {
        console.error('Error fetching locations:', error);
        res.status(500).json({ ok: false, message: 'Server error' });
    }
});

// POST /locations - Add a new location
router.post('/', authenticateJWT, ensureAdmin, async (req, res) => {
    try {
        const org_id = req.user.org_id;
        const { location_name, address, latitude, longitude, radius } = req.body;

        if (!location_name || !latitude || !longitude) {
            return res.status(400).json({ ok: false, message: 'Missing required fields' });
        }

        const [id] = await knexDB('work_locations').insert({
            org_id,
            location_name,
            address,
            latitude,
            longitude,
            radius: radius || 100
        });

        res.json({ ok: true, message: 'Location added', location_id: id });
    } catch (error) {
        console.error('Error adding location:', error);
        res.status(500).json({ ok: false, message: 'Server error' });
    }
});

// PUT /locations/:id - Update location
router.put('/:id', authenticateJWT, ensureAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const org_id = req.user.org_id;
        const updates = req.body;

        const count = await knexDB('work_locations')
            .where({ location_id: id, org_id })
            .update(updates);

        if (count === 0) return res.status(404).json({ ok: false, message: 'Location not found' });

        res.json({ ok: true, message: 'Location updated' });
    } catch (error) {
        console.error('Error updating location:', error);
        res.status(500).json({ ok: false, message: 'Server error' });
    }
});

// DELETE /locations/:id - Soft delete (set is_active = 0)
router.delete('/:id', authenticateJWT, ensureAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const org_id = req.user.org_id;

        await knexDB('work_locations')
            .where({ location_id: id, org_id })
            .update({ is_active: 0 });

        res.json({ ok: true, message: 'Location deleted' });
    } catch (error) {
        console.error('Error deleting location:', error);
        res.status(500).json({ ok: false, message: 'Server error' });
    }
});

export default router;
