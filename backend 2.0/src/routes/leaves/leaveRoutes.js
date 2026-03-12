import express from 'express';
import { authenticateJWT, requireActiveOrg } from '../../middleware/auth.js';
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

// Apply common middleware to all routes in this file
router.use(authenticateJWT, requireActiveOrg);

// Employee Routes
router.get('/my-history', LeaveController.getMyHistory);
router.post('/request', upload.array('attachments', 5), LeaveController.submitLeaveRequest);
router.delete('/request/:id', LeaveController.withdrawLeaveRequest);

// Admin Routes
router.get('/admin/pending', ensureAdmin, LeaveController.getPendingRequests);
router.get('/admin/history', ensureAdmin, LeaveController.getAdminHistory);
router.put('/admin/status/:id', ensureAdmin, LeaveController.updateLeaveStatus);

export default router;