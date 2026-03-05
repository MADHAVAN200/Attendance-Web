import express from 'express';
import adminRoutes from './admin/adminRoutes.js';
import authRoutes from './auth/authRoutes.js';
import holidayRoutes from './holidays/holidayRoutes.js';
import notificationRoutes from './notifications/notificationRoutes.js';
import leaveRoutes from './leaves/leaveRoutes.js';
import reportsRoutes from './reports/reportsRoutes.js';
import employeeRoutes from './employees/employeeRoutes.js';
import workLocationsRoutes from './workLocations/workLocationsRoutes.js';

const router = express.Router();

// Mount feature-specific routes
router.use('/admin', adminRoutes);
router.use('/employee', employeeRoutes);
router.use('/auth', authRoutes);
router.use('/holiday', holidayRoutes);
router.use('/policies', adminRoutes); // Since adminRoutes now exports /shifts
router.use('/notifications', notificationRoutes);
router.use('/leaves', leaveRoutes);
router.use('/admin/reports', reportsRoutes);
router.use('/attendance/reports', reportsRoutes);
router.use('/', adminRoutes); // For /locations which hits 
router.use('/locations', workLocationsRoutes); // For work location management

router.get('/health', (req, res) => {
    res.json({ message: 'API is working' });
});

export default router;
