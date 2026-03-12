import express from 'express';
import { authenticateJWT } from '../../middleware/auth.js';
import AppError from '../../utils/AppError.js';
import * as monitorController from '../../controllers/admin/systemMonitorController.js';

const router = express.Router();

// Middleware to ensure only Super Admins can access these routes
const requireSuperAdmin = (req, res, next) => {
    if (req.user.user_type !== 'super_admin') {
        return next(new AppError('Forbidden: System Monitor access requires Super Admin privileges', 403));
    }
    next();
};

router.use(authenticateJWT, requireSuperAdmin);

// Security Alerts
router.get('/alerts', monitorController.getSecurityAlerts);
router.put('/alerts/:id', monitorController.updateSecurityAlertStatus);

// User Feedback
router.get('/feedback', monitorController.getUserFeedback);
router.put('/feedback/:id', monitorController.updateFeedbackStatus);

// System Logs
router.get('/logs/errors', monitorController.getErrorLogs);
router.get('/logs/activity', monitorController.getActivityLogs);

export default router;
