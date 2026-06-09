import { attendanceDB } from '../../config/database.js';
import { verifyUserGeofence } from "./geofencing.js";

/**
 * Shift Management Service
 * Handles shift timing, late calculation, status evaluation, session context,
 * and the Week-Off Policy Engine.
 *
 * Week-Off Policy:
 * Stored as `week_off_policy` inside policy_rules JSON — a flat array of entries:
 * [
 *   { day: 0, type: "full", frequency: "every"  },  // Sunday always off
 *   { day: 6, type: "full", frequency: [2, 4]   },  // 2nd & 4th Saturday off
 *   { day: 6, type: "half", frequency: [1, 3]   }   // 1st & 3rd Saturday half-day
 * ]
 * Day-type priority:  week_off > half_day > working
 */

// ─────────────────────────────────────────────────────────────
// Internal helpers
// ─────────────────────────────────────────────────────────────

function parseBool(val, defaultVal = false) {
    if (val === null || val === undefined || val === '') return defaultVal;
    if (typeof val === 'boolean') return val;
    if (typeof val === 'number') return val !== 0;
    if (typeof val === 'string') {
        const s = val.toLowerCase().trim();
        return s === 'true' || s === '1' || s === 'yes' || s === 'on' || s === 'active';
    }
    return !!val;
}

function tryParse(raw, fallback = null) {
    if (raw == null) return fallback;
    if (typeof raw !== 'string') return raw;
    try { return JSON.parse(raw); } catch { return fallback; }
}

function weekdayOccurrence(date) {
    return Math.ceil(new Date(date).getDate() / 7);
}

function normaliseFreq(frequency) {
    if (!frequency || frequency === 'every') return 'every';
    if (Array.isArray(frequency)) return frequency.map(Number);
    if (typeof frequency === 'number') return [frequency];
    return 'every';
}

function entryMatchesDate(entry, date) {
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    if (entry.day !== dayNames[new Date(date).getDay()]) return false;
    const freq = normaliseFreq(entry.frequency);
    if (freq === 'every') return true;
    return freq.includes(weekdayOccurrence(date));
}

function normalisePolicyInput(raw) {
    if (!raw) return [];
    const parsed = tryParse(raw, raw);
    if (Array.isArray(parsed)) return parsed;
    if (Array.isArray(parsed?.rules)) return parsed.rules;
    return [];
}

function toSortedArray(weeks) {
    const src = weeks instanceof Set ? [...weeks] : [...(weeks || [])];
    return src.map(Number).sort((a, b) => a - b);
}

function mapToRules(map) {
    return [...map.entries()].map(([day, ruleData]) => ({ day, weeks: [...ruleData.weeks], timing: ruleData.timing }));
}

// ─────────────────────────────────────────────────────────────
// Week-Off Policy Engine (build, parse, evaluate)
// ─────────────────────────────────────────────────────────────

/**
 * Build a week_off_policy array from three UI configurator inputs.
 * @param {string[]} workingDays  Day names e.g. ['Mon', 'Tue']
 * @param {Array<{day:string,weeks:number[]}>} weekOffRules
 * @param {Array<{day:string,weeks:number[],timing?:Object}>} halfDayRules
 * @returns {Object[]}
 */
export function buildPolicy(workingDays = [], weekOffRules = [], halfDayRules = []) {
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const wdSet = new Set(workingDays.map(d => dayNames.indexOf(d)));
    
    const policy = [];

    // 1. Permanently-off days
    for (let d = 0; d < 7; d++) {
        if (!wdSet.has(d)) {
            policy.push({ day: dayNames[d], type: 'full', frequency: 'every' });
        }
    }

    // 2. Alternate full days off
    for (const rule of weekOffRules) {
        if (!dayNames.includes(rule.day)) continue;
        const weeks = toSortedArray(rule.weeks);
        if (!weeks.length) continue;
        policy.push({ day: rule.day, type: 'full', frequency: weeks.length >= 5 ? 'every' : weeks });
    }

    // 3. Half days
    for (const rule of halfDayRules) {
        if (!dayNames.includes(rule.day)) continue;
        const weeks = toSortedArray(rule.weeks);
        if (!weeks.length) continue;
        const entry = { day: rule.day, type: 'half', frequency: weeks.length >= 5 ? 'every' : weeks };
        if (rule.timing && rule.timing.start_time && rule.timing.end_time) {
            entry.timing = rule.timing;
        }
        policy.push(entry);
    }

    return policy;
}

/**
 * Reconstruct the three configurator inputs from a stored policy.
 * @param {Object[]|string} policy
 * @returns {{ workingDays: string[], weekOffRules: Array, halfDayRules: Array }}
 */
export function parsePolicy(policy) {
    const entries = normalisePolicyInput(policy);
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    
    const workingDaysIndices = new Set([0, 1, 2, 3, 4, 5, 6]);
    const weekOffMap = new Map();
    const halfDayMap = new Map();

    for (const entry of entries) {
        const freq = normaliseFreq(entry.frequency);
        const type = (entry.type || 'full').toLowerCase();
        const dayIdx = dayNames.indexOf(entry.day);

        // Fallback for old data with integer days
        const resolvedDay = dayIdx !== -1 ? entry.day : (typeof entry.day === 'number' ? dayNames[entry.day] : null);
        if (!resolvedDay) continue;
        const resolvedDayIdx = dayNames.indexOf(resolvedDay);

        if (type === 'full' && freq === 'every') {
            workingDaysIndices.delete(resolvedDayIdx);
            continue;
        }

        const map = type === 'half' ? halfDayMap : weekOffMap;
        if (!map.has(resolvedDay)) map.set(resolvedDay, { weeks: new Set(), timing: null });
        
        const ruleData = map.get(resolvedDay);
        if (entry.timing) ruleData.timing = entry.timing;

        if (freq === 'every') {
            [1, 2, 3, 4, 5].forEach(w => ruleData.weeks.add(w));
        } else {
            freq.forEach(w => ruleData.weeks.add(w));
        }
    }

    const workingDays = [...workingDaysIndices].sort().map(d => dayNames[d]);

    return {
        workingDays,
        weekOffRules: mapToRules(weekOffMap),
        halfDayRules: mapToRules(halfDayMap),
    };
}

/**
 * Evaluate the day type for a single date.
 * Priority:  week_off > half_day > working
 * @param {Date|string} date
 * @param {Object[]|string} policy
 * @returns {"working"|"half_day"|"week_off"}
 */
export function getDayType(date, policy) {
    const entries = normalisePolicyInput(policy);
    let isHalfDay = false;

    for (const entry of entries) {
        if (!entryMatchesDate(entry, date)) continue;
        const type = (entry.type || 'full').toLowerCase();
        if (type === 'full') return 'week_off';
        if (type === 'half') isHalfDay = true;
    }

    return isHalfDay ? 'half_day' : 'working';
}

/**
 * Get expected work hours for a specific date.
 * If a custom half-day timing is provided in the policy, uses that duration.
 * @param {Date|string} date
 * @param {Object[]|string} policy
 * @param {Object} shiftRules
 * @returns {number}
 */
export function getExpectedHours(date, policy, shiftRules) {
    const entries = normalisePolicyInput(policy);
    let isHalfDay = false;
    let customTiming = null;

    for (const entry of entries) {
        if (!entryMatchesDate(entry, date)) continue;
        const type = (entry.type || 'full').toLowerCase();
        if (type === 'full') return 0;
        if (type === 'half') {
            isHalfDay = true;
            if (entry.timing) customTiming = entry.timing;
        }
    }

    const timingToUse = customTiming || shiftRules?.shift_timing || {};
    const [sH, sM] = (timingToUse.start_time || '09:00:00').split(':').map(Number);
    const [eH, eM] = (timingToUse.end_time || '18:00:00').split(':').map(Number);
    
    let fullHours = ((eH * 60 + eM) - (sH * 60 + sM)) / 60;
    if (fullHours < 0) fullHours += 24; // Handle overnight shifts if any

    if (isHalfDay && !customTiming) {
        fullHours = fullHours / 2;
    }

    return parseFloat(fullHours.toFixed(2));
}

/**
 * Expand a month into per-day type descriptors for calendar/report views.
 * @param {number} year
 * @param {number} month  1-indexed
 * @param {Object[]|string} policy
 * @returns {Array<{date:string, dayType:string}>}
 */
export function getMonthSchedule(year, month, policy) {
    const daysInMonth = new Date(year, month, 0).getDate();
    const result = [];
    for (let d = 1; d <= daysInMonth; d++) {
        const date = new Date(year, month - 1, d, 12, 0, 0);
        result.push({ date: date.toISOString().split('T')[0], dayType: getDayType(date, policy) });
    }
    return result;
}

/**
 * Count working, half-day, and week-off days in a month.
 * @param {number} year
 * @param {number} month  1-indexed
 * @param {Object[]|string} policy
 * @returns {{ working: number, half_day: number, week_off: number, total: number }}
 */
export function getMonthSummary(year, month, policy) {
    return getMonthSchedule(year, month, policy).reduce(
        (acc, { dayType }) => { acc[dayType] = (acc[dayType] || 0) + 1; acc.total++; return acc; },
        { working: 0, half_day: 0, week_off: 0, total: 0 }
    );
}

/**
 * Get shift rules from shift object
 * Combines direct shift columns with optional policy_rules JSON for backward compatibility.
 */
export function getShiftRules(shift) {
    if (!shift) {
        return getDefaultShiftConfig();
    }

    // Parse policy_rules if it's a string
    let rules = shift.policy_rules;
    if (typeof rules === 'string') {
        try {
            rules = JSON.parse(rules);
        } catch (e) {
            rules = {};
        }
    }
    
    rules = rules || {};

    // Merge direct shift columns into a unified rules object
    // Direct columns take priority if they exist
    const overtimeEnabled = parseBool(
        shift.is_overtime_enabled ?? rules.overtime?.enabled, 
        true
    );

    const overtimeThreshold = Number(shift.overtime_threshold_hours || rules.overtime?.threshold || 8);
    // Buffer time (in hours) after shift ends before overtime starts counting
    // e.g. 0.5 = 30 minutes buffer — employee can stay 30min past shift without triggering OT
    const overtimeBuffer = Number(shift.overtime_buffer_hours ?? rules.overtime?.buffer ?? 0.5);

    return {
        shift_timing: {
            start_time: shift.start_time || rules.shift_timing?.start_time || "09:00:00",
            end_time: shift.end_time || rules.shift_timing?.end_time || "18:00:00"
        },
        grace_period: {
            minutes: Number(shift.grace_period_mins !== undefined && shift.grace_period_mins !== null ? shift.grace_period_mins : (rules.grace_period?.minutes || 10))
        },
        overtime: {
            enabled: overtimeEnabled,
            threshold: overtimeThreshold,
            buffer: overtimeBuffer
        },
        entry_requirements: rules.entry_requirements || {
            selfie: true,
            geofence: true
        },
        exit_requirements: rules.exit_requirements || {
            selfie: true,
            geofence: true
        },
        correction_deadline: rules.correction_deadline ?? 2,
        week_off_policy: normalisePolicyInput(rules.week_off_policy)
    };
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
            threshold: 9,
            buffer: 0.5  // 30 minutes buffer after shift end before OT kicks in
        },
        entry_requirements: {
            selfie: true,
            geofence: true
        },
        exit_requirements: {
            selfie: true,
            geofence: true
        },
        correction_deadline: 2,
        week_off_policy: [
            { day: 'Sun', type: 'full', frequency: 'every' }  // Sunday off by default
        ]
    };
}

/**
 * Check Location Compliance
 * @returns {Promise<{ok: boolean, error?: string}>}
 */
export async function checkLocationCompliance(user_id, lat, lng, accuracy, requirements) {
    // 1. Basic Validation
    if (Number.isNaN(lat) || Number.isNaN(lng)) {
        return { ok: false, error: "Invalid or missing latitude/longitude" };
    }

    const MAX_ALLOWED_ACCURACY = 200;
    if (!accuracy || accuracy > MAX_ALLOWED_ACCURACY) {
        return { ok: false, error: `Location accuracy too poor (${Math.round(accuracy)}m). GPS/Wi-Fi required (< ${MAX_ALLOWED_ACCURACY}m).` };
    }

    const reqs = requirements || {};
    // Handle both old nested and new flat structures
    const geoPolicy = reqs.geolocation || reqs; 
    
    // If not required, pass
    if (geoPolicy.geofence === false || geoPolicy.required === false) return { ok: true };

    // 2. Perform Geofence Check
    const isInLocation = await verifyUserGeofence(user_id, lat, lng);

    if (!isInLocation) {
        return { ok: false, error: "You are outside the allowed work location." };
    }

    return { ok: true };
}

/**
 * Check Biometric/Selfie Compliance
 * @returns {{ok: boolean, error?: string}}
 */
export function checkBiometricCompliance(file, requirements) {
    const reqs = requirements || {};
    const selfiePolicy = (reqs.selfie !== undefined && reqs.selfie !== null) ? reqs.selfie : {};

    // If not required, pass
    if (selfiePolicy === false || selfiePolicy.required === false) return { ok: true };

    // 2. Check if file exists
    if (!file) {
        return { ok: false, error: "Selfie is required for this check-in/out." };
    }

    return { ok: true };
}

