import { attendanceDB } from '../../config/database.js';

/**
 * Get all shifts for an organization
 */
export async function getShiftsForOrg(org_id) {
    const shifts = await attendanceDB('shifts').where({ org_id });

    // Parse JSON rules for frontend compatibility
    return shifts.map(s => {
        const rules = typeof s.policy_rules === 'string' ? JSON.parse(s.policy_rules) : (s.policy_rules || {});
        return {
            shift_id: s.shift_id,
            shift_name: s.shift_name,
            org_id: s.org_id,
            // Map JSON back to legacy fields for frontend
            start_time: rules.shift_timing?.start_time || null,
            end_time: rules.shift_timing?.end_time || null,
            grace_period_mins: rules.grace_period?.minutes || 0,
            is_overtime_enabled: rules.overtime?.enabled ? 1 : 0,
            overtime_threshold_hours: rules.overtime?.threshold || 8.0,
            policy_rules: rules
        };
    });
}

/**
 * Create a new shift
 */
export async function createShift({ org_id, shift_name, start_time, end_time, grace_period_mins, is_overtime_enabled, overtime_threshold_hours, policy_rules }) {
    // Bundle columns into JSON logic structure
    const rules = policy_rules || {};
    const finalRules = {
        ...rules,
        shift_timing: {
            start_time,
            end_time
        },
        grace_period: {
            minutes: Number(grace_period_mins) || 0
        },
        overtime: {
            enabled: is_overtime_enabled ? true : false,
            threshold: Number(overtime_threshold_hours) || 8
        },
        entry_requirements: rules.entry_requirements || { selfie: true, geofence: true }
    };

    const [id] = await attendanceDB('shifts').insert({
        org_id,
        shift_name,
        policy_rules: JSON.stringify(finalRules)
    });

    return id;
}

/**
 * Update an existing shift
 */
export async function updateShift({ shift_id, org_id, shift_name, policy_rules }) {
    const updates = {
        shift_name,
        policy_rules: JSON.stringify(policy_rules)
    };

    const affected = await attendanceDB('shifts')
        .where({ shift_id, org_id })
        .update(updates);

    return affected;
}

/**
 * Delete a shift
 */
export async function deleteShift({ shift_id, org_id }) {
    // Check if shift is assigned to any user
    const usersCount = await attendanceDB('users')
        .where({ shift_id })
        .count('user_id as count')
        .first();

    if (usersCount.count > 0) {
        throw new Error(`Cannot delete shift. It is assigned to ${usersCount.count} users.`);
    }

    const affected = await attendanceDB('shifts')
        .where({ shift_id, org_id })
        .del();

    return affected;
}

/**
 * Get all users with their shift assignments
 */
export async function getUsersWithShifts(org_id) {
    const users = await attendanceDB('users')
        .leftJoin('designations', 'users.desg_id', 'designations.desg_id')
        .where('users.org_id', org_id)
        .select(
            'users.user_id',
            'users.user_name',
            'users.shift_id',
            'users.profile_image_url',
            'designations.desg_name'
        )
        .orderBy('users.user_name', 'asc');

    return users;
}

/**
 * Assign or unassign a shift to a user
 */
export async function assignShiftToUser({ user_id, org_id, shift_id }) {
    const affected = await attendanceDB('users')
        .where({ user_id, org_id })
        .update({ shift_id: shift_id || null });

    return affected;
}
