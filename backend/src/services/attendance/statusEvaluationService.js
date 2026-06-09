import { attendanceDB } from '../../config/database.js';
import * as ShiftService from './shiftManagementService.js';

/**
 * Status Evaluation Service
 * 
 * Centralized service for all attendance status logic:
 * - Late arrival calculation
 * - Single-session status evaluation
 * - Multi-session (batch) evaluation
 * - Daily status derivation
 * - Session context building
 */

//  Helpers─────────────────────────────────────────────────────────────
/**
 * Calculate duration in hours between two timestamps.
 * @param {string|Date} start
 * @param {string|Date} end
 * @returns {number}
 */
export function calculateDurationHours(start, end) {
    if (!start || !end) return 0;
    const diff = new Date(end) - new Date(start);
    return parseFloat((diff / (1000 * 60 * 60)).toFixed(2));
}

//  Late Arrival
/**
 * Calculate late arrival and grace period compliance.
 * @param {string} localTime - Local time in ISO format
 * @param {Object} rules - Unified shift rules
 * @returns {{ minutesLate: number, isLate: boolean, gracePeriod: number, shiftStartTime: string }}
 */
export function calculateLateArrival(localTime, rules) {
    let minutesLate = 0;
    const timing = rules?.shift_timing || {};
    const startTimeStr = timing.start_time;

    if (startTimeStr) {
        const localTimePart = localTime.split('T')[1]?.split('.')[0] || localTime;

        const [curH, curM] = localTimePart.split(':').map(Number);
        const currentMinutes = curH * 60 + curM;

        const [shiftH, shiftM] = startTimeStr.split(':').map(Number);
        const shiftMinutes = shiftH * 60 + shiftM;

        if (currentMinutes > shiftMinutes) {
            minutesLate = currentMinutes - shiftMinutes;
        }
    }

    const gracePeriod = Number(rules?.grace_period?.minutes || 0);
    const isLate = minutesLate > gracePeriod;

    return {
        minutesLate,
        isLate,
        gracePeriod,
        shiftStartTime: startTimeStr
    };
}

// ─────────────────────────────────────────────────────────────
// Single Session Status
// ─────────────────────────────────────────────────────────────

/**
 * Evaluate status for a single session based on shift rules and session context.
 * @param {Object} rules - Shift rules
 * @param {Object} data - Session data (total_hours, total_hours_today, minutes_late, event_type)
 * @returns {"PRESENT"|"LATE"|"OVERTIME"|"ABSENT"}
 */
export function evaluateStatus(rules, data) {
    // 1. Overtime Check (Priority)
    // Use total_hours_today if available, otherwise fallback to session total_hours
    const rawTotal = data.total_hours_today ?? data.total_hours ?? 0;
    const totalHours = Number(rawTotal) || 0;

    // Calculate expected shift hours dynamically from timing
    const timing = rules?.shift_timing || {};
    const [sH, sM] = (timing.start_time || '09:00:00').split(':').map(Number);
    const [eH, eM] = (timing.end_time || '18:00:00').split(':').map(Number);
    let expectedHours = ((eH * 60 + eM) - (sH * 60 + sM)) / 60;
    if (expectedHours < 0) expectedHours += 24;

    // Threshold defaults to 8 if missing, NaN, or 0
    let threshold = Number(rules?.overtime?.threshold);
    if (isNaN(threshold) || threshold <= 0) threshold = 8;

    // The overtime threshold should not be less than the expected hours of the shift.
    threshold = Math.max(threshold, expectedHours);

    // Buffer: time after shift end before overtime triggers (default 30 min = 0.5 hr)
    const buffer = Number(rules?.overtime?.buffer ?? 0.5);

    if (rules?.overtime?.enabled !== false && totalHours >= (threshold + buffer)) {
        return "OVERTIME";
    }

    // 2. Absent Check (Less than 4 hours total at checkout)
    if (totalHours < 4 && data.event_type === "time_out") {
        return "ABSENT";
    }

    // 3. Late Check
    const graceMins = Number(rules.grace_period?.minutes || 0);
    const minutesLate = Number(data.minutes_late || 0);

    if (minutesLate > graceMins) {
        return "LATE";
    }

    return "PRESENT";
}

// ─────────────────────────────────────────────────────────────
// Overtime Calculation
// ─────────────────────────────────────────────────────────────

/**
 * Calculate overtime hours based on total hours worked and shift rules.
 * @param {number} totalHours
 * @param {Object} rules - Shift rules
 * @returns {number} Overtime hours
 */
export function calculateOvertime(totalHours, rules) {
    const timing = rules?.shift_timing || {};
    const [sH, sM] = (timing.start_time || '09:00:00').split(':').map(Number);
    const [eH, eM] = (timing.end_time || '18:00:00').split(':').map(Number);
    let expectedHours = ((eH * 60 + eM) - (sH * 60 + sM)) / 60;
    if (expectedHours < 0) expectedHours += 24;

    let threshold = Number(rules?.overtime?.threshold || 8);
    threshold = Math.max(threshold, expectedHours);

    const buffer = Number(rules?.overtime?.buffer ?? 0.5);
    const isEnabled = rules?.overtime?.enabled !== false;

    if (isEnabled && totalHours >= (threshold + buffer)) {
        return parseFloat((totalHours - threshold).toFixed(2));
    }
    return 0;
}

// ─────────────────────────────────────────────────────────────
// Batch Session Evaluation
// ─────────────────────────────────────────────────────────────

/**
 * Evaluate a list of sessions for a single day.
 * Calculates duration, late minutes, and status for each session,
 * maintaining running totals for accurate overtime detection.
 * 
 * @param {Object} rules - Shift rules
 * @param {Array<{time_in: string, time_out: string}>} sessions - Sorted sessions
 * @param {string} dateStr - YYYY-MM-DD
 * @returns {Array<Object>} Sessions enriched with duration_hours, late_minutes, status
 */
export function evaluateSessionList(rules, sessions, dateStr) {
    let runningTotalHours = 0;

    return sessions.map((s, idx) => {
        const tIn = typeof s.time_in === 'string' && s.time_in.length === 5 ? s.time_in + ':00' : s.time_in;
        const tOut = typeof s.time_out === 'string' && s.time_out.length === 5 ? s.time_out + ':00' : s.time_out;

        // For overnight sessions (e.g. 22:30 → 06:30), time_out is on the NEXT calendar day.
        // Detect this by comparing the raw time strings; if end ≤ start, add 1 day to the end date.
        const nextDateStr = (() => {
            const d = new Date(`${dateStr}T12:00:00`);
            d.setDate(d.getDate() + 1);
            return d.toISOString().split('T')[0];
        })();
        const isOvernight = tOut <= tIn;
        const outDateStr = isOvernight ? nextDateStr : dateStr;

        const durationHours = calculateDurationHours(`${dateStr} ${tIn}`, `${outDateStr} ${tOut}`);
        runningTotalHours += durationHours;

        // Late Calculation (only for the first session of the day)
        let lateMins = 0;
        if (idx === 0) {
            const lateCheck = calculateLateArrival(`${dateStr}T${tIn}`, rules);
            lateMins = lateCheck.minutesLate;
        }

        // Determine Session Status
        const status = evaluateStatus(rules, {
            total_hours: durationHours,
            total_hours_today: runningTotalHours,
            minutes_late: lateMins,
            event_type: "time_out"
        });

        return {
            ...s,
            time_in: `${dateStr} ${tIn}`,
            time_out: `${outDateStr} ${tOut}`,
            duration_hours: durationHours,
            total_hours_today: runningTotalHours,
            late_minutes: lateMins,
            status
        };
    });
}


// ─────────────────────────────────────────────────────────────
// Daily Status Derivation
// ─────────────────────────────────────────────────────────────

const STATUS_PRIORITY = { "MISSED_PUNCH": 5, "OVERTIME": 4, "LATE": 3, "ABSENT": 2, "PRESENT": 1 };

/**
 * Derive the daily status from a list of attendance records.
 * Returns the highest-priority status found across all sessions.
 * 
 * @param {Array<{status: string}>} records - Session records for the day
 * @returns {string} The derived daily status
 */
export function deriveDailyStatus(records) {
    let highestPriority = 0;
    let calculatedStatus = "PRESENT";

    records.forEach(r => {
        const p = STATUS_PRIORITY[r.status] || 0;
        if (p > highestPriority) {
            highestPriority = p;
            calculatedStatus = r.status;
        }
    });

    return calculatedStatus;
}

// ─────────────────────────────────────────────────────────────
// Session Context
// ─────────────────────────────────────────────────────────────

/**
 * Build session context for a user's day.
 * Aggregates all sessions from the DB to provide running totals.
 *
 * @param {number} user_id
 * @param {string|Date} localTime - Current local time
 * @param {string} eventType - "time_in" or "time_out"
 * @returns {Promise<Object>} Session context data
 */
export async function buildSessionContext(user_id, localTime, eventType) {
    // Ensure localTime is a string in ISO format without milliseconds
    const timeStr = (localTime instanceof Date && typeof localTime.toISOString === 'function')
        ? localTime.toISOString()
        : String(localTime);
    const sanitizedLocalTime = timeStr.replace('T', ' ').split('.')[0];

    // Extract date portion from the local time string for DB filtering
    const dateOnly = sanitizedLocalTime.split(' ')[0];

    const todaySessions = await attendanceDB("attendance_records")
        .where({ user_id })
        .whereRaw("DATE(time_in) = ?", [dateOnly])
        .orderBy("time_in", "asc");

    const isFirstSession = todaySessions.length === 0;
    const sessionNumber = todaySessions.length + 1;

    // Calculate total hours worked today using centralized helper
    let totalHoursToday = 0;
    todaySessions.forEach(session => {
        if (session.time_out) {
            totalHoursToday += calculateDurationHours(session.time_in, session.time_out);
        }
    });

    const firstTimeIn = todaySessions[0]?.time_in;
    const lastTimeOut = todaySessions[todaySessions.length - 1]?.time_out;

    return {
        is_first_session: isFirstSession,
        session_number: sessionNumber,
        total_sessions: todaySessions.length,

        // Time data
        first_time_in: firstTimeIn,
        last_time_out: lastTimeOut,

        // Aggregates
        total_hours_today: parseFloat(totalHoursToday.toFixed(2)),
        first_session_late_mins: todaySessions[0]?.late_minutes || 0,

        // Event context
        event_type: eventType
    };
}



// ─────────────────────────────────────────────────────────────
// Dynamic Daily Summary
// ─────────────────────────────────────────────────────────────

/**
 * Normalize a date value to YYYY-MM-DD string.
 */
function normalizeDate(d) {
    if (!d) return null;
    if (typeof d === 'string') return d.split('T')[0].split(' ')[0];
    if (d instanceof Date || (typeof d === 'object' && typeof d.getUTCFullYear === 'function')) {
        const year = d.getUTCFullYear();
        const month = String(d.getUTCMonth() + 1).padStart(2, '0');
        const day = String(d.getUTCDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }
    try {
        const dateObj = new Date(d);
        if (isNaN(dateObj.getTime())) return null;
        const year = dateObj.getUTCFullYear();
        const month = String(dateObj.getUTCMonth() + 1).padStart(2, '0');
        const day = String(dateObj.getUTCDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    } catch {
        return null;
    }
}

/**
 * Evaluate the attendance status for a single user on a single date.
 * Uses cron-processed daily_attendance when available, otherwise derives dynamically.
 */
function evaluateDayStatus({ dateStr, todayStr, dayRecords, dailyRecord, holiday, leave, rules }) {
    let status = null;
    let totalHours = 0;
    let firstIn = null;
    let lastOut = null;
    let lateMinutes = 0;
    let lateReason = '';
    let overtimeHours = 0;

    if (dailyRecord && dateStr < todayStr) {
        // ── Past date already processed by cron ──
        status = dailyRecord.status;
        totalHours = Number(dailyRecord.total_hours) || 0;
        firstIn = dailyRecord.first_in || null;
        lastOut = dailyRecord.last_out || null;
        overtimeHours = Number(dailyRecord.overtime_hours) || 0;
        if (dayRecords.length > 0) {
            lateMinutes = dayRecords[0].late_minutes || 0;
            lateReason = dayRecords[0].late_reason || '';
        }
    } else if (dayRecords.length > 0) {
        // ── Has punch records – derive status dynamically ──
        const hasOpenSession = dayRecords.some(r => !r.time_out && r.status !== 'MISSED_PUNCH');
        const hasMissedPunch = dayRecords.some(r => r.status === 'MISSED_PUNCH');

        for (const r of dayRecords) {
            if (r.time_in && r.time_out) {
                totalHours += calculateDurationHours(r.time_in, r.time_out);
            } else if (r.time_in && !r.time_out && r.status !== 'MISSED_PUNCH') {
                // Active session – count running hours
                totalHours += calculateDurationHours(r.time_in, new Date());
            }
        }
        totalHours = parseFloat(totalHours.toFixed(2));

        firstIn = dayRecords[0].time_in;
        lastOut = dayRecords[dayRecords.length - 1].time_out;
        lateMinutes = dayRecords[0].late_minutes || 0;
        lateReason = dayRecords[0].late_reason || '';
        overtimeHours = calculateOvertime(totalHours, rules);

        const graceMins = Number(rules.grace_period?.minutes || 0);

        if (hasOpenSession) {
            status = lateMinutes > graceMins ? 'Late Active' : 'Active';
        } else if (hasMissedPunch) {
            status = 'MISSED_PUNCH';
        } else {
            const derived = deriveDailyStatus(dayRecords);
            if (derived === 'PRESENT' && lateMinutes > graceMins) {
                status = 'LATE';
            } else {
                status = derived;
            }
            if (overtimeHours > 0 && (status === 'PRESENT' || status === 'LATE')) {
                status = 'OVERTIME';
            }
        }
    } else {
        // ── No punch records – determine from shift policies ──
        const dayType = ShiftService.getDayType(dateStr, rules.week_off_policy);

        if (holiday) {
            // National holidays take precedence over week-off (e.g. holiday on a Sunday)
            status = 'HOLIDAY';
        } else if (dayType === 'week_off') {
            const isSunday = new Date(dateStr).getDay() === 0;
            status = isSunday ? 'HOLIDAY' : 'WEEK_OFF';
        } else if (leave) {
            status = 'LEAVE';
        } else if (dateStr > todayStr) {
            // Future working day – no status yet
            status = null;
        } else {
            status = 'ABSENT';
        }
    }

    const expectedHours = ShiftService.getExpectedHours(dateStr, rules.week_off_policy, rules);

    // Serialize Date objects to plain "YYYY-MM-DD HH:mm:ss" strings so the
    // frontend receives the stored local time without UTC re-interpretation.
    const toPlainStr = (v) => {
        if (!v) return null;
        if (v instanceof Date) return v.toISOString().replace('T', ' ').split('.')[0];
        return String(v).split('.')[0];
    };

    return {
        status,
        total_hours: totalHours,
        first_in: toPlainStr(firstIn),
        last_out: toPlainStr(lastOut),
        late_minutes: lateMinutes,
        late_reason: lateReason,
        overtime_hours: overtimeHours,
        expected_hours: expectedHours
    };
}

// ─────────────────────────────────────────────────────────────
// No-Show Status Resolution
// ─────────────────────────────────────────────────────────────

/**
 * Resolve the attendance status for a day where the employee did not punch in at all.
 * Checks week-off policy, national/org holidays, and approved leaves in priority order.
 *
 * This is the single source of truth for no-show logic, shared by both the
 * nightly cron (AttendanceProcessor) and the dynamic daily summary view.
 *
 * Priority (highest → lowest):
 *   1. National/org holiday   → HOLIDAY
 *   2. Week-off policy        → WEEK_OFF (or HOLIDAY for Sunday)
 *   3. Approved leave         → LEAVE
 *   4. Half-day week-off      → ABSENT (employee was expected but didn't show)
 *   5. Regular working day    → ABSENT
 *
 * @param {Object} params
 * @param {string}      params.dateStr  - YYYY-MM-DD string of the day to evaluate
 * @param {Object}      params.rules    - Shift rules from ShiftService.getShiftRules()
 * @param {Object|null} params.holiday  - Holiday record from DB (or null)
 * @param {Object|null} params.leave    - Approved leave record covering this date (or null)
 * @returns {{ status: string, remarks: string }}
 */
export function resolveNoShowStatus({ dateStr, rules, holiday, leave }) {
    let status = 'ABSENT';
    let remarks = 'No show';

    const dayType = ShiftService.getDayType(dateStr, rules.week_off_policy);
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const dayName = dayNames[new Date(dateStr).getDay()];

    // 1. Holiday takes highest priority (overrides even week-off)
    if (holiday) {
        return { status: 'HOLIDAY', remarks: holiday.holiday_name };
    }

    // 2. Week-off policy
    if (dayType === 'week_off') {
        if (dayName === 'Sun') {
            return { status: 'HOLIDAY', remarks: 'Sunday - Holiday' };
        }
        return { status: 'WEEK_OFF', remarks: `${dayName} - Weekly Off` };
    }

    // 3. Half-day week-off — employee was still expected; treat as absent
    if (dayType === 'half_day') {
        status = 'ABSENT';
        remarks = `${dayName} - Half Day (No show)`;
    }

    // 4. Approved leave (only overrides ABSENT, not WEEK_OFF / HOLIDAY)
    if (status === 'ABSENT' && leave) {
        return { status: 'LEAVE', remarks: `${leave.leave_type} (${leave.pay_type})` };
    }

    return { status, remarks };
}

/**
 * Compute daily attendance summaries for one or all users across a date range.
 * Dynamically evaluates status using shift week-off policies, organization
 * holidays, approved leaves, and real-time punch data for dates not yet
 * processed by the hourly cron.
 *
 * @param {Object} params
 * @param {number} params.org_id
 * @param {number} [params.user_id] - Single user (user endpoint) or null (admin, all users)
 * @param {string} params.date_from - YYYY-MM-DD
 * @param {string} params.date_to   - YYYY-MM-DD
 * @returns {Promise<Array<{user_id,user_name,desg_name,dept_name,profile_image_url,shift_id,days:Array}>>}
 */
export async function getDailySummary({ org_id, user_id = null, date_from, date_to }) {
    // 1. Fetch users with shift + designation info
    let usersQuery = attendanceDB('users')
        .leftJoin('shifts', 'users.shift_id', 'shifts.shift_id')
        .leftJoin('designations', 'users.desg_id', 'designations.desg_id')
        .where('users.org_id', org_id)
        .where(function () { this.where('users.is_active', 1).orWhereNull('users.is_active'); })
        .where(function () { this.where('users.is_deleted', 0).orWhereNull('users.is_deleted'); })
        .select(
            'users.user_id', 'users.user_name', 'users.org_id', 'users.shift_id',
            'users.profile_image_url',
            'designations.desg_name',
            'shifts.shift_name',
            'shifts.policy_rules'
        );

    if (user_id) usersQuery = usersQuery.where('users.user_id', user_id);
    const users = await usersQuery;

    // Try to resolve department names (graceful if table missing)
    let deptMap = {};
    try {
        const deptRows = await attendanceDB('users')
            .leftJoin('departments', 'users.dept_id', 'departments.dept_id')
            .whereIn('users.user_id', users.map(u => u.user_id))
            .select('users.user_id', 'departments.dept_name');
        for (const r of deptRows) if (r.dept_name) deptMap[r.user_id] = r.dept_name;
    } catch (_) { /* departments table may not exist */ }

    if (users.length === 0) return [];

    // 2. Fetch all supporting data in parallel
    const [records, dailyRecords, holidays, leaves] = await Promise.all([
        attendanceDB('attendance_records')
            .where('org_id', org_id)
            .whereRaw('DATE(time_in) >= ?', [date_from])
            .whereRaw('DATE(time_in) <= ?', [date_to])
            .modify(qb => { if (user_id) qb.where('user_id', user_id); })
            .orderBy('time_in', 'asc'),
        attendanceDB('daily_attendance')
            .where('org_id', org_id)
            .where('date', '>=', date_from)
            .where('date', '<=', date_to)
            .modify(qb => { if (user_id) qb.where('user_id', user_id); }),
        attendanceDB('holidays')
            .where('org_id', org_id)
            .where('holiday_date', '>=', date_from)
            .where('holiday_date', '<=', date_to),
        attendanceDB('leave_requests')
            .where('status', 'Approved')
            .where('start_date', '<=', date_to)
            .where('end_date', '>=', date_from)
            .modify(qb => {
                if (user_id) qb.where('user_id', user_id);
                else qb.whereIn('user_id', users.map(u => u.user_id));
            })
    ]);

    // 3. Index data for O(1) lookups
    const recordsByUserDate = {};
    for (const r of records) {
        const ds = normalizeDate(r.time_in);
        const k = `${r.user_id}_${ds}`;
        if (!recordsByUserDate[k]) recordsByUserDate[k] = [];
        recordsByUserDate[k].push(r);
    }

    const dailyByUserDate = {};
    for (const d of dailyRecords) dailyByUserDate[`${d.user_id}_${normalizeDate(d.date)}`] = d;

    const holidayByDate = {};
    for (const h of holidays) holidayByDate[normalizeDate(h.holiday_date)] = h;

    const leavesByUser = {};
    for (const l of leaves) {
        if (!leavesByUser[l.user_id]) leavesByUser[l.user_id] = [];
        leavesByUser[l.user_id].push(l);
    }

    // 4. Generate date array
    const dates = [];
    const cur = new Date(date_from + 'T12:00:00');
    const endDate = new Date(date_to + 'T12:00:00');
    while (cur <= endDate) { dates.push(cur.toISOString().split('T')[0]); cur.setDate(cur.getDate() + 1); }

    // Fetch organization timezone for timezone-aware todayStr calculation
    let timezone = 'UTC';
    try {
        const org = await attendanceDB('organizations')
            .where('org_id', org_id)
            .select('timezone')
            .first();
        if (org && org.timezone) {
            timezone = org.timezone;
        }
    } catch (err) {
        console.warn(`Failed to fetch organization ${org_id} timezone, defaulting to UTC`, err);
    }

    let todayStr;
    try {
        const formatter = new Intl.DateTimeFormat('en-US', {
            timeZone: timezone,
            year: 'numeric',
            month: '2-digit',
            day: '2-digit'
        });
        const parts = formatter.formatToParts(new Date());
        const year = parts.find(p => p.type === 'year').value;
        const month = parts.find(p => p.type === 'month').value;
        const day = parts.find(p => p.type === 'day').value;
        todayStr = `${year}-${month}-${day}`;
    } catch (e) {
        todayStr = new Date().toISOString().split('T')[0];
    }


    // 5. Evaluate each user × date
    return users.map(user => {
        const rules = ShiftService.getShiftRules(user);
        const days = dates.map(dateStr => {
            const key = `${user.user_id}_${dateStr}`;
            const dayRecords = recordsByUserDate[key] || [];
            const dailyRecord = dailyByUserDate[key];
            const holiday = holidayByDate[dateStr];
            const userLeaves = leavesByUser[user.user_id] || [];
            const leave = userLeaves.find(l => {
                const s = normalizeDate(l.start_date);
                const e = normalizeDate(l.end_date);
                return dateStr >= s && dateStr <= e;
            });

            const result = evaluateDayStatus({ dateStr, todayStr, dayRecords, dailyRecord, holiday, leave, rules });
            // Serialize time fields to plain strings (prevent UTC shift from JS Date serialization)
            const serializedSessions = dayRecords.map(r => ({
                ...r,
                time_in: r.time_in
                    ? (r.time_in instanceof Date
                        ? r.time_in.toISOString().replace('T', ' ').split('.')[0]
                        : String(r.time_in).split('.')[0])
                    : null,
                time_out: r.time_out
                    ? (r.time_out instanceof Date
                        ? r.time_out.toISOString().replace('T', ' ').split('.')[0]
                        : String(r.time_out).split('.')[0])
                    : null,
            }));
            return { date: dateStr, ...result, sessions: serializedSessions };
        });

        return {
            user_id: user.user_id,
            user_name: user.user_name,
            desg_name: user.desg_name || null,
            dept_name: deptMap[user.user_id] || null,
            profile_image_url: user.profile_image_url || null,
            shift_id: user.shift_id,
            days
        };
    });
}
