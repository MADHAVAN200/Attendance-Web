import { attendanceDB } from '../../config/database.js';

/**
 * Shift Management Service
 * Handles shift timing, late calculation, and session context
 */

/**
 * Get shift rules from shift object
 * Returns shift configuration or default
 */
export async function getShiftRules(shift) {
    if (!shift) {
        return getDefaultShiftConfig();
    }

    // Parse policy_rules if it's a string
    let rules = shift.policy_rules;
    if (typeof rules === 'string') {
        try {
            rules = JSON.parse(rules);
        } catch (e) {
            rules = null;
        }
    }

    return rules || getDefaultShiftConfig();
}

/**
 * Default shift configuration
 */
function getDefaultShiftConfig() {
    return {
        shift_timing: {
            start_time: "09:00:00",
            end_time: "18:00:00"
        },
        grace_period: {
            minutes: 10
        },
        overtime: {
            enabled: true,
            threshold: 8
        }
    };
}

/**
 * Calculate late arrival and grace period compliance
 * @param {string} localTime - Local time in ISO format
 * @param {Object} shiftRules - Shift configuration rules
 * @returns {Object} Late calculation result
 */
export function calculateLateArrival(localTime, shiftRules) {
    let minutesLate = 0;
    const timing = shiftRules?.shift_timing || {};
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
    
    const gracePeriod = shiftRules?.grace_period?.minutes || 0;
    const isLate = minutesLate > gracePeriod;

    return {
        minutesLate,
        isLate,
        gracePeriod,
        shiftStartTime: startTimeStr
    };
}

/**
 * Build session context for a user's day
 * Aggregates timing data across all sessions
 * @param {number} user_id 
 * @param {string} localTime - Current local time
 * @param {string} eventType - "time_in" or "time_out"
 * @returns {Promise<Object>} Session context data
 */
export async function buildSessionContext(user_id, localTime, eventType) {
    const todaySessions = await attendanceDB("attendance_records")
        .where({ user_id })
        .whereRaw("DATE(time_in) = DATE(?)", [localTime])
        .orderBy("time_in", "asc");

    const isFirstSession = todaySessions.length === 0;
    const sessionNumber = todaySessions.length + 1;

    // Calculate total hours worked today
    let totalHoursToday = 0;
    todaySessions.forEach(session => {
        if (session.time_out) {
            const duration = (new Date(session.time_out) - new Date(session.time_in)) / (1000 * 60 * 60);
            totalHoursToday += duration;
        }
    });

    const firstTimeIn = todaySessions[0]?.time_in;
    const lastTimeOut = todaySessions[todaySessions.length - 1]?.time_out;

    // Extract hours from timestamps for rule evaluation
    let firstTimeInHour = null;
    let lastTimeOutHour = null;

    if (firstTimeIn) {
        firstTimeInHour = new Date(firstTimeIn).getHours();
    }
    if (lastTimeOut) {
        lastTimeOutHour = new Date(lastTimeOut).getHours();
    }

    return {
        is_first_session: isFirstSession,
        session_number: sessionNumber,
        total_sessions: todaySessions.length,
        
        // Time data
        first_time_in: firstTimeIn,
        last_time_out: lastTimeOut,
        first_time_in_hour: firstTimeInHour,
        last_time_out_hour: lastTimeOutHour,
        
        // Aggregates
        total_hours_today: parseFloat(totalHoursToday.toFixed(2)),
        first_session_late_mins: todaySessions[0]?.late_minutes || 0,
        
        // Event context
        event_type: eventType
    };
}
