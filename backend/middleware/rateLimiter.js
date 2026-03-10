import rateLimit from 'express-rate-limit';
import requestIp from 'request-ip';

// Helper to normalize IP (Handle IPv6 / IPv4-mapped-IPv6)
const getClientIp = (req) => {
    let ip = req.clientIp || requestIp.getClientIp(req) || req.ip || '127.0.0.1';
    // Normalize IPv6 mapped IPv4 (e.g., ::ffff:127.0.0.1 -> 127.0.0.1)
    if (ip.substr(0, 7) == "::ffff:") {
        ip = ip.substr(7)
    }
    return ip;
};

// Global Limiter - General API usage
// 1 hour, 10000 requests per IP (Safe for large offices/CGNAT)
export const generalLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    max: 10000,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    keyGenerator: (req) => {
        return getClientIp(req);
    },
    message: {
        ok: false,
        message: 'Too many requests from this IP, please try again after 1 hour',
    },
});

// Auth Limiter - Strict for Login/Signup
// 15 minutes, 8 failed attempts per User Account (Protects against brute force)
export const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 8,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    skipSuccessfulRequests: true,
    keyGenerator: (req) => {
        const ip = getClientIp(req);

        // Identify the user by their login input (Email/Phone)
        const identifier = req.body.user_input ||
            req.body.email ||
            req.body.phone ||
            req.body.username;

        let key = ip; // Default to IP if no identifier found

        if (identifier) {
            key = identifier.toString().toLowerCase().trim();
        }

        // Clean Debug Log
        if (identifier) {
            console.log(`🔒 Rate Limit Check | User: ${key} | IP: ${ip}`);
        }

        return key;
    },
    message: {
        ok: false,
        message: 'Too many failed attempts for this account. Please try again after 15 minutes',
    },
});

// IP Fail-Safe Limiter - Protects against "Distributed Brute Force" / "Bot Attacks"
// If a single IP tries 300 times (even with different usernames), it gets blocked.
// This allows a large office (NAT) to have ~300 failed attempts total before blocking.
export const loginIpLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 300,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    skipSuccessfulRequests: true,
    keyGenerator: (req) => {
        return getClientIp(req);
    },
    message: {
        ok: false,
        message: 'Too many failed login attempts from this IP. Please try again after 15 minutes',
    },
});
