import catchAsync from '../../utils/catchAsync.js';
import * as LocationService from "../../services/employees/employeeServices.js"; 

export const getLocations = catchAsync(async (req, res) => {
    const { user_id } = req.user;

    const locations = await LocationService.getAssignedLocations({ user_id });
    const isUnrestricted = locations.length === 0;

    res.json({
        ok: true,
        locations,
        unrestricted: isUnrestricted
    });
});
