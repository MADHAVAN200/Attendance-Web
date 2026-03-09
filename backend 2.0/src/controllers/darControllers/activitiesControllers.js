import catchAsync from '../../utils/catchAsync.js';
import * as DarActivityService from '../../services/darServices/activitiesServices.js';

export const createActivity = catchAsync(async (req, res) => {
    const { activity_date, start_time, end_time, title, description, activity_type } = req.body;
    const { user_id, org_id } = req.user;

    let status;
    try {
        status = await DarActivityService.processActivityValidation(org_id, user_id, req.body);
    } catch (err) {
        return res.status(400).json({ ok: false, message: err.message });
    }

    const activity_id = await DarActivityService.createActivity({
        org_id, user_id, activity_date, start_time, end_time, title, description, activity_type, status
    });

    res.json({ ok: true, message: "Activity logged successfully", activity_id, status });
});

export const updateActivity = catchAsync(async (req, res) => {
    const activity_id = req.params.id;
    const { activity_date, start_time, end_time, title, description, activity_type } = req.body;
    const { user_id, org_id } = req.user;

    let status;
    try {
        status = await DarActivityService.processActivityValidation(org_id, user_id, req.body);
    } catch (err) {
        return res.status(400).json({ ok: false, message: err.message });
    }

    await DarActivityService.updateActivity({
        activity_id, org_id, user_id, activity_date, start_time, end_time, title, description, activity_type, status
    });

    res.json({ ok: true, message: "Activity updated successfully", status });
});

export const deleteActivity = catchAsync(async (req, res) => {
    const activity_id = req.params.id;
    const { user_id, org_id } = req.user;

    const deleted = await DarActivityService.deleteActivity({ activity_id, org_id, user_id });

    if (!deleted) {
        return res.status(404).json({ ok: false, message: "Activity not found or unauthorized" });
    }

    res.json({ ok: true, message: "Activity deleted successfully" });
});

export const listActivities = catchAsync(async (req, res) => {
    const { date, date_from, date_to } = req.query;
    const { user_id, org_id } = req.user;

    const data = await DarActivityService.listActivities({ org_id, user_id, date, date_from, date_to });

    res.json({ ok: true, data });
});

export const getSettings = catchAsync(async (req, res) => {
    const buffer = await DarActivityService.getOrgBuffer(req.user.org_id);
    res.json({ ok: true, buffer_minutes: buffer });
});

export const getAllActivitiesAdmin = catchAsync(async (req, res) => {
    const { org_id, user_type } = req.user;

    if (user_type !== 'admin' && user_type !== 'hr') {
        return res.status(403).json({ ok: false, message: 'Access denied. Admins only.' });
    }

    const { date, startDate, endDate } = req.query;
    const activities = await DarActivityService.getAllActivitiesAdmin({ org_id, date, startDate, endDate });

    res.json({ ok: true, data: activities });
});