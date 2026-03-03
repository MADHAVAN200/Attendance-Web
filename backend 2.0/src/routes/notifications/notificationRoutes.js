import express from 'express';
import { authenticateJWT } from '../../middleware/auth.js';
import { getNotifications,markAsRead,markAllAsRead } 
from '../../controllers/notifications/notificationController.js';


const router = express.Router();

router.get('/',authenticateJWT,getNotifications);
router.put('/:id/read',authenticateJWT,markAsRead);
router.put('/read-all',authenticateJWT,markAllAsRead);

export default router;