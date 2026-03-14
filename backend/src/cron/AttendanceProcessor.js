import cron from 'node-cron';
import { attendanceDB } from '../config/database.js';

/**
 * Hourly Attendance Processor
 * Runs every hour to check which users have completed their logical "Yesterday"
 * matching the processing window in their timezone.
 */
export async function processHourlyAttendance() {
    console.log('⏰ Hourly Attendance Check Started...');

    const users = await attendanceDB('users')
        .leftJoin('shifts', 'users.shift_id', 'shifts.shift_id')
        .leftJoin('user_work_locations', 'users.user_id', 'user_work_locations.user_id')
        .leftJoin('work_locations', 'user_work_locations.location_id', 'work_locations.location_id')
        .leftJoin('organizations', 'users.org_id', 'organizations.org_id')
        .select(
            'users.user_id',
            'users.org_id',
            'users.shift_id',
            'shifts.policy_rules',
            'shifts.processing_time',
            'work_locations.timezone',
            'organizations.timezone as org_timezone'
        );

    for (const user of users) {
        try {
            // Timezone Priority:
            // 1. Last Attendance Record (Metadata) -> where they ARE right now
            // 2. Organization Default -> fallback for new employees
            // 3. UTC -> safety net
            let timeZone = user.org_timezone || 'UTC';

            const lastRecord = await attendanceDB('attendance_records')
                .where({ user_id: user.user_id })
                .orderBy('created_at', 'desc')
                .limit(1)
                .first();

            if (lastRecord && lastRecord.metadata) {
                try {
                    let meta = lastRecord.metadata;
                    if (typeof meta === 'string') meta = JSON.parse(meta);
                    if (meta?.time_in?.timezone) {
                        timeZone = meta.time_in.timezone;
                    }
                } catch (e) {
                    console.warn(`Failed to parse metadata for user ${user.user_id}`, e);
                }
            }

            // Validate timezone
            try {
                Intl.DateTimeFormat(undefined, { timeZone });
            } catch (e) {
                timeZone = 'UTC';
            }

            const nowInUserTZ = new Date(new Date().toLocaleString('en-US', { timeZone }));
            const currentHour = nowInUserTZ.getHours();

            // Target Window: Shift's processing_time (default 02:00)
            let targetHour = 2;
            if (user.processing_time) {
                const [h] = user.processing_time.split(':');
                targetHour = parseInt(h, 10);
            }

            if (currentHour === targetHour) {
                const yesterday = new Date(nowInUserTZ);
                yesterday.setDate(yesterday.getDate() - 1);
                const targetDate = yesterday.toISOString().split('T')[0];

                await processUserAttendanceForDate(user, targetDate);
            }
        } catch (err) {
            console.error(`Failed to process user ${user.user_id}:`, err);
        }
    }

    console.log('✅ Hourly Attendance Check Completed.');
}

async function processUserAttendanceForDate(user, dateStr) {
    const record = await attendanceDB('daily_attendance')
        .where({ user_id: user.user_id, date: dateStr })
        .first();

    // Parse Shift Policy
    let workingDays = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    let shiftEndTime = '18:00:00';
    let alternateSaturdays = { enabled: false, off: [] };

    if (user.policy_rules) {
        try {
            const rules = typeof user.policy_rules === 'string' ? JSON.parse(user.policy_rules) : user.policy_rules;
            if (rules.working_days) workingDays = rules.working_days;
            if (rules.shift_timing?.end_time) shiftEndTime = rules.shift_timing.end_time;
            if (rules.alternate_saturdays) alternateSaturdays = rules.alternate_saturdays;
        } catch (e) {
            console.error(`Failed to parse policy rules for user ${user.user_id}`, e);
        }
    }

    if (record) {
        // Existing record: auto-close if missing time_out
        if (record.time_in && !record.time_out) {
            console.log(`⚠️ User ${user.user_id} forgot to check out on ${dateStr}. Auto-closing.`);

            const autoOutTime = `${dateStr} ${shiftEndTime}`;
            await attendanceDB('daily_attendance')
                .where({ attendance_id: record.attendance_id })
                .update({
                    time_out: autoOutTime,
                    status: 'Present',
                    updated_at: attendanceDB.fn.now()
                });
        }
    } else {
        // Missing record: determine status
        let status = 'Absent';
        let remarks = 'No show';

        // Check Holiday
        const holiday = await attendanceDB('holidays')
            .where({ org_id: user.org_id, holiday_date: dateStr })
            .first();

        if (holiday) {
            status = 'Holiday';
            remarks = holiday.holiday_name;
        } else {
            // Check Leave
            const leave = await attendanceDB('leave_requests')
                .where({ user_id: user.user_id, status: 'Approved' })
                .where('start_date', '<=', dateStr)
                .where('end_date', '>=', dateStr)
                .first();

            if (leave) {
                status = 'Leave';
                remarks = `${leave.leave_type} (${leave.pay_type})`;
            } else {
                // Check Weekend / Shift
                const dayName = new Date(dateStr).toLocaleDateString('en-US', { weekday: 'short' });

                if (!workingDays.includes(dayName)) {
                    status = 'Weekend';
                    remarks = 'Weekly Off';
                } else if (dayName === 'Sat' && alternateSaturdays.enabled) {
                    const d = new Date(dateStr);
                    const dayOfMonth = d.getDate();
                    const weekNum = Math.ceil(dayOfMonth / 7);

                    if (alternateSaturdays.off.includes(weekNum)) {
                        status = 'Weekend';
                        remarks = `Saturday Off (Week ${weekNum})`;
                    }
                }
            }
        }

        await attendanceDB('daily_attendance').insert({
            user_id: user.user_id,
            org_id: user.org_id,
            date: dateStr,
            status,
            created_at: attendanceDB.fn.now(),
            updated_at: attendanceDB.fn.now()
        });

        console.log(`📝 Marked User ${user.user_id} as ${status} for ${dateStr}`);
    }
}

/**
 * Initialize the hourly attendance processor cron job.
 */
export function initAttendanceProcessor() {
    cron.schedule('0 * * * *', processHourlyAttendance);
    console.log('🚀 Hourly Attendance Processor Scheduled');
}
