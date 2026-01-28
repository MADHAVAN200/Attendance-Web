import express from 'express';
import { knexDB } from '../database.js';
import { authenticateJWT } from '../middleware/auth.js';
import catchAsync from "../utils/catchAsync.js";

const router = express.Router();

// GET /employee/locations
// Fetch assigned work locations for the logged-in user
router.get('/locations', authenticateJWT, catchAsync(async (req, res) => {
    const user_id = req.user.user_id;

    // Fetch assigned locations
    const assignedLocations = await knexDB("user_work_locations")
        .join("work_locations", "user_work_locations.location_id", "work_locations.location_id")
        .where("user_work_locations.user_id", user_id)
        .where("work_locations.is_active", true)
        .select(
            "work_locations.location_id",
            "work_locations.location_name",
            "work_locations.address",
            "work_locations.latitude",
            "work_locations.longitude",
            "work_locations.radius"
        );

    const isUnrestricted = assignedLocations.length === 0;

    res.json({
        ok: true,
        locations: assignedLocations,
        unrestricted: isUnrestricted
    });
}));

export default router;
