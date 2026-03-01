import express from 'express';
import adminRoutes from './adminRoutes.js';
import authRoutes from './authRoutes.js';

const router = express.Router();

// Mount feature-specific routes
router.use('/admin', adminRoutes);
router.use('/auth', authRoutes);

// Frontend compatibility aliases
router.use('/policies', adminRoutes); // Since adminRoutes now exports /shifts
router.use('/', adminRoutes); // For /locations which hits root

router.get('/health', (req, res) => {
    res.json({ message: 'API is working' });
});

export default router;
