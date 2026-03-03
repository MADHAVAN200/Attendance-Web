import express from 'express';
import { authenticateJWT } from '../../middleware/auth.js';
import multer from 'multer';
import * as LeaveController from '../../controllers/leaves/leaveController.js';
import ensureAdmin from '../../middleware/ensureAdmin.js';

// Multer Setup (Memory Storage)
const storage = multer.memoryStorage();
const upload = multer({
    storage,
    limits: { fileSize: 5 * 1024 * 1024, files: 5 }, // 5MB limit, max 5 files
    fileFilter: (req, file, cb) => {
        const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
        if (allowedTypes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('Invalid file type. Only Images and PDFs are allowed.'));
        }
    }
});

const router = express.Router();

// Employee Routes
router.get('/my-history', authenticateJWT, LeaveController.getMyHistory);
router.post('/request', authenticateJWT, upload.array('attachments', 5), LeaveController.submitLeaveRequest);
router.delete('/request/:id', authenticateJWT, LeaveController.withdrawLeaveRequest);

// Admin Routes
router.get('/admin/pending', authenticateJWT, ensureAdmin, LeaveController.getPendingRequests);
router.get('/admin/history', authenticateJWT, ensureAdmin, LeaveController.getAdminHistory);
router.put('/admin/status/:id', authenticateJWT, ensureAdmin, LeaveController.updateLeaveStatus);

export default router;