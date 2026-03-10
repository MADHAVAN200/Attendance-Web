import express from 'express';
import { authenticateJWT } from '../middleware/auth.js';
import { runCleanup } from '../cron/cleanupScheduler.js';
import catchAsync from '../utils/catchAsync.js';

const router = express.Router();

/**
 * Manual trigger for cleanup tasks (Admin only)
 * Useful for testing and manual maintenance
 */

router.post('/cleanup/trigger', authenticateJWT, catchAsync(async (req, res) => {
    // Only allow admin users to trigger cleanup
    if (req.user.user_type !== 'admin') {
        return res.status(403).json({
            ok: false,
            message: 'Access denied. Admin only.'
        });
    }

    console.log(`🔧 Manual cleanup triggered by user: ${req.user.user_name}`);

    // Run cleanup asynchronously, don't wait for completion
    runCleanup().catch(err => {
        console.error('Cleanup error:', err);
    });

    res.json({
        ok: true,
        message: 'Cleanup task started. Check server logs for progress.'
    });
}));

export default router;
