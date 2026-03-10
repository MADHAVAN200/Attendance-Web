import catchAsync from '../../utils/catchAsync.js';
import * as DarSettingsService from '../../services/darServices/settingsServices.js';


export const getSettings = catchAsync(async (req, res) => {
    const { org_id } = req.user;
    const data = await DarSettingsService.getOrInitSettings({ org_id });
    res.json({ ok: true, data });
});

export const updateSettings = catchAsync(async (req, res) => {
    const { org_id } = req.user;
    const { buffer_minutes, categories } = req.body;

    if (categories !== undefined && !Array.isArray(categories)) {
        return res.status(400).json({ ok: false, message: "Categories must be an array" });
    }

    await DarSettingsService.updateSettings({ org_id, buffer_minutes, categories });
    res.json({ ok: true, message: "Settings updated successfully" });
});