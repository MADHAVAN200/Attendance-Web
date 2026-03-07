import catchAsync from '../../utils/catchAsync.js';
import * as ShiftService from '../../services/shifts/shiftService.js';

export const getShifts = catchAsync(async (req, res) => {
    const { org_id } = req.user;
    const shifts = await ShiftService.getShiftsForOrg(org_id);
    res.json({ ok: true, shifts });
});

export const createShift = catchAsync(async (req, res) => {
    const { org_id } = req.user;
    const {
        shift_name, start_time, end_time, grace_period_mins,
        is_overtime_enabled, overtime_threshold_hours, policy_rules
    } = req.body;

    const shift_id = await ShiftService.createShift({
        org_id,
        shift_name,
        start_time,
        end_time,
        grace_period_mins,
        is_overtime_enabled,
        overtime_threshold_hours,
        policy_rules
    });

    res.json({ ok: true, message: 'Shift created', shift_id });
});

export const updateShift = catchAsync(async (req, res) => {
    const { org_id } = req.user;
    const { shift_id } = req.params;
    const { shift_name, policy_rules = {} } = req.body;

    const affected = await ShiftService.updateShift({
        shift_id,
        org_id,
        shift_name,
        policy_rules
    });

    if (affected === 0) {
        return res.status(404).json({ ok: false, message: 'Shift not found or unauthorized' });
    }

    res.json({ ok: true, message: 'Shift updated' });
});

export const deleteShift = catchAsync(async (req, res) => {
    const { org_id } = req.user;
    const { shift_id } = req.params;

    try {
        const affected = await ShiftService.deleteShift({ shift_id, org_id });

        if (affected === 0) {
            return res.status(404).json({ ok: false, message: 'Shift not found' });
        }

        res.json({ ok: true, message: 'Shift deleted' });
    } catch (err) {
        return res.status(400).json({ ok: false, message: err.message });
    }
});

export const getShiftUsers = catchAsync(async (req, res) => {
    const { org_id, user_type } = req.user;

    if (user_type !== 'admin') {
        return res.status(403).json({ ok: false, message: 'Access denied. Admins only.' });
    }

    const users = await ShiftService.getUsersWithShifts(org_id);
    res.json({ ok: true, users });
});

export const assignUserShift = catchAsync(async (req, res) => {
    const { org_id, user_type } = req.user;

    if (user_type !== 'admin') {
        return res.status(403).json({ ok: false, message: 'Access denied. Admins only.' });
    }

    const { user_id } = req.params;
    const { shift_id } = req.body;

    const affected = await ShiftService.assignShiftToUser({
        user_id,
        org_id,
        shift_id
    });

    if (affected === 0) {
        return res.status(404).json({ ok: false, message: 'User not found or unauthorized' });
    }

    res.json({ ok: true, message: shift_id ? 'Shift assigned' : 'Shift unassigned' });
});
