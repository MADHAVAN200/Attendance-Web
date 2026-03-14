import express from 'express';
import { authenticateJWT } from '../../middleware/auth.js';
import * as superAdminController from '../../controllers/superAdmin/superAdminController.js';

const router = express.Router();

router.use(authenticateJWT);

router.get('/dashboard-stats', superAdminController.getDashboardStats);

export default router;
