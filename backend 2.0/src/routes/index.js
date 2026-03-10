import express from 'express';
import adminRoutes from './admin/adminRoutes.js';
import authRoutes from './auth/authRoutes.js';
import holidayRoutes from './holidays/holidayRoutes.js';
import notificationRoutes from './notifications/notificationRoutes.js';
import leaveRoutes from './leaves/leaveRoutes.js';
import reportsRoutes from './reports/reportsRoutes.js';
import employeeRoutes from './employees/employeeRoutes.js';
import workLocationsRoutes from './workLocations/workLocationsRoutes.js';
import darActivityRoutes from './darRoutes/activitiesRoutes.js';
import darEventRoutes from './darRoutes/eventsRoutes.js';
import darRequestRoutes from './darRoutes/requestsRoutes.js';
import darSettingsRoutes from './darRoutes/settingsRoutes.js';
import shiftRoutes from './policies/shiftRoutes.js';
import attendanceRoutes from './attendance/attendanceRoutes.js';
import feedbackRoutes from './feedback/feedbackRoutes.js';
import paymentRoutes from './payment/paymentRoutes.js';
import profileRoutes from './profile/profileRoutes.js';

const router = express.Router();

// Mount feature-specific routes
router.use('/admin', adminRoutes);
router.use('/employee', employeeRoutes);
router.use('/auth', authRoutes);
router.use('/holiday', holidayRoutes);
router.use('/policies', shiftRoutes); // Shift management
router.use('/notifications', notificationRoutes);
router.use('/leaves', leaveRoutes);
router.use('/attendance', attendanceRoutes);
router.use('/admin/reports', reportsRoutes);
router.use('/attendance/reports', reportsRoutes);
router.use('/', adminRoutes); // For /locations which hits 
router.use('/locations', workLocationsRoutes); // For work location management
router.use('/dar/activities', darActivityRoutes); // For DAR activities
router.use('/dar/events', darEventRoutes); // For DAR events
router.use('/dar/requests', darRequestRoutes); // For DAR requests
router.use('/dar/settings', darSettingsRoutes); // For DAR settings
router.use('/feedback', feedbackRoutes); // For feedback/bug reports
router.use('/payment', paymentRoutes); // For Razorpay payments
router.use('/profile', profileRoutes); // For user profile management

router.get('/health', (req, res) => {
    res.json({ message: 'API is working' });
});

export default router;
