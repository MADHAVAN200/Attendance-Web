import rateLimit from 'express-rate-limit';
import requestIp from 'request-ip';



// Global Limiter - General API usage
// 15 minutes, 300 requests per IP (Approx 1 request every 3 seconds on average)
export const generalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 300,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => {
        return req.clientIp || requestIp.getClientIp(req) || req.ip;
    },
    message: {
        ok: false,
        message: 'Too many requests from this IP, please try again after 15 minutes',
    },
});

// Auth Limiter - Strict for Login/Signup
// 15 minutes, 50 failed attempts per IP (Strict enough to stop brute force, loose enough for NAT)
export const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 50, // Increased from 10 to 50 to handle office/shared IPs better
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests: true, // Don't count successful logins against the limit
    keyGenerator: (req) => {
        const ip = req.clientIp || requestIp.getClientIp(req) || req.ip;
        // Temporary Debug Log
        if (req.body && req.body.user_input) {
            console.log(`🔒 Rate Limit Check | User: ${req.body.user_input} | IP: ${ip}`);
        }
        return ip;
    },
    message: {
        ok: false,
        message: 'Too many failed login attempts, please try again after 15 minutes',
    },
});

