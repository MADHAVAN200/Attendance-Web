import express from 'express';
import multer from 'multer';
import { knexDB } from '../database.js';
import { authenticateJWT } from '../AuthAPI/LoginAPI.js';
import catchAsync from '../utils/catchAsync.js';
import { uploadCompressedImage, getFileUrl } from '../s3/s3Service.js';

const router = express.Router();
const upload = multer();

router.post('/', authenticateJWT, upload.single('avatar'), catchAsync(async (req, res) => {
    const { user_id, org_id } = req.user;
    const file = req.file;

    if (!file) {
        return res.status(400).json({ ok: false, message: 'No image file provided' });
    }

    // 1. Fetch user_code for naming
    const user = await knexDB('users').where({ user_id }).select('user_code').first();
    const userCode = user?.user_code || `user_${user_id}`;

    // 2. Upload to S3 with compression
    const key = `${userCode}`;
    const uploadResult = await uploadCompressedImage({
        fileBuffer: file.buffer,
        key: key,
        directory: "public/profile_pics"
    });
    console.log(uploadResult);

    // 3. Update database
    await knexDB('users')
        .where({ user_id })
        .update({
            profile_image_key: uploadResult.url, // Storing full URL instead of key
            updated_at: knexDB.fn.now()
        });

    res.json({
        ok: true,
        message: 'Profile picture updated successfully',
        avatar_url: uploadResult.url
    });
}));


router.get('/me', authenticateJWT, catchAsync(async (req, res) => {
    const { user_id } = req.user;

    const user = await knexDB('users as u')
        .leftJoin('designations as d', 'u.desg_id', 'd.desg_id')
        .leftJoin('departments as dep', 'u.dept_id', 'dep.dept_id')
        .select(
            'u.user_id',
            'u.user_name',
            'u.email',
            'u.phone_no',
            'u.user_type',
            'u.profile_image_key',
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
            avatar_url: user.profile_image_key
        }
    });
}));

export default router;
