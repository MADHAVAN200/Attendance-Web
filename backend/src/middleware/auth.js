
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

        // Check if token belongs to super admin
        if (decoded.user_type === 'super_admin') {
            user = await attendanceDB('super_admins').where({ id: decoded.user_id }).first();
            if (!user) {
                return res.status(403).json({ message: "Forbidden: Invalid token user" });
            }
            if (!user.is_active) {
                return res.status(403).json({ message: "Access Denied: Your account is inactive." });
            }

            req.user = {
                ...decoded,
                id: user.id,
                user_type: 'super_admin',
                org_id: null
            };
            return next();
        }

        // Token belongs to regular user
        user = await attendanceDB('users')
            .leftJoin('organizations', 'users.org_id', 'organizations.org_id')
            .select('users.*', 'organizations.status as org_status')
            .where({ 'users.user_id': decoded.user_id })
            .first();

        if (!user) {
            return res.status(403).json({ message: "Forbidden: Invalid token user" });
        }

        // STRICT SECURITY CHECK: Block Inactive/Suspended Orgs and Inactive Users
        // NOTE: 'admin' user_type is allowed through so they can access subscription/billing features
        if (user.org_id && user.org_status !== 'active' && user.user_type !== 'admin') {
            return res.status(403).json({ message: `Access Denied: Your organization account is ${user.org_status}.` });
        }

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

// Require Active Org Middleware
export const requireActiveOrg = catchAsync(async (req, res, next) => {
    // If the user belongs to an org, and it is NOT active, block them from using platform features
    if (req.user && req.user.org_id && req.user.org_status && req.user.org_status !== 'active') {
        return res.status(403).json({ message: `Action Denied: Your organization account is currently ${req.user.org_status}. Please renew your subscription to restore access.` });
    }
    next();
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

// Feature Allowance Middleware
export const checkFeature = (requiredFeatureColumn) => {
    return catchAsync(async (req, res, next) => {
        // If it's a super admin, they can do anything
        if (req.user && req.user.user_type === 'super_admin') {
            return next();
        }

        // We need to fetch the organization to check the specific feature column
        // (Since we don't load every single column into the JWT payload)
        if (!req.user || !req.user.org_id) {
            return res.status(403).json({ message: "Action Denied: No organization context found." });
        }

        const org = await attendanceDB('organizations')
            .where({ org_id: req.user.org_id })
            .select(requiredFeatureColumn)
            .first();

        // If org doesn't exist or doesn't have the column, or the column is false/0
        if (!org || !org[requiredFeatureColumn]) {
            return res.status(403).json({
                message: `Action Denied: Your organization does not have access to this feature (${requiredFeatureColumn}). Please upgrade your plan.`
            });
        }

        next();
    });
};
