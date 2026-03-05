
import jwt from 'jsonwebtoken';
import { attendanceDB } from '../config/database.js';
import AppError from '../utils/AppError.js';
import catchAsync from '../utils/catchAsync.js';

export const authenticateJWT = catchAsync(async (req, res, next) => {
    let token;
    const authHeader = req.headers['authorization'];

    if (authHeader && authHeader.startsWith("Bearer ")) {
        token = authHeader.split(" ")[1];
    }

    if (!token) {
        // If we want to return JSON 401 directly like LoginAPI did:
        return res.status(401).json({ message: "Unauthorized: No token provided" });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        let user;

        // Check based on token contents
        // User tokens (issued by LoginAPI.js) have user_type='employee'/'admin'/etc.

        user = await attendanceDB('users').where({ user_id: decoded.user_id }).first();

        if (!user) {
            return res.status(403).json({ message: "Forbidden: Invalid token user" });
        }

        // STRICT SECURITY CHECK: Block Inactive or Deleted Users
        if (!user.is_active) {
            return res.status(403).json({ message: "Access Denied: Your account is inactive. Please contact HR for more information." });
        }

        if (user.is_deleted) {
            return res.status(403).json({ message: "Access Denied: Your account has been deleted. Please contact HR for more information." });
        }

        // Standardize req.user
        req.user = {
            ...decoded,
            id: user.user_id || user.id, // standardized ID accessor
            user_type: user.user_type ? user.user_type.toLowerCase() : 'employee',
            org_id: user.org_id || null
        };

        next();

    } catch (err) {
        if (err.name === 'TokenExpiredError') {
            return res.status(403).json({ message: "Forbidden: Token expired" });
        }
        console.error("Auth Middleware Error:", err);
        return res.status(403).json({ message: "Forbidden: Invalid or expired token" });
    }
});

// Authorization Middleware
export const authorize = (...roles) => {
    return (req, res, next) => {
        if (!req.user || !roles.includes(req.user.user_type)) {
            return next(new AppError('You do not have permission to perform this action', 403));
        }
        next();
    };
};
