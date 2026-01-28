
import jwt from 'jsonwebtoken';
import { knexDB } from '../database.js';
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
        // Super Admin tokens (issued by SuperAdmin.js) have user_type='super_admin'
        // User tokens (issued by LoginAPI.js) have user_type='employee'/'admin'/etc.

        if (decoded.user_type === 'super_admin' || decoded.role === 'super_admin') {
            user = await knexDB('super_admins').where({ id: decoded.id }).first();
            if (user) {
                user.user_type = 'super_admin';
                req.superAdmin = user; // Legacy support
            }
        } else {
            user = await knexDB('users').where({ user_id: decoded.user_id }).first();
        }

        if (!user) {
            return res.status(403).json({ message: "Forbidden: Invalid token user" });
        }

        // Standardize req.user
        req.user = {
            ...decoded,
            id: user.user_id || user.id, // standardized ID accessor
            user_type: user.user_type,
            org_id: user.org_id || null
        };

        next();

    } catch (err) {
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
