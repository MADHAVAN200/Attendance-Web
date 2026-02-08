import express from 'express';
import multer from 'multer';
import { attendanceDB } from '../database.js';
import { authenticateJWT } from '../middleware/auth.js';
import catchAsync from '../utils/catchAsync.js';
import { uploadCompressedImage, getFileUrl, deleteFile } from '../s3/s3Service.js';

const router = express.Router();
const upload = multer();

router.post('/', authenticateJWT, upload.single('avatar'), catchAsync(async (req, res) => {
    const { user_id, org_id } = req.user;
    const file = req.file;

    if (!file) {
        return res.status(400).json({ ok: false, message: 'No image file provided' });
    }

    // 1. Fetch user_code for naming
    const user = await attendanceDB('users').where({ user_id }).select('user_code').first();
    const userCode = user?.user_code || `user_${user_id}`;

    // 2. Upload to S3 with compression
    const key = `${userCode}`;
    const uploadResult = await uploadCompressedImage({
        fileBuffer: file.buffer,
        key: key,
        directory: "public/profile_pics",
        quality: 90
    });
    console.log(uploadResult);

    // 3. Update database
    await attendanceDB('users')
        .where({ user_id })
        .update({
            profile_image_url: uploadResult.url, // Storing full URL instead of key
            updated_at: attendanceDB.fn.now()
        });

    res.json({
        ok: true,
        message: 'Profile picture updated successfully',
        profile_image_url: uploadResult.url
    });
}));

router.delete('/', authenticateJWT, catchAsync(async (req, res) => {
    const { user_id } = req.user;

    // 1. Fetch user data to get user_code and current profile_image_url
    const user = await attendanceDB('users').where({ user_id }).select('user_code', 'profile_image_url').first();

    if (!user) {
        return res.status(404).json({ ok: false, message: 'User not found' });
    }

    // 2. If user has a profile picture, delete it from S3
    if (user.profile_image_url) {
        const userCode = user.user_code || `user_${user_id}`;
        // The file is always stored as .webp in northern-star upload logic
        const key = `${userCode}.webp`;

        try {
            await deleteFile({
                key: key,
                directory: "public/profile_pics"
            });
        } catch (error) {
            console.error('Error deleting file from S3:', error);
            // We continue even if S3 delete fails, or we could choose to fail here.
            // Usually, it's safer to proceed with DB update if the intent is to "remove" it.
        }
    }

    // 3. Update database to remove profile_image_url
    await attendanceDB('users')
        .where({ user_id })
        .update({
            profile_image_url: null,
            updated_at: attendanceDB.fn.now()
        });

    res.json({
        ok: true,
        message: 'Profile picture removed successfully'
    });
}));


router.get('/me', authenticateJWT, catchAsync(async (req, res) => {
    const { user_id } = req.user;

    const user = await attendanceDB('users as u')
        .leftJoin('designations as d', 'u.desg_id', 'd.desg_id')
        .leftJoin('departments as dep', 'u.dept_id', 'dep.dept_id')
        .select(
            'u.user_id',
            'u.user_name',
            'u.email',
            'u.phone_no',
            'u.user_type',
            'u.profile_image_url',
            'd.desg_name',
            'dep.dept_name'
        )
        .where('u.user_id', user_id)
        .first();

    if (!user) {
        return res.status(404).json({ ok: false, message: 'User not found' });
    }

    res.json({
        ok: true,
        user: {
            ...user,
            profile_image_url: user.profile_image_url
        }
    });
}));

export default router;
