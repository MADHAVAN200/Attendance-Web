import { attendanceDB } from '../../config/database.js';
import bcrypt from 'bcrypt';
import AppError from '../../utils/AppError.js';
import EventBus from '../../utils/EventBus.js';
import { deleteFile } from '../../../../backend/s3/s3Service.js';
import ExcelJS from 'exceljs';
import { PassThrough } from 'stream';

// Reuse logic from Admin.js and UserCleanupService.js

const ALLOWED_UPDATE_FIELDS = new Set([
    "user_name",
    "user_password",
    "email",
    "phone_no",
    "desg_id",
    "dept_id",
    "shift_id",
    "user_type"
]);

export const getAllUsers = async (orgId, includeWorkLocation = false) => {
    let usersQuery = attendanceDB('users as u')
        .leftJoin('designations as d', 'u.desg_id', 'd.desg_id')
        .leftJoin('departments as dep', 'u.dept_id', 'dep.dept_id')
        .leftJoin('shifts as s', 'u.shift_id', 's.shift_id')
        .select(
            'u.user_id', 'u.user_name', 'u.email', 'u.phone_no', 'u.user_type',
            'd.desg_name', 'd.desg_id', 'dep.dept_name', 'dep.dept_id',
            's.shift_name', 's.shift_id', 'u.profile_image_url',
            'u.is_active', 'u.is_deleted', 'u.deleted_at'
        )
        .where('u.org_id', orgId);

    const users = await usersQuery;

    if (includeWorkLocation) {
        const workLocationsData = await attendanceDB('user_work_locations as uwl')
            .join('work_locations as wl', 'uwl.location_id', 'wl.location_id')
            .select('uwl.user_id', 'wl.location_id as loc_id', 'wl.location_name as loc_name', 'wl.latitude', 'wl.longitude', 'wl.radius', 'wl.is_active');

        const workLocationMap = {};
        for (const row of workLocationsData) {
            if (!workLocationMap[row.user_id]) workLocationMap[row.user_id] = [];
            workLocationMap[row.user_id].push({
                loc_id: row.loc_id, loc_name: row.loc_name, latitude: row.latitude, longitude: row.longitude, radius: row.radius, is_active: row.is_active
            });
        }

        return users.map(u => ({ ...u, work_locations: workLocationMap[u.user_id] || [] }));
    }

    return users;
};

export const getUserById = async (userId, orgId) => {
    const user = await attendanceDB('users as u')
        .leftJoin('designations as d', 'u.desg_id', 'd.desg_id')
        .leftJoin('departments as dep', 'u.dept_id', 'dep.dept_id')
        .leftJoin('shifts as s', 'u.shift_id', 's.shift_id')
        .select(
            'u.user_id', 'u.user_name', 'u.email', 'u.phone_no', 'u.user_type', 'u.desg_id', 'u.dept_id', 'u.shift_id', 'u.org_id',
            'u.profile_image_url', 'u.is_active', 'u.is_deleted', 'u.deleted_at',
            'd.desg_name', 'dep.dept_name', 's.shift_name'
        )
        .where('u.user_id', userId)
        .andWhere('u.org_id', orgId)
        .first();

    if (!user) throw new AppError("User not found", 404);

    const workLocations = await attendanceDB('user_work_locations as uwl')
        .join('work_locations as wl', 'uwl.location_id', 'wl.location_id')
        .select('wl.location_id', 'wl.location_name', 'wl.latitude', 'wl.longitude', 'wl.radius')
        .where('uwl.user_id', userId);

    user.work_locations = workLocations;
    return user;
};

export const createUser = async (userData, authInfo) => {
    const { user_name, user_password, email, phone_no, desg_id, dept_id, shift_id, user_type } = userData;

    if (user_type === 'admin') throw new AppError("Cannot create Admin users via the panel", 403);
    if (authInfo.initiatorRole === 'hr' && user_type !== 'employee') throw new AppError("HR can only create Employees", 403);
    if (!user_name || !user_password || !email) throw new AppError("Missing required fields (Name, Password, Email)", 400);

    const existingEmail = await attendanceDB("users").where({ email }).first();
    if (existingEmail) throw new AppError("Email is already taken", 400);

    const phoneToSave = phone_no?.trim() || null;
    if (phoneToSave) {
        const existingPhone = await attendanceDB("users").where({ phone_no: phoneToSave }).first();
        if (existingPhone) throw new AppError("Mobile number is already taken", 400);
    }

    const hashedPassword = await bcrypt.hash(user_password, 12);
    let newUserId;

    await attendanceDB.transaction(async (trx) => {
        const org = await trx("organizations").where({ org_id: authInfo.orgId }).forUpdate().first();
        if (!org) throw new AppError("Organization not found", 404);

        const nextNumber = org.last_user_number + 1;
        const userCode = `${org.org_code}-${String(nextNumber).padStart(3, "0")}`;

        await trx("organizations").where({ org_id: authInfo.orgId }).update({ last_user_number: nextNumber });

        const [insertedId] = await trx("users").insert({
            org_id: authInfo.orgId, user_name, user_code: userCode, user_password: hashedPassword,
            email, phone_no: phoneToSave, desg_id: desg_id || null, dept_id: dept_id || null,
            shift_id: shift_id || null, user_type: user_type || "employee"
        });

        if (!insertedId) throw new AppError("Failed to create user", 500);
        newUserId = insertedId;

        try {
            EventBus.emitActivityLog({
                user_id: authInfo.initiatorId, org_id: authInfo.orgId, event_type: "CREATE",
                event_source: "API", object_type: "USER", object_id: newUserId,
                description: `Created user ${user_name} (${user_type || "employee"})`,
                request_ip: authInfo.clientIp, user_agent: authInfo.userAgent
            });
        } catch (logErr) {
            console.error("Failed to log activity:", logErr);
        }
    });

    return newUserId;
};

export const updateUser = async (userId, updatesData, authInfo) => {
    const updates = {};
    const targetUser = await attendanceDB("users").where({ user_id: userId, org_id: authInfo.orgId }).first();

    if (!targetUser) throw new AppError("User not found", 404);

    if (targetUser.user_type === 'admin' && authInfo.initiatorId !== targetUser.user_id) {
        throw new AppError("Admins can only be edited by themselves", 403);
    }

    if (authInfo.initiatorRole === 'hr') {
        if (targetUser.user_type === 'admin' || targetUser.user_type === 'hr') throw new AppError("HR can only edit Employees", 403);
        if (updatesData.user_type && updatesData.user_type !== 'employee') throw new AppError("HR cannot change user role to anything other than Employee", 403);
    }

    if (updatesData.user_type === 'admin' && targetUser.user_type !== 'admin') throw new AppError("Cannot promote user to Admin", 403);

    if (updatesData.email) {
        const existing = await attendanceDB("users").where({ email: updatesData.email }).andWhereNot({ user_id: userId }).first();
        if (existing) throw new AppError("Email is already taken", 400);
    }

    if (updatesData.phone_no?.trim()) {
        const existing = await attendanceDB("users").where({ phone_no: updatesData.phone_no.trim() }).andWhereNot({ user_id: userId }).first();
        if (existing) throw new AppError("Mobile number is already taken", 400);
    }

    for (const key of Object.keys(updatesData)) {
        if (ALLOWED_UPDATE_FIELDS.has(key)) {
            if (key === "user_password") {
                if (updatesData.user_password?.trim()) {
                    updates.user_password = await bcrypt.hash(updatesData.user_password, 12);
                }
            } else {
                updates[key] = updatesData[key] === "" ? null : updatesData[key];
            }
        }
    }

    await attendanceDB.transaction(async (trx) => {
        if (Object.keys(updates).length > 0) {
            const affected = await trx('users').where('user_id', userId).andWhere('org_id', authInfo.orgId).update(updates);
            if (affected === 0) throw new AppError("User not found or unauthorized", 404);
        }
    });

    return true;
};

export const softDeleteUser = async (userId, authInfo) => {
    if (parseInt(userId) === authInfo.initiatorId) throw new AppError("You cannot delete your own account", 400);

    const targetUser = await attendanceDB('users').where({ user_id: userId, org_id: authInfo.orgId }).first();
    if (!targetUser) throw new AppError("User not found", 404);
    if (targetUser.user_type === 'admin') throw new AppError("Cannot delete Admin users", 403);
    if (authInfo.initiatorRole === 'hr' && targetUser.user_type === 'hr') throw new AppError("HR cannot delete other HR users", 403);

    const affected = await attendanceDB('users').where('user_id', userId).andWhere('org_id', authInfo.orgId).update({
        is_deleted: true, is_active: false, deleted_at: attendanceDB.fn.now()
    });

    if (affected === 0) throw new AppError("User not found", 404);

    try {
        EventBus.emitActivityLog({
            user_id: authInfo.initiatorId, org_id: authInfo.orgId, event_type: "DELETE", event_source: "API",
            object_type: "USER", object_id: userId, description: `Soft deleted user ${targetUser.user_name}`,
            request_ip: authInfo.clientIp, user_agent: authInfo.userAgent
        });
    } catch (err) {
        console.error("Failed to log activity:", err);
    }

    return true;
};

export const restoreUser = async (userId, authInfo) => {
    const targetUser = await attendanceDB('users').where({ user_id: userId, org_id: authInfo.orgId }).first();
    if (!targetUser) throw new AppError("User not found", 404);

    await attendanceDB('users').where('user_id', userId).update({ is_deleted: false, deleted_at: null, is_active: false });

    try {
        EventBus.emitActivityLog({
            user_id: authInfo.initiatorId, org_id: authInfo.orgId, event_type: "UPDATE", event_source: "API",
            object_type: "USER", object_id: userId, description: `Restored user ${targetUser.user_name}`,
            request_ip: authInfo.clientIp, user_agent: authInfo.userAgent
        });
    } catch (err) { }

    return true;
};

export const toggleUserStatus = async (userId, isActive, authInfo) => {
    const targetUser = await attendanceDB('users').where({ user_id: userId, org_id: authInfo.orgId }).select('user_type', 'user_name').first();
    if (!targetUser) throw new AppError("User not found", 404);

    if (authInfo.initiatorRole === 'hr' && (targetUser.user_type === 'admin' || targetUser.user_type === 'hr')) {
        throw new AppError("HR cannot change status of Admin or other HR", 403);
    }

    if (targetUser.user_type === 'admin' && !isActive) {
        throw new AppError("Cannot deactivate Admin users", 403);
    }

    await attendanceDB('users').where('user_id', userId).where('org_id', authInfo.orgId).update({ is_active: isActive });

    return true;
};

// --- Permanent Delete (from UserCleanupService) ---
const safeDeleteS3 = async (key) => {
    try {
        if (key) await deleteFile({ key });
    } catch (error) {
        console.warn(`[UserCleanup] Failed to delete S3 file ${key}:`, error.message);
    }
};

const extractKeyFromUrl = (url) => {
    if (!url) return null;
    try {
        const bucketDomain = 's3.amazonaws.com';
        if (url.includes(bucketDomain)) {
            const parts = url.split(bucketDomain + '/');
            if (parts.length > 1) return parts[1];
        }
        if (!url.startsWith('http')) return url;
        return null;
    } catch (e) {
        return null;
    }
};

export const permanentlyDeleteUser = async (userId) => {
    const trx = await attendanceDB.transaction();
    try {
        const user = await trx('users').where('user_id', userId).first();
        if (!user) {
            await trx.rollback();
            return false;
        }

        await trx('refresh_tokens').where('user_id', userId).del();
        await trx('notifications').where('user_id', userId).del();
        await trx('user_activity_logs').where('user_id', userId).del();
        await trx('application_error_logs').where('user_id', userId).del();

        const leaveRequests = await trx('leave_requests').where('user_id', userId).select('lr_id');
        const leaveIds = leaveRequests.map(lr => lr.lr_id);
        if (leaveIds.length > 0) {
            const leaveAttachments = await trx('leave_attachments').whereIn('leave_id', leaveIds).select('file_key');
            for (const attachment of leaveAttachments) await safeDeleteS3(attachment.file_key);
            await trx('leave_attachments').whereIn('leave_id', leaveIds).del();
            await trx('leave_requests').whereIn('lr_id', leaveIds).del();
        }

        const feedbacks = await trx('feedback').where('user_id', userId).select('feedback_id');
        const feedbackIds = feedbacks.map(f => f.feedback_id);
        if (feedbackIds.length > 0) {
            const feedbackAttachments = await trx('feedback_attachments').whereIn('feedback_id', feedbackIds).select('file_key');
            for (const attachment of feedbackAttachments) await safeDeleteS3(attachment.file_key);
            await trx('feedback_attachments').whereIn('feedback_id', feedbackIds).del();
            await trx('feedback').whereIn('feedback_id', feedbackIds).del();
        }

        const attendanceRecords = await trx('attendance_records').where('user_id', userId).select('time_in_image_key', 'time_out_image_key');
        for (const record of attendanceRecords) {
            if (record.time_in_image_key) await safeDeleteS3(record.time_in_image_key);
            if (record.time_out_image_key) await safeDeleteS3(record.time_out_image_key);
        }
        await trx('attendance_records').where('user_id', userId).del();

        if (user.profile_image_url) {
            const key = extractKeyFromUrl(user.profile_image_url);
            if (key) await safeDeleteS3(key);
        }

        await trx('users').where('user_id', userId).del();
        await trx.commit();
        return true;
    } catch (error) {
        console.error(`[UserCleanup] Failed to delete user ${userId}:`, error);
        await trx.rollback();
        throw error;
    }
};

// --- Bulk Upload ---
export const bulkCreateUsers = async (file, authInfo) => {
    const workbook = new ExcelJS.Workbook();
    const buffer = file.buffer;
    const mimeType = file.mimetype;
    const originalName = file.originalname.toLowerCase();

    if (mimeType.includes("csv") || originalName.endsWith(".csv")) {
        const bufferStream = new PassThrough();
        bufferStream.end(buffer);
        await workbook.csv.read(bufferStream);
    } else {
        await workbook.xlsx.load(buffer);
    }

    const worksheet = workbook.getWorksheet(1);
    if (!worksheet) throw new AppError("Invalid or empty file", 400);

    const results = { total_processed: 0, success_count: 0, failure_count: 0, errors: [] };
    const headerMap = {};
    worksheet.getRow(1).eachCell((cell, colNumber) => {
        headerMap[cell.value ? cell.value.toString().toLowerCase().trim() : ""] = colNumber;
    });

    const getVal = (row, key) => {
        const col = headerMap[key];
        if (!col) return null;
        const cell = row.getCell(col);
        return cell.value ? cell.value.toString().trim() : null;
    };

    const rowsData = [];
    worksheet.eachRow((row, rowNumber) => {
        if (rowNumber > 1) rowsData.push({ row, rowNumber });
    });

    const uniqueDepts = new Set(), uniqueDesgs = new Set(), uniqueShifts = new Set();
    for (const { row } of rowsData) {
        const dept = getVal(row, "department") || getVal(row, "dept");
        const desg = getVal(row, "designation") || getVal(row, "role");
        const shift = getVal(row, "shift");
        if (dept) uniqueDepts.add(dept);
        if (desg) uniqueDesgs.add(desg);
        if (shift) uniqueShifts.add(shift);
    }

    const deptMap = {}, desgMap = {}, shiftMap = {};

    await attendanceDB.transaction(async (trx) => {
        const org = await trx("organizations").where({ org_id: authInfo.orgId }).forUpdate().first();
        if (!org) throw new AppError("Organization not found", 404);
        let nextUserNumber = org.last_user_number;

        for (const deptName of uniqueDepts) {
            let dept = await trx("departments").where({ dept_name: deptName, org_id: authInfo.orgId }).first();
            if (!dept) {
                const [newId] = await trx("departments").insert({ dept_name: deptName, org_id: authInfo.orgId });
                deptMap[deptName.toLowerCase()] = newId;
            } else {
                deptMap[deptName.toLowerCase()] = dept.dept_id;
            }
        }

        for (const desgName of uniqueDesgs) {
            let desg = await trx("designations").where({ desg_name: desgName, org_id: authInfo.orgId }).first();
            if (!desg) {
                const [newId] = await trx("designations").insert({ desg_name: desgName, org_id: authInfo.orgId });
                desgMap[desgName.toLowerCase()] = newId;
            } else {
                desgMap[desgName.toLowerCase()] = desg.desg_id;
            }
        }

        const allShifts = await trx("shifts").where({ org_id: authInfo.orgId }).select("shift_id", "shift_name");
        for (const sh of allShifts) shiftMap[sh.shift_name.toLowerCase()] = sh.shift_id;

        for (const { row, rowNumber } of rowsData) {
            results.total_processed++;
            const name = getVal(row, "name") || getVal(row, "user_name");
            const email = getVal(row, "email");
            const phone = getVal(row, "phone") || getVal(row, "phone_no");
            const type = getVal(row, "type") || "employee";
            const password = getVal(row, "password") || `${name}-${authInfo.orgId}`;

            if (type.toLowerCase() === 'admin') {
                results.failure_count++; results.errors.push(`Row ${rowNumber}: Cannot create Admin users`); continue;
            }
            if (authInfo.initiatorRole === 'hr' && type.toLowerCase() !== 'employee') {
                results.failure_count++; results.errors.push(`Row ${rowNumber}: HR can only create Employees`); continue;
            }
            if (!name || !email) {
                results.failure_count++; results.errors.push(`Row ${rowNumber}: Missing Name or Email`); continue;
            }

            const existing = await trx("users").where({ email }).orWhere({ phone_no: phone }).first();
            if (existing) {
                results.failure_count++; results.errors.push(`Row ${rowNumber}: Duplicate Email/Phone`); continue;
            }

            const hashedPassword = await bcrypt.hash(password, 10);
            nextUserNumber++;
            const userCode = `${org.org_code || org.org_name}-${String(nextUserNumber).padStart(3, "0")}`;

            await trx("users").insert({
                org_id: authInfo.orgId, user_name: name, user_code: userCode, email, phone_no: phone || "",
                user_password: hashedPassword, user_type: type,
                dept_id: deptMap[(getVal(row, "department") || getVal(row, "dept"))?.toLowerCase()],
                desg_id: desgMap[(getVal(row, "designation") || getVal(row, "role"))?.toLowerCase()],
                shift_id: shiftMap[getVal(row, "shift")?.toLowerCase()]
            });

            results.success_count++;
        }

        await trx("organizations").where({ org_id: authInfo.orgId }).update({ last_user_number: nextUserNumber });
    });

    return results;
};

// --- Lookups & Helpers ---
export const getDepartments = async (orgId) => {
    return await attendanceDB("departments").where({ org_id: orgId }).select("dept_id", "dept_name");
};

export const createDepartment = async (deptName, orgId) => {
    if (!deptName) throw new AppError("Department name is required", 400);
    const existing = await attendanceDB("departments").where({ dept_name: deptName, org_id: orgId }).first();
    if (existing) throw new AppError("Department already exists", 400);

    const [newId] = await attendanceDB("departments").insert({ dept_name: deptName, org_id: orgId });
    return { dept_id: newId, dept_name: deptName };
};

export const getDesignations = async (orgId) => {
    return await attendanceDB("designations").where({ org_id: orgId }).select("desg_id", "desg_name");
};

export const createDesignation = async (desgName, orgId) => {
    if (!desgName) throw new AppError("Designation name is required", 400);
    const existing = await attendanceDB("designations").where({ desg_name: desgName, org_id: orgId }).first();
    if (existing) throw new AppError("Designation already exists", 400);

    const [newId] = await attendanceDB("designations").insert({ desg_name: desgName, org_id: orgId });
    return { desg_id: newId, desg_name: desgName };
};

export const getShifts = async (orgId) => {
    const shifts = await attendanceDB("shifts").where({ org_id: orgId });
    return shifts.map(s => {
        const rules = typeof s.policy_rules === 'string' ? JSON.parse(s.policy_rules) : (s.policy_rules || {});
        return {
            shift_id: s.shift_id,
            shift_name: s.shift_name,
            org_id: s.org_id,
            start_time: rules.shift_timing?.start_time || null,
            end_time: rules.shift_timing?.end_time || null,
            grace_period_mins: rules.grace_period?.minutes || 0,
            is_overtime_enabled: rules.overtime?.enabled ? 1 : 0,
            overtime_threshold_hours: rules.overtime?.threshold || 8.0,
            policy_rules: rules
        };
    });
};

export const createShift = async (shiftData, orgId) => {
    const {
        shift_name, start_time, end_time, grace_period_mins,
        is_overtime_enabled, overtime_threshold_hours,
        policy_rules
    } = shiftData;

    if (!shift_name) throw new AppError("Missing required shift fields", 400);

    const existing = await attendanceDB("shifts").where({ shift_name, org_id }).first();
    if (existing) throw new AppError("Shift already exists", 400);

    const rules = policy_rules || {};
    const finalRules = {
        ...rules,
        shift_timing: {
            start_time: start_time || null,
            end_time: end_time || null
        },
        grace_period: {
            minutes: Number(grace_period_mins) || 0
        },
        overtime: {
            enabled: is_overtime_enabled ? true : false,
            threshold: Number(overtime_threshold_hours) || 8
        },
        entry_requirements: rules.entry_requirements || { selfie: true, geofence: true }
    };

    const [newId] = await attendanceDB("shifts").insert({
        org_id,
        shift_name,
        policy_rules: JSON.stringify(finalRules)
    });
    return { shift_id: newId, shift_name };
};

export const updateShift = async (shiftId, shiftData, orgId) => {
    const {
        shift_name,
        policy_rules = {}
    } = shiftData;

    const updates = {
        shift_name
    };

    if (shiftData.policy_rules) {
        updates.policy_rules = JSON.stringify(policy_rules);
    }

    const affected = await attendanceDB("shifts").where({ shift_id: shiftId, org_id }).update(updates);
    if (affected === 0) throw new AppError("Shift not found", 404);
    return true;
};

export const deleteShift = async (shiftId, orgId) => {
    const usersCount = await attendanceDB('users').where({ shift_id: shiftId }).count('user_id as count').first();
    if (usersCount.count > 0) {
        throw new AppError(`Cannot delete shift. It is assigned to ${usersCount.count} users.`, 400);
    }

    const affected = await attendanceDB("shifts").where({ shift_id: shiftId, org_id }).del();
    if (affected === 0) throw new AppError("Shift not found", 404);
    return true;
};

export const getWorkLocations = async (orgId) => {
    return await attendanceDB("work_locations").where({ org_id: orgId }).select(
        "location_id", "location_name", "latitude", "longitude", "radius", "is_active"
    );
};

export const bulkValidateUsers = async (users, orgId) => {
    const response = {
        total_rows: users.length,
        new_departments: [],
        new_designations: []
    };

    const inputDepts = new Set();
    const inputDesgs = new Set();

    users.forEach(row => {
        const dept = row["Department"] || row["department"] || row["dept"];
        const desg = row["Designation"] || row["designation"] || row["role"] || row["Role"];
        if (dept) inputDepts.add(dept.toLowerCase());
        if (desg) inputDesgs.add(desg.toLowerCase());
    });

    if (inputDepts.size > 0) {
        const existingDepts = await attendanceDB("departments")
            .where('org_id', orgId)
            .whereIn(attendanceDB.raw('LOWER(dept_name)'), Array.from(inputDepts))
            .select('dept_name');

        const existingDeptSet = new Set(existingDepts.map(d => d.dept_name.toLowerCase()));

        inputDepts.forEach(d => {
            if (!existingDeptSet.has(d)) {
                const original = users.find(u => (u['Department'] || u['department'] || u['dept'])?.toLowerCase() === d);
                response.new_departments.push(original ? (original['Department'] || original['department'] || original['dept']) : d);
            }
        });
    }

    if (inputDesgs.size > 0) {
        const existingDesgs = await attendanceDB("designations")
            .where('org_id', orgId)
            .whereIn(attendanceDB.raw('LOWER(desg_name)'), Array.from(inputDesgs))
            .select('desg_name');

        const existingDesgSet = new Set(existingDesgs.map(d => d.desg_name.toLowerCase()));

        inputDesgs.forEach(d => {
            if (!existingDesgSet.has(d)) {
                const original = users.find(u => (u['Designation'] || u['designation'] || u['role'] || u['Role'])?.toLowerCase() === d);
                response.new_designations.push(original ? (original['Designation'] || original['designation'] || original['role'] || original['Role']) : d);
            }
        });
    }

    return response;
};
