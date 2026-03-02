import { attendanceDB } from '../config/database.js';
import catchAsync from '../utils/catchAsync.js';
import AppError from '../utils/AppError.js';

//Get All Holidays
export const getHolidays = async (org_id) => {

    const holidays = await attendanceDB('holidays')
        .select(
            '*',
            attendanceDB.raw(
                "DATE_FORMAT(holiday_date, '%Y-%m-%d') as holiday_date"
            )
        )
        .where({ org_id });

    return holidays;

};

//Bulk or Single Insert
export const createHolidays = async (org_id, holidaysToInsert) => {

    const prepareData = holidaysToInsert.map(h => {

        if (!h.holiday_name || !h.holiday_date) {

            const error = new Error(
                'Missing required fields (holiday_name, holiday_date)'
            );

            error.statusCode = 400;

            throw error;

        }
        return {

            org_id,

            holiday_name: h.holiday_name,

            holiday_date: h.holiday_date,

            holiday_type: h.holiday_type || 'Public',

            applicable_json: JSON.stringify(
                h.applicable_json || []
            )

        };

    });

    await attendanceDB.transaction(async (trx) => {

        await trx('holidays').insert(prepareData);

    });

    return prepareData.length;

};

//Update Holiday
export const updateHoliday = async (id, org_id, data) => {

    const updates = {};

    if (data.holiday_name)
        updates.holiday_name = data.holiday_name;

    if (data.holiday_date)
        updates.holiday_date = data.holiday_date;

    if (data.holiday_type)
        updates.holiday_type = data.holiday_type;

    if (data.applicable_json)
        updates.applicable_json =
            JSON.stringify(data.applicable_json);


    const count = await attendanceDB('holidays')
        .where({
            holiday_id: id,
            org_id
        })
        .update(updates);


    return count;

};

//Delete Holidays
export const deleteHolidays = async (org_id, ids) => {

    const count = await attendanceDB('holidays')
        .whereIn('holiday_id', ids)
        .andWhere({ org_id })
        .del();

    return count;

};


