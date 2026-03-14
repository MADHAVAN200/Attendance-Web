import catchAsync from '../../utils/catchAsync.js';
import * as superAdminService from '../../services/superAdmin/superAdminService.js';

export const getDashboardStats = catchAsync(async (req, res, next) => {
    // Only super_admin allowed
    if (req.user.user_type !== 'super_admin') {
        return res.status(403).json({ success: false, message: 'Access denied' });
    }

    const stats = await superAdminService.getDashboardStats();
    res.json({ success: true, data: stats });
});
