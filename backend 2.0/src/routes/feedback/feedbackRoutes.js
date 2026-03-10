import express from 'express';
import multer from 'multer';
import { authenticateJWT } from '../../middleware/auth.js';
import * as feedbackController from '../../controllers/feedback/feedbackControllers.js';

const router = express.Router();
const upload = multer(); // memory storage

router.use(authenticateJWT);

// Submit feedback with optional file attachments (max 10 files) 
router.post('/', upload.array('files', 10), feedbackController.submitFeedback);

// Admin only: Get list of feedback with attachments
router.get('/', feedbackController.getFeedbackList);

// Admin only: Update feedback status (e.g. OPEN, IN_PROGRESS, RESOLVED)
router.patch('/:id/status', feedbackController.updateFeedbackStatus);

export default router;
