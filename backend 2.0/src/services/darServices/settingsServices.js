import { attendanceDB } from '../../config/database.js';

const DEFAULT_CATEGORIES = ["Site Visit", "Inspection", "Office Work", "Material Check", "Meeting", "Safety", "Documentation"];

export async function getOrInitSettings({ org_id }) {
    let settings = await attendanceDB("dar_settings").where({ org_id }).first();

    if (!settings) {
        const defaultCats = JSON.stringify(DEFAULT_CATEGORIES);
        await attendanceDB("dar_settings").insert({
            org_id,
            buffer_minutes: 30,
            categories: defaultCats
        });
        settings = { buffer_minutes: 30, categories: defaultCats };
    }

    let categories = [];
    try {
        categories = typeof settings.categories === 'string' ? JSON.parse(settings.categories) : settings.categories;
    } catch (e) {
        categories = [];
    }

    return { buffer_minutes: settings.buffer_minutes, categories: categories || [] };
}

export async function updateSettings({ org_id, buffer_minutes, categories }) {
    const updates = {};
    if (buffer_minutes !== undefined) updates.buffer_minutes = buffer_minutes;
    if (categories !== undefined) updates.categories = JSON.stringify(categories);

    await attendanceDB("dar_settings")
        .where({ org_id })
        .update({ ...updates, updated_at: attendanceDB.fn.now() });
}