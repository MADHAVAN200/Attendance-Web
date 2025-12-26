
import { knexDB } from "../database.js";

// --- TEMPLATES ---
// Helpers to generate standard policy JSONs

export const PolicyTemplates = {
    STRICT_SHIFT: ({ selfie = true, geofence = true, grace_mins = 10 } = {}) => ({
        entry_requirements: { selfie, geofence },
        late_rules: { grace_period_mins: grace_mins, require_reason: true },
        status_rules: [
            {
                if: [
                    { ">": [{ var: "minutes_late" }, 120] }, // > 2 hours late
                    "HALF_DAY",
                ],
            },
            {
                if: [
                    { ">": [{ var: "minutes_late" }, grace_mins] },
                    "LATE",
                ],
            },
            {
                if: [
                    { "<": [{ var: "total_hours" }, 4] },
                    "ABSENT",
                ],
            },
        ],
    }),

    // Add more templates (Flexible, etc.) here
};

// --- CORE ENGINE ---

/**
 * Enhanced Rule Evaluator
 * Supports: >, <, >=, <=, ==, !=, AND, OR, VAR
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
            // Lazy evaluation not strictly needed for this scale, but good practice
            // Here simple map is fine
            const vals = evalArgs(args);
            return vals.every((v) => v === true);
        }
        case "or": {
            const vals = evalArgs(args);
            return vals.some((v) => v === true);
        }

        // Conditional { "if": [cond, trueVal, falseVal] }
        // Structure: { "if": [Condition, Result] } (Implicitly else null if not array of 3)
        case "if": {
            const cond = evaluateRule(args[0], data);
            if (cond) return evaluateRule(args[1], data);
            return args[2] ? evaluateRule(args[2], data) : null;
        }

        default:
            return rule;
    }
}

// --- SERVICE METHODS ---

export const PolicyService = {
    /**
     * Get policy for Organization. Returns default if none found.
     */
    getPolicy: async (org_id) => {
        const policy = await knexDB("attendance_policies")
            .where({ org_id, is_active: true })
            .first();

        if (!policy) {
            // Default Fallback
            return {
                rules: PolicyTemplates.STRICT_SHIFT(), // Default strict
                type: "DEFAULT",
            };
        }

        // If string, parse it (Knex sometimes auto-parses JSON cols, but safe to check)
        const rules =
            typeof policy.rules_json === "string"
                ? JSON.parse(policy.rules_json)
                : policy.rules_json;

        return { rules, type: policy.policy_type };
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

    validateEntryRequirements: (rules, reqData) => {
        const errors = [];
        const reqs = rules.entry_requirements || {};

        if (reqs.selfie && !reqData.has_image) {
            errors.push("Selfie is mandatory for attendance.");
        }

        // Geofencing is usually handled by `work_locations` check in main logic
        // But we can enable/disable the *check* here.
        if (reqs.geofence && !reqData.is_in_location) {
            errors.push("You are outside the allowed work location.");
        }

        return errors;
    }
};
