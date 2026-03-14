import { attendanceDB } from '../../config/database.js';

export async function upsertRequest({ org_id, user_id, request_date, original_data, proposed_data, reason }) {
    const existingRequest = await attendanceDB("dar_requests")
        .where({ user_id, request_date, status: 'PENDING' })
        .first();

    let request_id;

    if (existingRequest) {
        await attendanceDB("dar_requests")
            .where({ request_id: existingRequest.request_id })
            .update({
                proposed_data: JSON.stringify(proposed_data),
                reason: reason || null,
                updated_at: attendanceDB.fn.now()
            });
        request_id = existingRequest.request_id;
    } else {
        const [id] = await attendanceDB("dar_requests").insert({
            org_id,
            user_id,
            request_date,
            original_data: JSON.stringify(original_data || []),
            proposed_data: JSON.stringify(proposed_data),
            reason: reason || null,
            status: 'PENDING',
            created_at: attendanceDB.fn.now()
        });
        request_id = id;
    }

    return { request_id, isUpdate: !!existingRequest };
}

export async function getPendingRequests({ org_id }) {
    const requests = await attendanceDB("dar_requests")
        .join("users", "dar_requests.user_id", "users.user_id")
        .select(
            "dar_requests.*",
            "users.user_name as user_name",
            "users.email as user_email",
            attendanceDB.raw("DATE_FORMAT(dar_requests.request_date, '%Y-%m-%d') as request_date_str")
        )
        .where("dar_requests.org_id", org_id)
        .where("dar_requests.status", 'PENDING')
        .orderBy("dar_requests.created_at", "desc");

    return requests.map(r => ({
        ...r,
        request_date: r.request_date_str,
        original_data: typeof r.original_data === 'string' ? JSON.parse(r.original_data) : r.original_data,
        proposed_data: typeof r.proposed_data === 'string' ? JSON.parse(r.proposed_data) : r.proposed_data
    }));
}

export async function approveRequest({ id, org_id }) {
    const request = await attendanceDB("dar_requests")
        .select("*", attendanceDB.raw("DATE_FORMAT(request_date, '%Y-%m-%d') as request_date_str"))
        .where({ request_id: id, org_id })
        .first();

    if (!request) throw { status: 404, message: "Request not found" };
    if (request.status !== 'PENDING') throw { status: 400, message: "Request already processed" };

    const proposedTasks = typeof request.proposed_data === 'string' ? JSON.parse(request.proposed_data) : request.proposed_data;
    const targetDate = request.request_date_str;

    await attendanceDB.transaction(async (trx) => {
        await trx("daily_activities")
            .where({ user_id: request.user_id, org_id })
            .whereRaw("DATE(activity_date) = ?", [targetDate])
            .del();

        if (proposedTasks.length > 0) {
            const inserts = proposedTasks.map(t => ({
                org_id,
                user_id: request.user_id,
                activity_date: targetDate,
                start_time: t.start_time,
                end_time: t.end_time,
                title: t.title,
                description: t.description,
                activity_type: t.activity_type || 'TASK',
                status: 'COMPLETED',
                created_at: attendanceDB.fn.now()
            }));
            await trx("daily_activities").insert(inserts);
        }

        await trx("dar_requests")
            .where({ request_id: id })
            .update({ status: 'APPROVED', updated_at: attendanceDB.fn.now() });
    });
}

export async function rejectRequest({ id, org_id, comment }) {
    const updated = await attendanceDB("dar_requests")
        .where({ request_id: id, org_id })
        .update({
            status: 'REJECTED',
            admin_comment: comment,
            updated_at: attendanceDB.fn.now()
        });

    if (!updated) throw { status: 404, message: "Request not found" };
}