import { attendanceDB } from '../../config/database.js';

export async function createEvent({ org_id, user_id, title, description, event_date, start_time, end_time, location, type }) {
    const [event_id] = await attendanceDB("events_meetings").insert({
        org_id,
        user_id,
        title,
        description,
        event_date,
        start_time,
        end_time,
        location,
        type,
        created_at: attendanceDB.fn.now(),
        updated_at: attendanceDB.fn.now()
    });
    return event_id;
}

export async function listEvents({ org_id, user_id, date_from, date_to, type }) {
    let query = attendanceDB("events_meetings")
        .select(
            "*",
            attendanceDB.raw("DATE_FORMAT(event_date, '%Y-%m-%d') as event_date")
        )
        .where("org_id", org_id)
        .where("user_id", user_id);

    if (date_from) query.where("event_date", ">=", date_from);
    if (date_to) query.where("event_date", "<=", date_to);
    if (type) query.where("type", type);

    return query.orderBy("event_date", "asc").orderBy("start_time", "asc");
}

export async function updateEvent({ event_id, org_id, updates }) {
    delete updates.event_id;
    delete updates.org_id;
    delete updates.user_id;
    delete updates.created_at;

    updates.updated_at = attendanceDB.fn.now();

    await attendanceDB("events_meetings")
        .where({ event_id, org_id })
        .update(updates);
}

export async function deleteEvent({ event_id, org_id }) {
    await attendanceDB("events_meetings")
        .where({ event_id, org_id })
        .del();
}