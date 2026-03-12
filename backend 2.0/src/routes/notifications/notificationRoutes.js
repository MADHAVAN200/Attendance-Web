import express from 'express';
import { authenticateJWT, requireActiveOrg } from '../../middleware/auth.js';
import { getNotifications, markAsRead, markAllAsRead }
    from '../../controllers/notifications/notificationController.js';


const router = express.Router();

router.use(authenticateJWT, requireActiveOrg);

router.get('/', getNotifications);
router.put('/:id/read', markAsRead);
router.put('/read-all', markAllAsRead);

export default router;