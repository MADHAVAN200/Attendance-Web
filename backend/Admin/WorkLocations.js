import express from 'express';
import { knexDB } from '../database.js';
import { authenticateJWT } from '../middleware/auth.js';
import AppError from "../utils/AppError.js";
import catchAsync from "../utils/catchAsync.js";

const router = express.Router();

// Middleware to ensure user is admin (simple check for now)
const ensureAdmin = (req, res, next) => {
    if (req.user.user_type === 'admin') {
        return next();
    }
    return res.status(403).json({ ok: false, message: "Access denied. Admins only." });
};

// GET /locations - List all active locations for the user's org
router.get('/', authenticateJWT, catchAsync(async (req, res) => {
    // try removed
    const org_id = req.user.org_id;
    const locations = await knexDB('work_locations')
        .where({ org_id });
    res.json({ ok: true, locations });
}));

// POST /locations - Add a new location
router.post('/', authenticateJWT, ensureAdmin, catchAsync(async (req, res) => {
    // try removed
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
}));

// PUT /locations/:id - Update location
router.put('/:id', authenticateJWT, ensureAdmin, catchAsync(async (req, res) => {
    // try removed
    const { id } = req.params;
    const org_id = req.user.org_id;
    const updates = req.body;

    const count = await knexDB('work_locations')
        .where({ location_id: id, org_id })
        .update(updates);

    if (count === 0) return res.status(404).json({ ok: false, message: 'Location not found' });

    res.json({ ok: true, message: 'Location updated' });
}));

// DELETE /locations/:id - Soft delete (set is_active = 0)
router.delete('/:id', authenticateJWT, ensureAdmin, catchAsync(async (req, res) => {
    // try removed
    const { id } = req.params;
    const org_id = req.user.org_id;

    await knexDB('work_locations')
        .where({ location_id: id, org_id })
        .update({ is_active: 0 });

    res.json({ ok: true, message: 'Location deleted' });
}));

// POST /assignments - Bulk assign/remove users from work locations
router.post('/assignments', authenticateJWT, ensureAdmin, catchAsync(async (req, res) => {
    const { assignments } = req.body;
    const org_id = req.user.org_id;

    if (!assignments || !Array.isArray(assignments)) {
        throw new AppError("Invalid input. 'assignments' array is required.", 400);
    }

    // 1. Validate Ownership of all Locations
    const requestedLocIds = [...new Set(assignments.map(a => a.work_location_id).filter(id => id))];

    if (requestedLocIds.length > 0) {
        const validLocations = await knexDB('work_locations')
            .whereIn('location_id', requestedLocIds)
            .where({ org_id })
            .select('location_id');

        const validLocIdSet = new Set(validLocations.map(l => l.location_id));

        for (const reqId of requestedLocIds) {
            if (!validLocIdSet.has(reqId)) {
                throw new AppError(`Access Denied: Work Location ID ${reqId} does not belong to your organization.`, 403);
            }
        }
    }

    await knexDB.transaction(async (trx) => {
        for (const item of assignments) {
            const { work_location_id, add, remove } = item;

            if (!work_location_id) continue;

            // 1. Remove Users
            if (remove && Array.isArray(remove) && remove.length > 0) {
                await trx('user_work_locations')
                    .where('location_id', work_location_id)
                    .whereIn('user_id', remove)
                    .del();
            }

            // 2. Add Users
            if (add && Array.isArray(add) && add.length > 0) {
                const dataToInsert = add.map(uid => ({
                    user_id: uid,
                    location_id: work_location_id
                }));

                await trx('user_work_locations')
                    .insert(dataToInsert)
                    .onConflict(['user_id', 'location_id'])
                    .ignore();
            }
        }
    });

    res.json({ ok: true, message: "Work location assignments updated successfully." });
}));

export default router;

