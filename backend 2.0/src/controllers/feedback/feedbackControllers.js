import catchAsync from '../../utils/catchAsync.js';
import AppError from '../../utils/AppError.js';
import * as feedbackService from '../../services/feedback/feedbackService.js';

const MAX_TOTAL_SIZE = 50 * 1024 * 1024; // 50MB

/**
 * POST /feedback - Submit new feedback with optional file attachments
 */
export const submitFeedback = catchAsync(async (req, res) => {
    const user_id = req.user.user_id;
    const { title, description, type = 'FEEDBACK' } = req.body;
    const files = req.files || [];

    if (!title || !description) {
        throw new AppError('Title and description are required', 400);
    }

    const totalSize = files.reduce((sum, file) => sum + file.size, 0);
    if (totalSize > MAX_TOTAL_SIZE) {
        throw new AppError(`Total file size exceeds limit of 50MB. Current size: ${(totalSize / 1024 / 1024).toFixed(2)}MB`, 400);
    }

    const result = await feedbackService.submitFeedback(user_id, {
        title,
        description,
        type,
        files
    });

    res.status(201).json({
        ok: true,
        message: 'Feedback submitted successfully',
        ...result
    });
});

/**
 * GET /feedback - Admin only: List all feedback with attachments
 */
export const getFeedbackList = catchAsync(async (req, res) => {
    if (req.user.user_type !== 'admin') {
        throw new AppError('Access denied. Admin only.', 403);
    }

    const { status, type, limit = 50 } = req.query;

    const feedbackWithAttachments = await feedbackService.getFeedbackList({
        status,
        type,
        limit
    });

    res.json({
        ok: true,
        data: feedbackWithAttachments,
        count: feedbackWithAttachments.length
    });
});

/**
 * PATCH /feedback/:id/status - Admin only: Update feedback status
 */
export const updateFeedbackStatus = catchAsync(async (req, res) => {
    if (req.user.user_type !== 'admin') {
        throw new AppError('Access denied. Admin only.', 403);
    }

    const { id } = req.params;
    const { status } = req.body;

    const validStatuses = ['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'];
    if (!status || !validStatuses.includes(status)) {
        throw new AppError(`Invalid status. Must be one of: ${validStatuses.join(', ')}`, 400);
    }

    const success = await feedbackService.updateStatus(id, status);

    if (!success) {
        throw new AppError('Feedback not found', 404);
    }

    res.json({
        ok: true,
        message: 'Status updated successfully'
    });
});
