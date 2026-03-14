import express from 'express';
import { authenticateJWT } from '../../middleware/auth.js';
import * as DarRequestController from '../../controllers/darControllers/requestsControllers.js';

const router = express.Router();

// POST /dar/request/create
router.post('/create', authenticateJWT, DarRequestController.createRequest);
// GET /dar/request/list
router.get('/list', authenticateJWT, DarRequestController.listRequests);
// GET /dar/request/pending
router.post('/approve/:id', authenticateJWT, DarRequestController.approveRequest);
// POST /dar/request/reject/:id
router.post('/reject/:id', authenticateJWT, DarRequestController.rejectRequest);

export default router;