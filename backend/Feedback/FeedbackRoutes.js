import express from "express";
import { authenticateJWT } from '../middleware/auth.js';
import multer from "multer";
import catchAsync from "../utils/catchAsync.js";
import FeedbackService from "../services/FeedbackService.js";

const router = express.Router();
const upload = multer(); // Store files in memory

// File size limit: 50MB total per request
const MAX_TOTAL_SIZE = 50 * 1024 * 1024; // 50MB in bytes

// POST /feedback - Submit new feedback with optional file attachments
router.post("/", authenticateJWT, upload.array('files', 10), catchAsync(async (req, res) => {
    const user_id = req.user.user_id;
    const { title, description, type = 'FEEDBACK' } = req.body;
    const files = req.files || [];

    // Validation
    if (!title || !description) {
        return res.status(400).json({
            ok: false,
            message: "Title and description are required"
        });
    }

    // Validate total file size
    const totalSize = files.reduce((sum, file) => sum + file.size, 0);
    if (totalSize > MAX_TOTAL_SIZE) {
        return res.status(400).json({
            ok: false,
            message: `Total file size exceeds limit of 50MB. Current size: ${(totalSize / 1024 / 1024).toFixed(2)}MB`
        });
    }

    // Use service to handle all business logic (DB, S3, Email)
    const result = await FeedbackService.submitFeedback(user_id, {
        title,
        description,
        type,
        files
    });

    return res.status(201).json({
        ok: true,
        message: "Feedback submitted successfully",
        ...result
    });
}));

// GET /feedback - Admin only: List all feedback with attachments
router.get("/", authenticateJWT, catchAsync(async (req, res) => {
    if (req.user.user_type !== 'admin') {
        return res.status(403).json({
            ok: false,
            message: "Access denied. Admin only."
        });
    }

    const { status, type, limit = 50 } = req.query;

    // Use service to fetch feedback list
    const feedbackWithAttachments = await FeedbackService.getFeedbackList({
        status,
        type,
        limit
    });

    return res.json({
        ok: true,
        data: feedbackWithAttachments,
        count: feedbackWithAttachments.length
    });
}));

// PATCH /feedback/:id/status - Admin only: Update feedback status
router.patch("/:id/status", authenticateJWT, catchAsync(async (req, res) => {
    if (req.user.user_type !== 'admin') {
        return res.status(403).json({
            ok: false,
            message: "Access denied. Admin only."
        });
    }

    const { id } = req.params;
    const { status } = req.body;

    const validStatuses = ['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'];
    if (!status || !validStatuses.includes(status)) {
        return res.status(400).json({
            ok: false,
            message: `Invalid status. Must be one of: ${validStatuses.join(', ')}`
        });
    }

    // Use service to update status
    const success = await FeedbackService.updateStatus(id, status);

    if (!success) {
        return res.status(404).json({
            ok: false,
            message: "Feedback not found"
        });
    }

    return res.json({
        ok: true,
        message: "Status updated successfully"
    });
}));

export default router;
