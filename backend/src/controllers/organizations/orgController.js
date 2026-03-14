import catchAsync from '../../utils/catchAsync.js';
import { attendanceDB } from '../../config/database.js';
import AppError from '../../utils/AppError.js';
import bcrypt from 'bcrypt';

export const createOrganization = catchAsync(async (req, res, next) => {
    const {
        org_name, org_code, subscription_plan, subscription_expiry, grace_period_days, max_users,
        contact_name, contact_email, contact_phone,
        admin_name, admin_email, admin_phone, admin_password
    } = req.body;

    if (!org_name || !org_code) {
        throw new AppError("Organization name and code are required", 400);
    }

    if (!admin_email || !admin_password) {
        throw new AppError("Admin email and password are required to setup the organization", 400);
    }

    // Wrap in transaction to ensure both org and admin user are created or neither
    const insertedId = await attendanceDB.transaction(async (trx) => {
        const [orgId] = await trx('organizations').insert({
            org_name,
            org_code: org_code.toUpperCase(),
            contact_name: contact_name || null,
            contact_email: contact_email || null,
            contact_phone: contact_phone || null,
            subscription_plan: subscription_plan || 'Trial',
            subscription_expiry: subscription_expiry || null,
            is_trial: (subscription_plan || 'Trial') === 'Trial' ? 1 : 0,
            status: 'active',
            max_users: max_users || 50,
            last_user_number: 1 // We're creating the first user right now
        });

        // Create the admin user for this organization
        const hashedPassword = await bcrypt.hash(admin_password, 10);
        const userCode = `${org_code.toUpperCase()}001`;

        await trx('users').insert({
            org_id: orgId,
            user_code: userCode,
            user_name: admin_name || contact_name || 'Organization Admin',
            email: admin_email,
            phone_no: admin_phone || null,
            user_password: hashedPassword,
            user_type: 'admin',
            is_active: true,
            is_deleted: false
        });

        return orgId;
    });

    res.status(201).json({ success: true, message: "Organization created successfully", org_id: insertedId });
});

export const getOrganizations = catchAsync(async (req, res, next) => {
    // Left join users table to get counts
    const orgs = await attendanceDB('organizations as o')
        .leftJoin('users as u', 'o.org_id', 'u.org_id')
        .select(
            'o.*',
            attendanceDB.raw('COUNT(u.user_id) as total_users'),
            attendanceDB.raw('SUM(CASE WHEN u.is_active = 1 AND u.is_deleted = 0 THEN 1 ELSE 0 END) as active_users')
        )
        .groupBy('o.org_id')
        .orderBy('o.created_at', 'desc');

    res.status(200).json({ success: true, data: orgs });
});

export const updateOrganization = catchAsync(async (req, res, next) => {
    const { id } = req.params;
    const {
        org_name, status, subscription_plan, subscription_expiry, grace_period_days, max_users,
        contact_name, contact_email, contact_phone
    } = req.body;

    const org = await attendanceDB('organizations').where('org_id', id).first();
    if (!org) throw new AppError("Organization not found", 404);

    const updates = {};
    if (org_name !== undefined) updates.org_name = org_name;
    if (status !== undefined) updates.status = status;
    if (subscription_plan !== undefined) updates.subscription_plan = subscription_plan;
    if (subscription_expiry !== undefined) updates.subscription_expiry = subscription_expiry;
    if (max_users !== undefined) updates.max_users = max_users;
    if (contact_name !== undefined) updates.contact_name = contact_name;
    if (contact_email !== undefined) updates.contact_email = contact_email;
    if (contact_phone !== undefined) updates.contact_phone = contact_phone;

    await attendanceDB('organizations').where('org_id', id).update(updates);

    res.status(200).json({ success: true, message: "Organization updated successfully" });
});

export const getOrgAdmins = catchAsync(async (req, res, next) => {
    const { id } = req.params;

    const admins = await attendanceDB('users')
        .where({ org_id: id, user_type: 'admin' })
        .select('user_id', 'user_code', 'user_name', 'email', 'phone_no', 'is_active')
        .orderBy('created_at', 'asc');

    res.status(200).json({ success: true, data: admins });
});

export const updateOrgAdmin = catchAsync(async (req, res, next) => {
    const { id, adminId } = req.params;
    const { user_name, email, phone_no, is_active, password } = req.body;

    const admin = await attendanceDB('users').where({ user_id: adminId, org_id: id, user_type: 'admin' }).first();
    if (!admin) throw new AppError("Admin user not found", 404);

    const updates = {};
    if (user_name !== undefined) updates.user_name = user_name;
    if (email !== undefined) updates.email = email;
    if (phone_no !== undefined) updates.phone_no = phone_no;
    if (is_active !== undefined) updates.is_active = is_active;

    if (password) {
        updates.user_password = await bcrypt.hash(password, 10);
    }

    if (Object.keys(updates).length > 0) {
        await attendanceDB('users').where('user_id', adminId).update(updates);
    }

    res.status(200).json({ success: true, message: "Admin user updated successfully" });
});
