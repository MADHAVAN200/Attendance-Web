import express from 'express';
import { authenticateJWT } from '../../middleware/auth.js';
import * as DarEventController from '../../controllers/darControllers/eventsControllers.js';


const router = express.Router();

// POST /dar/event/create
router.post('/create', authenticateJWT, DarEventController.createEvent);
// GET /dar/event/list
router.get('/list', authenticateJWT, DarEventController.listEvents);
// PUT /dar/event/update/:id
router.put('/update/:id', authenticateJWT, DarEventController.updateEvent);
// DELETE /dar/event/delete/:id
router.delete('/delete/:id', authenticateJWT, DarEventController.deleteEvent);

export default router;