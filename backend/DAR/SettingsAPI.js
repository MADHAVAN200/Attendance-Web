import express from 'express';
import { knexDB } from '../database.js';
import { authenticateJWT } from '../AuthAPI/LoginAPI.js';
import catchAsync from "../utils/catchAsync.js";

const router = express.Router();

// GET /dar/settings/list
// Fetch current settings (buffer & categories)
router.get('/list', authenticateJWT, catchAsync(async (req, res) => {
    const { org_id } = req.user;

    // Ensure settings exist (migration should have handled it, but safe fallback)
    let settings = await knexDB("dar_settings").where({ org_id }).first();

    if (!settings) {
        // Init default if missing
        const defaultCats = JSON.stringify(["Site Visit", "Inspection", "Office Work", "Material Check", "Meeting", "Safety", "Documentation"]);
        await knexDB("dar_settings").insert({
            org_id,
            buffer_minutes: 30,
            categories: defaultCats
        });
        settings = { buffer_minutes: 30, categories: defaultCats };
    }

    // Parse JSON categories if string
    let categories = [];
    try {
        categories = typeof settings.categories === 'string' ? JSON.parse(settings.categories) : settings.categories;
    } catch (e) {
        categories = [];
    }

    res.json({
        ok: true,
        data: {
            buffer_minutes: settings.buffer_minutes,
            categories: categories || []
        }
    });
}));

// POST /dar/settings/update
// Update buffer or categories
router.post('/update', authenticateJWT, catchAsync(async (req, res) => {
    const { org_id } = req.user;
    const { buffer_minutes, categories } = req.body;

    // Validate inputs
    const updates = {};
    if (buffer_minutes !== undefined) updates.buffer_minutes = buffer_minutes;
    if (categories !== undefined) {
        if (!Array.isArray(categories)) {
            return res.status(400).json({ ok: false, message: "Categories must be an array" });
        }
        updates.categories = JSON.stringify(categories);
    }

    await knexDB("dar_settings")
        .where({ org_id })
        .update({
            ...updates,
            updated_at: knexDB.fn.now()
        });

    res.json({ ok: true, message: "Settings updated successfully" });
}));

export default router;
