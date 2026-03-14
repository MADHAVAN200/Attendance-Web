import catchAsync from '../../utils/catchAsync.js';
import AppError from '../../utils/AppError.js';
import * as userService from '../../services/users/userService.js';
import * as dashboardService from '../../services/admin/dashboardService.js';
import { attendanceDB } from '../../config/database.js';

// GET all users
export const getAllUsers = catchAsync(async (req, res, next) => {
    if (req.user.user_type !== 'admin' && req.user.user_type !== 'hr') {
        throw new AppError("Only admin and HR can access user Data", 403);
    }

    const includeWorkLocation = req.query.workLocation === 'true';
    const orgId = req.user.org_id;

    const users = await userService.getAllUsers(orgId, includeWorkLocation);

    res.json({
        success: true,
        users: users,
    });
});

// GET single user
export const getUserById = catchAsync(async (req, res, next) => {
    if (req.user.user_type !== 'admin' && req.user.user_type !== 'hr') {
        throw new AppError("Only admin and HR can access user Data", 403);
    }

    const { user_id } = req.params;
    const orgId = req.user.org_id;

    const user = await userService.getUserById(user_id, orgId);

    res.json({
        success: true,
        user: user,
    });
});

// CREATE new user
export const createUser = catchAsync(async (req, res, next) => {
    if (req.user.user_type !== "admin" && req.user.user_type !== "hr") {
        throw new AppError("Only admin and HR can create users", 403);
    }

    // Pass necessary auth details down to the service for validation
    const authInfo = {
        initiatorRole: req.user.user_type,
        initiatorId: req.user.user_id,
        orgId: req.user.org_id,
        clientIp: req.clientIp || req.ip,
        userAgent: req.get("User-Agent")
    };

    const profileImageBuffer = req.file ? req.file.buffer : null;
    const { newUserId, profileImageUrl } = await userService.createUser(req.body, authInfo, profileImageBuffer);

    res.status(201).json({
        success: true,
        message: "User created successfully",
        inserted_id: newUserId,
        profile_image_url: profileImageUrl
    });
});

// UPDATE user
export const updateUser = catchAsync(async (req, res, next) => {
    if (req.user.user_type !== "admin" && req.user.user_type !== "hr") {
        throw new AppError("Only admin and HR can update user data", 403);
    }

    const { user_id } = req.params;

    const authInfo = {
        initiatorRole: req.user.user_type,
        initiatorId: req.user.user_id,
        orgId: req.user.org_id,
        clientIp: req.clientIp || req.ip,
        userAgent: req.get("User-Agent")
    };

    const profileImageBuffer = req.file ? req.file.buffer : null;
    const result = await userService.updateUser(user_id, req.body, authInfo, profileImageBuffer);

    res.json({ success: true, message: "User updated successfully", profile_image_url: result.profileImageUrl || null });
});

// DELETE user (Soft Delete)
export const softDeleteUser = catchAsync(async (req, res, next) => {
    if (req.user.user_type !== "admin" && req.user.user_type !== "hr") {
        throw new AppError("Only admin and HR can delete users", 403);
    }

    const { user_id } = req.params;

    const authInfo = {
        initiatorRole: req.user.user_type,
        initiatorId: req.user.user_id,
        orgId: req.user.org_id,
        clientIp: req.clientIp || req.ip,
        userAgent: req.get("User-Agent")
    };

    await userService.softDeleteUser(user_id, authInfo);

    res.json({ message: "User moved to trash" });
});

// FORCE DELETE user
export const forceDeleteUser = catchAsync(async (req, res, next) => {
    if (req.user.user_type !== 'admin' && req.user.user_type !== 'hr') {
        throw new AppError("Access denied", 403);
    }

    const { user_id } = req.params;

    await userService.permanentlyDeleteUser(user_id);

    res.status(200).json({ message: "User permanently deleted." });
});

// RESTORE user
export const restoreUser = catchAsync(async (req, res, next) => {
    if (req.user.user_type !== "admin" && req.user.user_type !== "hr") {
        throw new AppError("Only admin and HR can restore users", 403);
    }

    const { user_id } = req.params;

    const authInfo = {
        initiatorRole: req.user.user_type,
        initiatorId: req.user.user_id,
        orgId: req.user.org_id,
        clientIp: req.clientIp || req.ip,
        userAgent: req.get("User-Agent")
    };

    await userService.restoreUser(user_id, authInfo);

    res.json({ message: "User restored successfully (set to inactive)" });
});

// TOGGLE STATUS
export const toggleUserStatus = catchAsync(async (req, res, next) => {
    if (req.user.user_type !== "admin" && req.user.user_type !== "hr") {
        throw new AppError("Only admin and HR can update user status", 403);
    }

    const { user_id } = req.params;
    const { is_active } = req.body;

    const authInfo = {
        initiatorRole: req.user.user_type,
        initiatorId: req.user.user_id,
        orgId: req.user.org_id,
        clientIp: req.clientIp || req.ip,
        userAgent: req.get("User-Agent")
    };

    await userService.toggleUserStatus(user_id, is_active, authInfo);

    res.json({ success: true, message: `User account ${is_active ? 'activated' : 'deactivated'} successfully` });
});

// BULK CREATE
export const bulkCreateUsers = catchAsync(async (req, res, next) => {
    if (req.user.user_type !== "admin" && req.user.user_type !== "hr") {
        throw new AppError("Only admin and HR can perform bulk operations", 403);
    }

    if (!req.file) {
        throw new AppError("Please upload a CSV or Excel file", 400);
    }

    const authInfo = {
        initiatorRole: req.user.user_type,
        initiatorId: req.user.user_id,
        orgId: req.user.org_id,
    };

    const results = await userService.bulkCreateUsers(req.file, authInfo);

    res.json({ ok: true, report: results });
});

// --- Lookups ---
export const getDepartments = catchAsync(async (req, res, next) => {
    const depts = await userService.getDepartments(req.user.org_id);
    res.json({ success: true, departments: depts, data: depts }); // Sending both formats for max compatibility
});

export const createDepartment = catchAsync(async (req, res, next) => {
    const dept = await userService.createDepartment(req.body.dept_name, req.user.org_id);
    res.status(201).json({ success: true, department: dept });
});

export const getDesignations = catchAsync(async (req, res, next) => {
    const desgs = await userService.getDesignations(req.user.org_id);
    res.json({ success: true, designations: desgs, data: desgs });
});

export const createDesignation = catchAsync(async (req, res, next) => {
    const desg = await userService.createDesignation(req.body.desg_name, req.user.org_id);
    res.status(201).json({ success: true, designation: desg });
});

export const getShifts = catchAsync(async (req, res, next) => {
    const shifts = await userService.getShifts(req.user.org_id);
    res.json({ success: true, shifts: shifts, data: shifts });
});

export const createShift = catchAsync(async (req, res, next) => {
    const shift = await userService.createShift(req.body, req.user.org_id);
    res.status(201).json({ success: true, message: "Shift created", shift });
});

export const updateShift = catchAsync(async (req, res, next) => {
    await userService.updateShift(req.params.shift_id, req.body, req.user.org_id);
    res.json({ success: true, message: "Shift updated" });
});

export const deleteShift = catchAsync(async (req, res, next) => {
    await userService.deleteShift(req.params.shift_id, req.user.org_id);
    res.json({ success: true, message: "Shift deleted" });
});

export const getWorkLocations = catchAsync(async (req, res, next) => {
    const locations = await userService.getWorkLocations(req.user.org_id);
    res.json({ ok: true, locations });
});

export const bulkValidateUsers = catchAsync(async (req, res, next) => {
    if (req.user.user_type !== "admin" && req.user.user_type !== "hr") {
        throw new AppError("Only admin and HR can validate user data", 403);
    }
    const { users } = req.body;
    if (!users || !Array.isArray(users)) {
        throw new AppError("Invalid JSON payload", 400);
    }
    const validationReport = await userService.bulkValidateUsers(users, req.user.org_id);
    res.json({ success: true, validation: validationReport });
});

export const getDashboardStats = catchAsync(async (req, res) => {
    const org_id = req.user.org_id;
    const { range = 'weekly', year, month } = req.query;

    const result = await dashboardService.getDashboardStats(org_id, { range, year, month });

    res.json({ success: true, ...result });
});
