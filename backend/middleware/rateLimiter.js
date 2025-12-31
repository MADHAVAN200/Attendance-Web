import rateLimit from 'express-rate-limit';

// Global Limiter - General API usage
// 15 minutes, 300 requests per IP (Approx 1 request every 3 seconds on average)
export const generalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 300,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        ok: false,
        message: 'Too many requests from this IP, please try again after 15 minutes',
    },
});

// Auth Limiter - Strict for Login/Signup
// 15 minutes, 10 requests per IP
export const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        ok: false,
        message: 'Too many login attempts, please try again after 15 minutes',
    },
});

