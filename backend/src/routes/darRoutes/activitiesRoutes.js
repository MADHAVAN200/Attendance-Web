import express from 'express';
import { authenticateJWT } from '../../middleware/auth.js';
import * as DarActivityController from '../../controllers/darControllers/activitiesControllers.js';

const router = express.Router();

// POST /dar/activity/create
router.post('/create', authenticateJWT, DarActivityController.createActivity);
// PUT /dar/activity/update/:id
router.put('/update/:id', authenticateJWT, DarActivityController.updateActivity);
// DELETE /dar/activity/delete/:id
router.delete('/delete/:id', authenticateJWT, DarActivityController.deleteActivity);
// GET /dar/activity/list
router.get('/list', authenticateJWT, DarActivityController.listActivities);
// GET /dar/activity/settings
router.get('/settings', authenticateJWT, DarActivityController.getSettings);
// GET /dar/activity/admin/all
router.get('/admin/all', authenticateJWT, DarActivityController.getAllActivitiesAdmin);

export default router;