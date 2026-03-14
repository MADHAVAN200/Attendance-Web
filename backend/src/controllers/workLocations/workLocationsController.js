import catchAsync from '../../utils/catchAsync.js';
import * as WorkLocationService from '../../services/workLocations/workLocationsServices.js';

export const getLocations = catchAsync(async (req, res) => {
    const { org_id } = req.user;
    const locations = await WorkLocationService.getAllLocations({ org_id });
    res.json({ ok: true, locations });
});

export const createLocation = catchAsync(async (req, res) => {
    const { org_id } = req.user;
    const { location_name, address, latitude, longitude, radius } = req.body;

    if (!location_name || !latitude || !longitude) {
        return res.status(400).json({ ok: false, message: 'Missing required fields' });
    }

    const id = await WorkLocationService.createLocation({ org_id, location_name, address, latitude, longitude, radius });
    res.json({ ok: true, message: 'Location added', location_id: id });
});

export const updateLocation = catchAsync(async (req, res) => {
    const { id } = req.params;
    const { org_id } = req.user;
    const updates = req.body;

    const count = await WorkLocationService.updateLocation({ id, org_id, updates });

    if (count === 0) return res.status(404).json({ ok: false, message: 'Location not found' });

    res.json({ ok: true, message: 'Location updated' });
});

export const deleteLocation = catchAsync(async (req, res) => {
    const { id } = req.params;
    const { org_id } = req.user;

    await WorkLocationService.softDeleteLocation({ id, org_id });
    res.json({ ok: true, message: 'Location deleted' });
});

export const bulkAssign = catchAsync(async (req, res) => {
    const { assignments } = req.body;
    const { org_id } = req.user;

    await WorkLocationService.bulkAssign({ org_id, assignments });
    res.json({ ok: true, message: 'Work location assignments updated successfully.' });
});