import { attendanceDB } from '../../config/database.js';
import { uploadCompressedImage, deleteFile } from '../s3/s3Service.js';

/**
 * Upload and update a user's profile picture.
 */
export async function uploadProfilePicture(user_id, fileBuffer) {
    const user = await attendanceDB('users').where({ user_id }).select('user_code').first();
    const userCode = user?.user_code || `user_${user_id}`;

    const uploadResult = await uploadCompressedImage({
        fileBuffer,
        key: userCode,
        directory: 'public/profile_pics',
        quality: 90
    });

    await attendanceDB('users')
        .where({ user_id })
        .update({
            profile_image_url: uploadResult.url,
            updated_at: attendanceDB.fn.now()
        });

    return uploadResult.url;
}

/**
 * Delete a user's profile picture from S3 and clear the DB field.
 */
export async function deleteProfilePicture(user_id) {
    const user = await attendanceDB('users').where({ user_id }).select('user_code', 'profile_image_url').first();

    if (!user) return false;

    if (user.profile_image_url) {
        const userCode = user.user_code || `user_${user_id}`;
        const key = `${userCode}.webp`;

        try {
            await deleteFile({ key, directory: 'public/profile_pics' });
        } catch (error) {
            console.error('Error deleting file from S3:', error);
        }
    }

    await attendanceDB('users')
        .where({ user_id })
        .update({
            profile_image_url: null,
            updated_at: attendanceDB.fn.now()
        });

    return true;
}

/**
 * Get the current user's profile info.
 */
export async function getMyProfile(user_id) {
    return await attendanceDB('users as u')
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
}
