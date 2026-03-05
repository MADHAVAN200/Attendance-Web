import catchAsync from '../../utils/catchAsync.js';
import AppError from '../../utils/AppError.js';
import * as holidayService from '../../services/holiday/holidayService.js';


//Get all holidays
export const getHolidays = catchAsync(async (req, res, next) => {
    const org_id = req.user.org_id;
    const holidays = await holidayService.getHolidays(org_id);
    res.json({ ok: true, holidays });
});

//Bulk upload holidays
export const addHolidays = catchAsync(async (req, res, next) => {

    const org_id = req.user.org_id;

    let holidaysToInsert = [];

    if (Array.isArray(req.body)) {

        holidaysToInsert = req.body;

    }
    else if (
        req.body.holidays &&
        Array.isArray(req.body.holidays)
    ) {

        holidaysToInsert = req.body.holidays;

    }
    else {

        holidaysToInsert = [req.body];

    }


    if (holidaysToInsert.length === 0) {

        return res.status(400).json({

            ok: false,

            message: 'No holiday data provided'

        });

    }


    const count =
        await holidayService.createHolidays(
            org_id,
            holidaysToInsert
        );


    res.json({

        ok: true,

        message: `${count} holiday(s) added successfully`

    });

});

export const updateHoliday = catchAsync(async (req, res, next) => {

    const { id } = req.params;

    const org_id = req.user.org_id;

    const count =
        await holidayService.updateHoliday(
            id,
            org_id,
            req.body
        );
    if (count === 0) {

        return res.status(404).json({

            ok: false,

            message: 'Holiday not found'

        });

    }
    res.json({

        ok: true,

        message: 'Holiday updated'

    });

});

export const deleteHolidays = catchAsync(async (req, res, next) => {

    const org_id = req.user.org_id;
    const { ids } = req.body;
    if (!ids || !Array.isArray(ids) || ids.length === 0) {

        return res.status(400).json({

            ok: false,

            message: 'No holiday IDs provided for deletion'

        });   
    }

    const count =
        await holidayService.deleteHolidays(
            org_id,
            ids
        );

    res.json({

        ok: true,

        message: `${count} holiday(s) deleted successfully`

    });

});

// Bulk validate holidays before import
export const validateBulkHolidays = catchAsync(async (req, res, next) => {
    const org_id = req.user.org_id;
    const { holidays } = req.body;

    if (!holidays || !Array.isArray(holidays)) {
        throw new AppError('Invalid holidays list', 400);
    }

    const validation = await holidayService.validateBulkHolidays(org_id, holidays);
    res.json({ ok: true, validation });
});

// Bulk create holidays from parsed JSON
export const bulkCreateFromJson = catchAsync(async (req, res, next) => {
    const org_id = req.user.org_id;
    const { holidays } = req.body;

    if (!holidays || !Array.isArray(holidays) || holidays.length === 0) {
        throw new AppError('Invalid data provided', 400);
    }

    const report = await holidayService.bulkCreateFromJson(org_id, holidays);
    res.json({ ok: true, report });
});

// Bulk upload holidays from CSV/Excel file
export const bulkUploadFromFile = catchAsync(async (req, res, next) => {
    if (!req.file) {
        throw new AppError('Please upload a CSV or Excel file', 400);
    }

    const org_id = req.user.org_id;
    const report = await holidayService.bulkUploadFromFile(org_id, req.file);
    res.json({ ok: true, report });
});



