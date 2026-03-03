import express from 'express';
import adminRoutes from './admin/adminRoutes.js';
import authRoutes from './auth/authRoutes.js';
import holidayRoutes from './holidays/holidayRoutes.js';
import notificationRoutes from './notifications/notificationRoutes.js';
import leaveRoutes from './leaves/leaveRoutes.js';

const router = express.Router();

// Mount feature-specific routes
router.use('/admin', adminRoutes);
router.use('/auth', authRoutes);
router.use('/holiday', holidayRoutes);
router.use('/policies', adminRoutes); // Since adminRoutes now exports /shifts
router.use('/notifications', notificationRoutes);
router.use('/leaves', leaveRoutes); // Since adminRoutes now exports /leaves
router.use('/', adminRoutes); // For /locations which hits root

router.get('/health', (req, res) => {
    res.json({ message: 'API is working' });
});

export default router;
