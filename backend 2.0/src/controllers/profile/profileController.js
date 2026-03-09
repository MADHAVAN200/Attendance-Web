import catchAsync from '../../utils/catchAsync.js';
import AppError from '../../utils/AppError.js';
import * as profileService from '../../services/profile/profileService.js';

/**
 * POST /profile - Upload profile picture
 */
export const uploadProfilePicture = catchAsync(async (req, res) => {
    const { user_id } = req.user;
    const file = req.file;

    if (!file) {
        throw new AppError('No image file provided', 400);
    }

    const profile_image_url = await profileService.uploadProfilePicture(user_id, file.buffer);

    res.json({
        ok: true,
        message: 'Profile picture updated successfully',
        profile_image_url
    });
});

/**
 * DELETE /profile - Remove profile picture
 */
export const deleteProfilePicture = catchAsync(async (req, res) => {
    const { user_id } = req.user;

    const deleted = await profileService.deleteProfilePicture(user_id);

    if (!deleted) {
        throw new AppError('User not found', 404);
    }

    res.json({
        ok: true,
        message: 'Profile picture removed successfully'
    });
});

/**
 * GET /profile/me - Get current user profile
 */
export const getMyProfile = catchAsync(async (req, res) => {
    const { user_id } = req.user;

    const user = await profileService.getMyProfile(user_id);

    if (!user) {
        throw new AppError('User not found', 404);
    }

    res.json({
        ok: true,
        user: {
            ...user,
            profile_image_url: user.profile_image_url
        }
    });
});
