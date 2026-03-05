import AppError from "../utils/AppError.js";
import catchAsync from "../utils/catchAsync.js";

const ensureAdmin = catchAsync((req, res, next) => {
    // Check if user is authenticated
    if (!req.user) {
        throw new AppError("Authentication required", 401);
    }

    // Check if user is admin
    if (req.user.user_type !== 'admin') {
        throw new AppError("Access denied. Admins only.", 403);
    }

    next();
});

export default ensureAdmin;
