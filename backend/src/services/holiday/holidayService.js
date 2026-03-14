import { attendanceDB } from '../../config/database.js';
import catchAsync from '../../utils/catchAsync.js';
import AppError from '../../utils/AppError.js';
import ExcelJS from 'exceljs';
import { PassThrough } from 'stream';

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

// Validate bulk holidays before import
export const validateBulkHolidays = async (org_id, holidays) => {
    const response = {
        duplicates: [],
        valid_count: 0,
        invalid_rows: []
    };

    const inputDates = new Set();
    holidays.forEach((h, index) => {
        const name = h['Holiday Name'] || h['holiday_name'] || h['name'];
        const date = h['Date'] || h['holiday_date'] || h['date'];

        if (!name || !date) {
            response.invalid_rows.push({
                row: index + 1,
                reason: 'Missing Holiday Name or Date'
            });
            return;
        }

        inputDates.add(date);
    });

    if (inputDates.size > 0) {
        const existingHolidays = await attendanceDB('holidays')
            .where({ org_id })
            .whereIn('holiday_date', Array.from(inputDates))
            .select('holiday_date', 'holiday_name');

        const existingDateMap = new Map(existingHolidays.map(h => [h.holiday_date, h.holiday_name]));

        holidays.forEach((h, index) => {
            const date = h['Date'] || h['holiday_date'] || h['date'];
            const name = h['Holiday Name'] || h['holiday_name'] || h['name'];

            if (!date) return;

            const isDuplicate = existingDateMap.has(date);
            const hasRequiredFields = name && date;

            if (isDuplicate) {
                response.duplicates.push({
                    row: index + 1,
                    date,
                    reason: `Holiday already exists on this date: ${existingDateMap.get(date)}`
                });
            } else if (hasRequiredFields && !response.invalid_rows.some(r => r.row === index + 1)) {
                response.valid_count++;
            }
        });
    } else {
        response.valid_count = holidays.filter(h =>
            (h['Holiday Name'] || h['holiday_name'] || h['name']) &&
            (h['Date'] || h['holiday_date'] || h['date'])
        ).length;
    }

    return response;
};

// Bulk create holidays from parsed JSON
export const bulkCreateFromJson = async (org_id, holidays) => {
    const results = {
        total_processed: 0,
        success_count: 0,
        failure_count: 0,
        errors: []
    };

    const prepareData = [];

    for (const row of holidays) {
        const name = row['Holiday Name'] || row['holiday_name'] || row['name'];
        const date = row['Date'] || row['holiday_date'] || row['date'];
        const type = row['Type'] || row['holiday_type'] || row['type'] || 'Public';

        if (!name || !date) {
            results.failure_count++;
            results.errors.push(`Row missing required fields: name="${name}", date="${date}"`);
            continue;
        }

        prepareData.push({
            org_id,
            holiday_name: name,
            holiday_date: date,
            holiday_type: type,
            applicable_json: JSON.stringify(['All Locations'])
        });
    }

    results.total_processed = holidays.length;

    if (prepareData.length > 0) {
        try {
            await attendanceDB.transaction(async (trx) => {
                await trx('holidays').insert(prepareData);
            });
            results.success_count = prepareData.length;
        } catch (error) {
            results.failure_count = prepareData.length;
            results.errors.push(error.message);
        }
    }

    return results;
};

// Bulk upload holidays from CSV/Excel file
export const bulkUploadFromFile = async (org_id, file) => {
    const results = {
        total_processed: 0,
        success_count: 0,
        failure_count: 0,
        errors: []
    };

    const workbook = new ExcelJS.Workbook();
    const buffer = file.buffer;
    const mimeType = file.mimetype;
    const originalName = file.originalname.toLowerCase();

    if (mimeType.includes('csv') || originalName.endsWith('.csv')) {
        const bufferStream = new PassThrough();
        bufferStream.end(buffer);
        await workbook.csv.read(bufferStream);
    } else {
        await workbook.xlsx.load(buffer);
    }

    const worksheet = workbook.getWorksheet(1);
    if (!worksheet) {
        throw new AppError('Invalid or empty file', 400);
    }

    const headerMap = {};
    const headerRow = worksheet.getRow(1);
    headerRow.eachCell((cell, colNumber) => {
        const val = cell.value ? cell.value.toString().toLowerCase().trim() : '';
        headerMap[val] = colNumber;
    });

    const getVal = (row, ...keys) => {
        for (const key of keys) {
            const col = headerMap[key.toLowerCase()];
            if (!col) continue;
            const cell = row.getCell(col);
            return cell.value ? cell.value.toString().trim() : null;
        }
        return null;
    };

    const rowsData = [];
    worksheet.eachRow((row, rowNumber) => {
        if (rowNumber === 1) return;
        rowsData.push({ row, rowNumber });
    });

    results.total_processed = rowsData.length;

    const prepareData = [];
    const seenDates = new Set();

    const existingHolidays = await attendanceDB('holidays')
        .where({ org_id })
        .select('holiday_date');
    const existingDates = new Set(existingHolidays.map(h => h.holiday_date));

    for (const { row, rowNumber } of rowsData) {
        const name = getVal(row, 'holiday name', 'holiday_name', 'name');
        const date = getVal(row, 'date', 'holiday_date');
        const type = getVal(row, 'type', 'holiday_type') || 'Public';

        if (!name || !date) {
            results.failure_count++;
            results.errors.push(`Row ${rowNumber}: Missing Holiday Name or Date`);
            continue;
        }

        if (seenDates.has(date) || existingDates.has(date)) {
            results.failure_count++;
            results.errors.push(`Row ${rowNumber}: Holiday date ${date} already exists`);
            continue;
        }

        seenDates.add(date);
        prepareData.push({
            org_id,
            holiday_name: name,
            holiday_date: date,
            holiday_type: type,
            applicable_json: JSON.stringify(['All Locations'])
        });
    }

    if (prepareData.length > 0) {
        try {
            await attendanceDB.transaction(async (trx) => {
                await trx('holidays').insert(prepareData);
            });
            results.success_count = prepareData.length;
        } catch (error) {
            results.failure_count += prepareData.length;
            results.errors.push(`Batch insert failed: ${error.message}`);
        }
    }

    return results;
};


