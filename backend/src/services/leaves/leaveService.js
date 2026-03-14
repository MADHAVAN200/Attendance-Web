import { attendanceDB } from '../../config/database.js';
// S3 helper lives in the top-level services/s3 folder
import * as S3Service from '../s3/s3Service.js';

export async function getMyHistory({ user_id, org_id }) {
    const leaves = await attendanceDB('leave_requests')
        .where({ user_id, org_id })
        .orderBy('applied_at', 'desc');

    const leaveIds = leaves.map(l => l.lr_id);
    if (leaveIds.length > 0) {
        const attachments = await attendanceDB('leave_attachments').whereIn('leave_id', leaveIds);

        const attachmentMap = new Map();

        await Promise.all(attachments.map(async (a) => {
            const { url } = await S3Service.getFileUrl({ key: a.file_key });
            const item = { ...a, file_url: url };

            if (!attachmentMap.has(a.leave_id)) {
                attachmentMap.set(a.leave_id, []);
            }
            attachmentMap.get(a.leave_id).push(item);
        }));

        leaves.forEach(leave => {
            leave.attachments = attachmentMap.get(leave.lr_id) || [];
        });
    } else {
        leaves.forEach(l => l.attachments = []);
    }

    return leaves;
}

export async function submitLeaveRequest({ user_id, org_id, leave_type, start_date, end_date, reason, files }) {
    const start = new Date(start_date);
    const end = new Date(end_date);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
        throw { status: 400, message: "Invalid date format" };
    }

    if (end < start) {
        throw { status: 400, message: "End date cannot be before start date" };
    }

    const formatSQLDate = (d) => d.toISOString().split('T')[0];
    const sqlStart = formatSQLDate(start);
    const sqlEnd = formatSQLDate(end);

    const overlap = await attendanceDB('leave_requests')
        .where({ user_id, org_id })
        .whereIn('status', ['Pending', 'Approved'])
        .where(builder => {
            builder.whereBetween('start_date', [sqlStart, sqlEnd])
                .orWhereBetween('end_date', [sqlStart, sqlEnd])
                .orWhere(inner => {
                    inner.where('start_date', '<', sqlStart)
                        .andWhere('end_date', '>', sqlEnd);
                });
        })
        .first();

    if (overlap) {
        throw { status: 400, message: "Use has an overlapping leave request." };
    }

    const [insertId] = await attendanceDB('leave_requests').insert({
        user_id,
        org_id,
        leave_type,
        start_date: sqlStart,
        end_date: sqlEnd,
        reason,
        status: 'Pending',
        applied_at: new Date()
    });

    let responseAttachments = [];

    if (files && files.length > 0) {
        const attachmentPromises = files.map(async (file) => {
            const cleanName = file.originalname.replace(/[^a-zA-Z0-9.]/g, '_');
            const key = cleanName;
            const directory = `leaves/${insertId}`;

            await S3Service.uploadFile({
                fileBuffer: file.buffer,
                key: key,
                directory: directory,
                contentType: file.mimetype
            });

            const { url: signedUrl } = await S3Service.getFileUrl({ key: key, directory: `leaves/${insertId}` });

            return {
                leave_id: insertId,
                file_key: `leaves/${insertId}/${key}`,
                file_type: file.mimetype,
                _signedUrl: signedUrl
            };
        });

        const attachmentsData = await Promise.all(attachmentPromises);

        const dbInserts = attachmentsData.map(({ _signedUrl, ...rest }) => rest);
        await attendanceDB('leave_attachments').insert(dbInserts);

        responseAttachments = attachmentsData.map(a => ({
            file_key: a.file_key,
            file_url: a._signedUrl,
            file_type: a.file_type
        }));
    }

    return { insertId, responseAttachments };
}

export async function withdrawLeaveRequest({ id, user_id, org_id }) {
    const request = await attendanceDB('leave_requests').where({ lr_id: id, user_id, org_id }).first();

    if (!request) {
        throw { status: 404, message: "Request not found" };
    }

    if (request.status !== 'Pending') {
        throw { status: 400, message: "Cannot withdraw processed request" };
    }

    await attendanceDB('leave_requests').where({ lr_id: id }).del();
}

export async function getPendingRequests({ org_id }) {
    const requests = await attendanceDB('leave_requests as lr')
        .join('users as u', 'lr.user_id', 'u.user_id')
        .select('lr.*', 'u.user_name', 'u.email', 'u.phone_no')
        .where('lr.org_id', org_id)
        .where('lr.status', 'Pending')
        .orderBy('lr.applied_at', 'asc');

    const leaveIds = requests.map(l => l.lr_id);
    if (leaveIds.length > 0) {
        const attachments = await attendanceDB('leave_attachments').whereIn('leave_id', leaveIds);
        const attachmentMap = new Map();

        await Promise.all(attachments.map(async (a) => {
            const { url } = await S3Service.getFileUrl({ key: a.file_key });
            const item = { ...a, file_url: url };

            if (!attachmentMap.has(a.leave_id)) {
                attachmentMap.set(a.leave_id, []);
            }
            attachmentMap.get(a.leave_id).push(item);
        }));

        requests.forEach(req => {
            req.attachments = attachmentMap.get(req.lr_id) || [];
        });
    }

    return requests;
}

export async function getAdminHistory({ org_id, user_id, status, start_date, end_date }) {
    let query = attendanceDB('leave_requests as lr')
        .join('users as u', 'lr.user_id', 'u.user_id')
        .select('lr.*', 'u.user_name')
        .where('lr.org_id', org_id);

    if (user_id) query = query.where('lr.user_id', user_id);
    if (status) query = query.where('lr.status', status);
    if (start_date) query = query.where('lr.start_date', '>=', start_date);
    if (end_date) query = query.where('lr.end_date', '<=', end_date);

    const history = await query.orderBy('lr.applied_at', 'desc');

    const leaveIds = history.map(l => l.lr_id);
    if (leaveIds.length > 0) {
        const attachments = await attendanceDB('leave_attachments').whereIn('leave_id', leaveIds);
        const attachmentMap = new Map();

        await Promise.all(attachments.map(async (a) => {
            const { url } = await S3Service.getFileUrl({ key: a.file_key });
            const item = { ...a, file_url: url };

            if (!attachmentMap.has(a.leave_id)) {
                attachmentMap.set(a.leave_id, []);
            }
            attachmentMap.get(a.leave_id).push(item);
        }));

        history.forEach(h => {
            h.attachments = attachmentMap.get(h.lr_id) || [];
        });
    }

    return history;
}

export async function updateLeaveStatus({ id, org_id, status, pay_type, pay_percentage, admin_comment, reviewed_by }) {
    if (!['Approved', 'Rejected'].includes(status)) {
        throw { status: 400, message: "Invalid status" };
    }

    const updateData = {
        status,
        admin_comment,
        reviewed_by,
        reviewed_at: new Date()
    };

    if (status === 'Approved') {
        updateData.pay_type = pay_type;
        updateData.pay_percentage = pay_type === 'Partial' ? (pay_percentage || 50) : (pay_type === 'Paid' ? 100 : 0);
    }

    const affected = await attendanceDB('leave_requests')
        .where({ lr_id: id, org_id })
        .update(updateData);

    if (affected === 0) {
        throw { status: 404, message: "Request not found" };
    }

    const request = await attendanceDB('leave_requests').where({ lr_id: id }).first();
    return request;
}