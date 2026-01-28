import cron from 'node-cron';
import { knexDB } from '../database.js';

/**
 * Hourly Attendance Processor
 * Runs every hour to check which users have completed their logical "Yesterday"
 * matching the 2 AM processing window in their timezone.
 */
export async function processHourlyAttendance() {
    console.log('⏰ Hourly Attendance Check Started...');

    // 1. Get all active users with their Shift Policy and Org Timezone
    const users = await knexDB('users')
        .leftJoin('shifts', 'users.shift_id', 'shifts.shift_id')
        .leftJoin('user_work_locations', 'users.user_id', 'user_work_locations.user_id')
        .leftJoin('work_locations', 'user_work_locations.location_id', 'work_locations.location_id')
        .leftJoin('organizations', 'users.org_id', 'organizations.org_id')
        .select(
            'users.user_id',
            'users.org_id',
            'users.shift_id',
            'shifts.policy_rules', // Fetch JSON rules instead of missing columns
            'work_locations.timezone', // Location timezone (optional/unused priority)
            'organizations.timezone as org_timezone' // Fallback 2
        );

    for (const user of users) {
        try {
            // Determine Timezone Priority:
            // 1. Last Attendance Record (Metadata) -> Represents where they ARE right now
            // 2. Organization Default -> Fallback for new employees
            // 3. UTC -> Safety net

            let timeZone = user.org_timezone || 'UTC';

            // Fetch last attendance record to see where they last checked in
            const lastRecord = await knexDB('attendance_records')
                .where({ user_id: user.user_id })
                .orderBy('created_at', 'desc')
                .limit(1)
                .first();

            if (lastRecord && lastRecord.metadata) {
                try {
                    let meta = lastRecord.metadata;
                    // Handle stringified JSON if necessary (knex might auto-parse json columns, but safety first)
                    if (typeof meta === 'string') meta = JSON.parse(meta);

                    if (meta?.time_in?.timezone) {
                        timeZone = meta.time_in.timezone;
                    }
                } catch (e) {
                    console.warn(`Failed to parse metadata for user ${user.user_id}`, e);
                }
            }

            // Get Current Time in Target Timezone
            // We use 'en-US' locale hack to get params
            const nowInUserTZ = new Date(new Date().toLocaleString('en-US', { timeZone }));
            const currentHour = nowInUserTZ.getHours();

            // 🎯 Target Window: 02:00 AM - 02:59 AM
            // If it is 2 AM for the user, we process "Yesterday"
            if (currentHour === 2) {
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
    // 1. Check if Record Exists
    const record = await knexDB('daily_attendance')
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
        // --- LOGIC FOR EXISTING RECORDS (Finalization) ---
        // Example: If Time In exists but Time Out missing?
        if (record.time_in && !record.time_out) {
            console.log(`⚠️ User ${user.user_id} forgot to check out on ${dateStr}. Auto-closing.`);

            // Auto Checkout Logic (at shift end)
            const autoOutTime = `${dateStr} ${shiftEndTime}`;

            await knexDB('daily_attendance')
                .where({ attendance_id: record.attendance_id })
                .update({
                    time_out: autoOutTime,
                    status: 'Present', // Or 'Incomplete'
                    updated_at: knexDB.fn.now()
                });
        }
    } else {
        // --- LOGIC FOR MISSING RECORDS ---
        let status = 'Absent';
        let remarks = 'No show';

        // A. Check Holiday
        const holiday = await knexDB('holidays')
            .where({ org_id: user.org_id, holiday_date: dateStr })
            .first();

        if (holiday) {
            status = 'Holiday';
            remarks = holiday.holiday_name;
        }
        else {
            // B. Check Leave
            const leave = await knexDB('leave_requests')
                .where({ user_id: user.user_id, status: 'Approved' })
                .where('start_date', '<=', dateStr)
                .where('end_date', '>=', dateStr)
                .first();

            if (leave) {
                status = 'Leave';
                remarks = `${leave.leave_type} (${leave.pay_type})`;
            }
            else {
                // C. Check Weekend / Shift
                const dayName = new Date(dateStr).toLocaleDateString('en-US', { weekday: 'short' }); // "Mon"

                if (!workingDays.includes(dayName)) {
                    status = 'Weekend';
                    remarks = 'Weekly Off';
                } else if (dayName === 'Sat' && alternateSaturdays.enabled) {
                    // Check if this Saturday is an "Off" Saturday
                    // Need to calculate which Saturday of the month it is (1st, 2nd, etc.)
                    const d = new Date(dateStr);
                    const dayOfMonth = d.getDate();
                    const weekNum = Math.ceil(dayOfMonth / 7); // 1 to 5

                    if (alternateSaturdays.off.includes(weekNum)) {
                        status = 'Weekend';
                        remarks = `Saturday Off (Week ${weekNum})`;
                    }
                }
            }
        }

        // Insert Missing Record
        await knexDB('daily_attendance').insert({
            user_id: user.user_id,
            org_id: user.org_id,
            date: dateStr,
            status: status,
            created_at: knexDB.fn.now(),
            updated_at: knexDB.fn.now()
        });

        console.log(`📝 Marked User ${user.user_id} as ${status} for ${dateStr}`);
    }
}

// Initialize Cron
export function initAttendanceProcessor() {
    // Run every hour at minute 0
    cron.schedule('0 * * * *', processHourlyAttendance);
    console.log('🚀 Hourly Attendance Processor Scheduled');
}
