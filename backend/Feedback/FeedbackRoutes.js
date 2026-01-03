import express from "express";
import { knexDB } from "../database.js";
import { authenticateJWT } from "../AuthAPI/LoginAPI.js";
import multer from "multer";
import { uploadFile, getFileUrl } from "../s3/s3Service.js";
import catchAsync from "../utils/catchAsync.js";

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

    // Insert feedback record
    const [feedback_id] = await knexDB('feedback').insert({
        user_id,
        type,
        title,
        description,
        status: 'OPEN',
        created_at: knexDB.fn.now(),
        updated_at: knexDB.fn.now()
    });

    // Upload files and create attachment records
    const attachments = [];
    for (const file of files) {
        const timestamp = Date.now();
        const sanitizedName = file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
        const key = `${feedback_id}_${timestamp}_${sanitizedName}`;

        try {
            const uploadResult = await uploadFile({
                fileBuffer: file.buffer,
                key: key,
                directory: `feedback/${feedback_id}`,
                contentType: file.mimetype
            });

            await knexDB('feedback_attachments').insert({
                feedback_id,
                file_key: uploadResult.key,
                file_name: file.originalname,
                file_type: file.mimetype,
                file_size: file.size
            });

            attachments.push({
                file_name: file.originalname,
                file_size: file.size,
                file_type: file.mimetype
            });
        } catch (error) {
            console.error('Error uploading file:', error);
            // Continue with other files even if one fails
        }
    }

    return res.status(201).json({
        ok: true,
        message: "Feedback submitted successfully",
        feedback_id,
        attachments_count: attachments.length,
        attachments
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

    let query = knexDB('feedback')
        .join('users', 'feedback.user_id', 'users.user_id')
        .select(
            'feedback.*',
            'users.user_name',
            'users.email'
        )
        .orderBy('feedback.created_at', 'desc')
        .limit(Math.min(parseInt(limit), 100));

    if (status) {
        query = query.where('feedback.status', status);
    }
    if (type) {
        query = query.where('feedback.type', type);
    }

    const feedbackRecords = await query;

    // Fetch attachments for each feedback and generate signed URLs
    const feedbackWithAttachments = await Promise.all(
        feedbackRecords.map(async (feedback) => {
            const attachments = await knexDB('feedback_attachments')
                .where('feedback_id', feedback.feedback_id)
                .select('*');

            const attachmentsWithUrls = await Promise.all(
                attachments.map(async (attachment) => {
                    try {
                        const { url } = await getFileUrl({
                            key: attachment.file_key,
                            expiresIn: 3600 // 1 hour
                        });
                        return {
                            ...attachment,
                            url
                        };
                    } catch (error) {
                        console.error('Error generating URL for attachment:', error);
                        return attachment;
                    }
                })
            );

            return {
                ...feedback,
                attachments: attachmentsWithUrls
            };
        })
    );

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

    const updated = await knexDB('feedback')
        .where('feedback_id', id)
        .update({
            status,
            updated_at: knexDB.fn.now()
        });

    if (updated === 0) {
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
