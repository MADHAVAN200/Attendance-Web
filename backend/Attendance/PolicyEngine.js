
import { knexDB } from "../database.js";
import { verifyUserGeofence } from "./Geofencing.js";

// --- TEMPLATES ---
// Helpers to generate standard policy JSONs

export const PolicyTemplates = {
    STRICT_SHIFT: ({ selfie = true, geofence = true, grace_mins = 10 } = {}) => ({
        shift_timing: { start_time: "09:00:00", end_time: "18:00:00" },
        grace_period: { minutes: grace_mins },
        overtime: { enabled: true, threshold: 8 },
        entry_requirements: {
            selfie,
            geofence
        },
        late_rules: { grace_period_mins: grace_mins, require_reason: true },
        status_rules: [
            {
                if: [
                    { "<": [{ var: "total_hours" }, 4] },
                    "ABSENT",
                ],
            },
            {
                if: [
                    { "<": [{ var: "total_hours" }, 8] },
                    "HALF_DAY",
                ],
            },
            {
                if: [
                    { ">": [{ var: "minutes_late" }, grace_mins] },
                    "LATE",
                ],
            },
        ],
    }),

    // Enhanced Template with Session Context
    FLEXIBLE_SHIFT: () => ({
        entry_requirements: {
            selfie: {
                required: true,
                only_on: ["first_session"]  // Selfie only on first check-in
            },
            geofence: {
                required: true,
                only_on: ["time_in", "first_session"]  // GPS only first check-in
            }
        },
        status_rules: [
            // HALF_DAY if first check-in after 11 AM
            {
                if: [
                    { ">": [{ var: "first_time_in_hour" }, 11] },
                    "HALF_DAY"
                ]
            },
            // HALF_DAY if last check-out before 4 PM
            {
                if: [
                    {
                        "and": [
                            { "!=": [{ var: "last_time_out" }, null] },
                            { "<": [{ var: "last_time_out_hour" }, 16] }
                        ]
                    },
                    "HALF_DAY"
                ]
            },
            // ABSENT if total hours < 4
            {
                if: [
                    { "<": [{ var: "total_hours_today" }, 4] },
                    "ABSENT"
                ]
            },
            // Default: PRESENT
            { if: [true, "PRESENT"] }
        ]
    })
};

// --- CORE ENGINE ---

/**
 * Enhanced Rule Evaluator
 * Supports: >, <, >=, <=, ==, !=, AND, OR, VAR, NOT
 */
function evaluateRule(rule, data) {
    // 1. Literal value
    if (typeof rule !== "object" || rule === null) {
        return rule;
    }

    // 2. Logic Block { "operator": [args...] }
    const keys = Object.keys(rule);
    if (keys.length !== 1) return rule; // Not a rule object

    const op = keys[0];
    const args = rule[op]; // Array of arguments

    // Helper to evaluate args recursively
    const evalArgs = (args) => {
        if (!Array.isArray(args)) return evaluateRule(args, data);
        return args.map((arg) => evaluateRule(arg, data));
    };

    switch (op) {
        case "var":
            return data[args]; // Get variable from data

        // Comparisons
        case ">": {
            const vals = evalArgs(args);
            return vals[0] > vals[1];
        }
        case "<": {
            const vals = evalArgs(args);
            return vals[0] < vals[1];
        }
        case ">=": {
            const vals = evalArgs(args);
            return vals[0] >= vals[1];
        }
        case "<=": {
            const vals = evalArgs(args);
            return vals[0] <= vals[1];
        }
        case "==": {
            const vals = evalArgs(args);
            return vals[0] == vals[1];
        }
        case "!=": {
            const vals = evalArgs(args);
            return vals[0] != vals[1];
        }

        // Logic
        case "and": {
            const vals = evalArgs(args);
            return vals.every((v) => v === true);
        }
        case "or": {
            const vals = evalArgs(args);
            return vals.some((v) => v === true);
        }
        case "not": {
            const val = evaluateRule(args, data);
            return !val;
        }

        // Conditional { "if": [cond, trueVal, falseVal] }
        case "if": {
            const cond = evaluateRule(args[0], data);
            if (cond) return evaluateRule(args[1], data);
            return args[2] ? evaluateRule(args[2], data) : null;
        }

        default:
            return rule;
    }
}

/**
 * Helper: Check if a rule should apply based on conditions
 * @param {Array} conditions - Array of condition strings like ["first_session", "time_in"]
 * @param {Object} reqData - Request data with context
 * @returns {boolean}
 */
function shouldApplyRule(conditions, reqData) {
    if (!conditions || conditions.length === 0) return true;

    return conditions.some(cond => {
        if (cond === "first_session") return reqData.is_first_session === true;
        if (cond === "last_session") return reqData.is_last_session === true;
        if (cond === "time_in") return reqData.event_type === "time_in";
        if (cond === "time_out") return reqData.event_type === "time_out";
        if (cond === "any_session") return true;
        return false;
    });
}

// --- SERVICE METHODS ---

export const PolicyService = {
    /**
     * Parse Rules from Shift Object
     * Returns default STRICT_SHIFT if no rules found in shift
     */
    getRulesFromShift: (shift) => {
        if (!shift || !shift.policy_rules) {
            return PolicyTemplates.STRICT_SHIFT(); // Default strict
        }

        // If string, parse it
        const rules = typeof shift.policy_rules === "string"
            ? JSON.parse(shift.policy_rules)
            : shift.policy_rules;

        return rules;
    },

    /**
     * Run status rules against current data
     * Returns: "PRESENT", "HALF_DAY", "ABSENT", "LATE", or null (Normal)
     */
    evaluateStatus: (rules, data) => {
        if (!rules.status_rules) return "PRESENT";

        // Iterate rules, return first non-null match (Priority System)
        for (const ruleWrapper of rules.status_rules) {
            // expect ruleWrapper to be { "if": ... }
            const result = evaluateRule(ruleWrapper, data);
            if (result) return result;
        }

        return "PRESENT"; // Default
    },


    /**
     * Check Location Compliance (Modular)
     * @returns {Promise<{ok: boolean, error?: string}>}
     */
    checkLocationCompliance: async (user_id, lat, lng, accuracy, requirements) => {
        // 1. Basic Validation (Moved from Controller)
        if (Number.isNaN(lat) || Number.isNaN(lng)) {
            return { ok: false, error: "Invalid or missing latitude/longitude" };
        }

        const MAX_ALLOWED_ACCURACY = 200;
        if (!accuracy || accuracy > MAX_ALLOWED_ACCURACY) {
            return { ok: false, error: `Location accuracy too poor (${Math.round(accuracy)}m). GPS/Wi-Fi required (< ${MAX_ALLOWED_ACCURACY}m).` };
        }

        const reqs = requirements || {};
        const geoPolicy = reqs.geolocation || {};
        const geofenceRule = geoPolicy.geofence;

        if (!geoPolicy.required || !geofenceRule.required) return { ok: true };

        // 2. Perform Geofence Check
        const isInLocation = await verifyUserGeofence(user_id, lat, lng);

        if (!isInLocation) {
            return { ok: false, error: "You are outside the allowed work location." };
        }

        return { ok: true };
    },

    /**
     * Check Biometric/Selfie Compliance (Modular)
     * @returns {{ok: boolean, error?: string}}
     */
    checkBiometricCompliance: (file, requirements) => {
        const reqs = requirements || {};
        const selfiePolicy = reqs.selfie || {};

        // 1. Check if Selfie is required by policy
        // Format: "selfie": { "required": true/false, ... }
        if (!selfiePolicy.required) return { ok: true };

        // 2. Check if file exists
        if (!file) {
            return { ok: false, error: "Selfie is required for this check-in/out." };
        }

        return { ok: true };
    },

    /**
     * Calculate Late Arrival & Compliance
     * Handles grace periods and determines if arrival is effectively late.
     * @returns {{minutesLate: number, isLate: boolean, gracePeriod: number}}
     */
    calculateLateArrival: (localTime, rules) => {
        let minutesLate = 0;
        const timing = rules.shift_timing || {};
        const startTimeStr = timing.start_time;

        if (startTimeStr) {
            
            const localDatePart = localTime.split('T')[0]; // YYYY-MM-DD
            const localTimePart = localTime.split('T')[1].split('.')[0]; // HH:MM:SS
            
            const [curH, curM] = localTimePart.split(':').map(Number);
            const currentMinutes = curH * 60 + curM;
            
            const [shiftH, shiftM] = startTimeStr.split(':').map(Number);
            const shiftMinutes = shiftH * 60 + shiftM;
            
            if (currentMinutes > shiftMinutes) {
                minutesLate = currentMinutes - shiftMinutes;
            }
        }
        
        const gracePeriod = rules.grace_period.minutes || 0; // Default 0 if undefined
        const isLate = minutesLate > gracePeriod;

        return {
            minutesLate,
            isLate,
            gracePeriod
        };
    },


    /**
     * Build session context for policy evaluation
     * @param {number} user_id 
     * @param {string} localTime - Current local time
     * @param {string} eventType - "time_in" or "time_out"
     * @returns {Object} Session context data
     */
    buildSessionContext: async (user_id, localTime, eventType) => {
        // Get all today's sessions
        const todaySessions = await knexDB("attendance_records")
            .where({ user_id })
            .whereRaw("DATE(time_in) = DATE(?)", [localTime])
            .orderBy("time_in", "asc");

        const isFirstSession = todaySessions.length === 0;
        const sessionNumber = todaySessions.length + 1;

        // Calculate aggregates
        let totalHoursToday = 0;
        todaySessions.forEach(session => {
            if (session.time_out) {
                const duration = (new Date(session.time_out) - new Date(session.time_in)) / (1000 * 60 * 60);
                totalHoursToday += duration;
            }
        });

        const firstTimeIn = todaySessions[0]?.time_in;
        const lastTimeOut = todaySessions[todaySessions.length - 1]?.time_out;

        return {
            is_first_session: isFirstSession,
            is_last_session: false, // We can't know this until end of day
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
};
