import catchAsync from '../utils/catchAsync.js';
import AppError from '../utils/AppError.js';
import * as holidayService from '../services/holidayService.js';


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



