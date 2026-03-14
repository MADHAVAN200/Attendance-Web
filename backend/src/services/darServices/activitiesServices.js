import { attendanceDB } from '../../config/database.js';

// Helper: Get Org Buffer Settings
export async function getOrgBuffer(org_id) {
    const settings = await attendanceDB("dar_settings").where({ org_id }).first();
    return settings ? settings.buffer_minutes : 30;
}

// Helper: Validation Logic
export async function validateActivityTime(user_id, date, start_time, end_time, buffer_minutes) {
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];

    if (date > todayStr) {
        return { valid: true, mode: 'PLANNING' };
    }

    const activityEndDateTime = new Date(`${date}T${end_time}`);
    const allowedEndDateTime = new Date(now.getTime() + buffer_minutes * 60000);

    if (date === todayStr) {
        if (activityEndDateTime > allowedEndDateTime) {
            return { valid: false, message: `Cannot log future tasks (Buffer: ${buffer_minutes}m). Allowed until: ${allowedEndDateTime.toLocaleTimeString()}` };
        }
    }

    const attendance = await attendanceDB("attendance_records")
        .where("user_id", user_id)
        .whereRaw("DATE(time_in) = ?", [date])
        .orderBy("time_in", "asc");

    if (!attendance || attendance.length === 0) {
        return { valid: false, message: "No attendance record found for this date." };
    }

    const getMinutes = (timeStr) => {
        if (!timeStr) return null;
        if (timeStr.includes('T') || timeStr.includes('-')) {
            const d = new Date(timeStr);
            return d.getHours() * 60 + d.getMinutes();
        }
        const [h, m] = timeStr.split(':').map(Number);
        return h * 60 + m;
    };

    const startMins = getMinutes(start_time);
    const endMins = getMinutes(end_time);

    let isWithinSession = false;

    for (const session of attendance) {
        const sessionStart = new Date(session.time_in);
        const sessStartMins = sessionStart.getHours() * 60 + sessionStart.getMinutes();

        let sessEndMins = 24 * 60;
        if (session.time_out) {
            const sessionEnd = new Date(session.time_out);
            sessEndMins = sessionEnd.getHours() * 60 + sessionEnd.getMinutes();
        }

        if (startMins >= sessStartMins && endMins <= sessEndMins) {
            isWithinSession = true;
            break;
        }
    }

    if (!isWithinSession) {
        return { valid: false, message: `Task time (${start_time}-${end_time}) must be within a valid 'Time In' session.` };
    }

    return { valid: true, mode: 'EXECUTION' };
}

// Helper: Shared Validation & Status Determination
export async function processActivityValidation(org_id, user_id, body) {
    const { activity_date, start_time, end_time } = body;
    const buffer = await getOrgBuffer(org_id);
    const check = await validateActivityTime(user_id, activity_date, start_time, end_time, buffer);

    if (!check.valid) {
        throw new Error(check.message);
    }

    return check.mode === 'PLANNING' ? 'PLANNED' : 'COMPLETED';
}

export async function createActivity({ org_id, user_id, activity_date, start_time, end_time, title, description, activity_type, status }) {
    const [activity_id] = await attendanceDB("daily_activities").insert({
        org_id,
        user_id,
        activity_date,
        start_time,
        end_time,
        title,
        description,
        activity_type,
        status,
        created_at: attendanceDB.fn.now()
    });
    return activity_id;
}

export async function updateActivity({ activity_id, org_id, user_id, activity_date, start_time, end_time, title, description, activity_type, status }) {
    await attendanceDB("daily_activities")
        .where({ activity_id, org_id, user_id })
        .update({
            activity_date,
            start_time,
            end_time,
            title,
            description,
            activity_type,
            status,
            updated_at: attendanceDB.fn.now()
        });
}

export async function deleteActivity({ activity_id, org_id, user_id }) {
    return attendanceDB("daily_activities")
        .where({ activity_id, org_id, user_id })
        .del();
}

export async function listActivities({ org_id, user_id, date, date_from, date_to }) {
    let query = attendanceDB("daily_activities")
        .select(
            "*",
            attendanceDB.raw("DATE_FORMAT(activity_date, '%Y-%m-%d') as activity_date")
        )
        .where({ org_id, user_id });

    if (date) {
        query.where("activity_date", date);
    } else if (date_from && date_to) {
        query.whereBetween("activity_date", [date_from, date_to]);
    }

    return query.orderBy("activity_date", "asc").orderBy("start_time", "asc");
}

export async function getAllActivitiesAdmin({ org_id, date, startDate, endDate }) {
    let query = attendanceDB('daily_activities as da')
        .join('users as u', 'da.user_id', 'u.user_id')
        .leftJoin('departments as dep', 'u.dept_id', 'dep.dept_id')
        .leftJoin('shifts as s', 'u.shift_id', 's.shift_id')
        .select(
            'da.*',
            'u.user_name',
            'u.user_type as user_role',
            'u.email as user_email',
            'dep.dept_name as user_dept',
            's.shift_name as user_shift_name'
        )
        .where('da.org_id', org_id)
        .where('da.status', 'COMPLETED');

    if (date) {
        query = query.where('da.activity_date', date);
    } else if (startDate && endDate) {
        query = query.whereBetween('da.activity_date', [startDate, endDate]);
    }

    return query.orderBy('da.activity_date', 'desc').orderBy('u.user_name', 'asc');
}