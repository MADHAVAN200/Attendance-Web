import { attendanceDB } from '../database.js';
import { deleteFile } from '../s3/s3Service.js';

class UserCleanupService {

    /**
     * Permanently deletes a user and all associated data.
     * Handles S3 file cleanup and database record deletion.
     * @param {number} userId - The ID of the user to delete
     * @returns {Promise<boolean>} - True if successful
     */
    async permanentlyDeleteUser(userId) {
        const trx = await attendanceDB.transaction();

        try {
            console.log(`[UserCleanup] Starting permanent deletion for user ${userId}`);

            // 1. Fetch User Details (for profile image)
            const user = await trx('users').where('user_id', userId).first();
            if (!user) {
                console.warn(`[UserCleanup] User ${userId} not found, aborting.`);
                await trx.rollback();
                return false;
            }

            // 2. Refresh Tokens
            await trx('refresh_tokens').where('user_id', userId).del();

            // 3. Notifications
            await trx('notifications').where('user_id', userId).del();

            // 4. Activity & Error Logs
            await trx('user_activity_logs').where('user_id', userId).del();
            await trx('application_error_logs').where('user_id', userId).del();

            // 5. Leave Requests & Attachments
            const leaveRequests = await trx('leave_requests').where('user_id', userId).select('lr_id');
            const leaveIds = leaveRequests.map(lr => lr.lr_id);

            if (leaveIds.length > 0) {
                const leaveAttachments = await trx('leave_attachments').whereIn('leave_id', leaveIds).select('file_key');

                // Delete S3 Files
                for (const attachment of leaveAttachments) {
                    if (attachment.file_key) await this.safeDeleteS3(attachment.file_key);
                }

                // DB Cleanup
                await trx('leave_attachments').whereIn('leave_id', leaveIds).del();
                await trx('leave_requests').whereIn('lr_id', leaveIds).del();
            }

            // 6. Feedback & Attachments
            const feedbacks = await trx('feedback').where('user_id', userId).select('feedback_id');
            const feedbackIds = feedbacks.map(f => f.feedback_id);

            if (feedbackIds.length > 0) {
                const feedbackAttachments = await trx('feedback_attachments').whereIn('feedback_id', feedbackIds).select('file_key');

                for (const attachment of feedbackAttachments) {
                    if (attachment.file_key) await this.safeDeleteS3(attachment.file_key);
                }

                await trx('feedback_attachments').whereIn('feedback_id', feedbackIds).del();
                await trx('feedback').whereIn('feedback_id', feedbackIds).del();
            }

            // 7. Attendance Records & Images
            const attendanceRecords = await trx('attendance_records').where('user_id', userId).select('time_in_image_key', 'time_out_image_key');

            for (const record of attendanceRecords) {
                if (record.time_in_image_key) await this.safeDeleteS3(record.time_in_image_key);
                if (record.time_out_image_key) await this.safeDeleteS3(record.time_out_image_key);
            }

            await trx('attendance_records').where('user_id', userId).del();

            // 8. Profile Image
            if (user.profile_image_url) {
                const key = this.extractKeyFromUrl(user.profile_image_url);
                if (key) await this.safeDeleteS3(key);
            }

            // 9. Delete User
            await trx('users').where('user_id', userId).del();

            await trx.commit();
            console.log(`[UserCleanup] Successfully deleted user ${userId}`);
            return true;

        } catch (error) {
            console.error(`[UserCleanup] Failed to delete user ${userId}:`, error);
            await trx.rollback();
            throw error;
        }
    }

    /**
     * Safely deletes a file from S3, catching errors.
     * @param {string} key 
     */
    async safeDeleteS3(key) {
        try {
            await deleteFile({ key });
        } catch (error) {
            console.warn(`[UserCleanup] Failed to delete S3 file ${key}:`, error.message);
        }
    }

    /**
     * Extracts S3 key from a full URL if possible, or returns the string if it looks like a key.
     * @param {string} url 
     */
    extractKeyFromUrl(url) {
        if (!url) return null;
        try {
            // detailed check for common S3 URL patterns
            const bucketDomain = 's3.amazonaws.com';
            if (url.includes(bucketDomain)) {
                // https://BUCKET.s3.amazonaws.com/KEY
                const parts = url.split(bucketDomain + '/');
                if (parts.length > 1) return parts[1];
            }
            // If it doesn't look like a URL, assume it's a key
            if (!url.startsWith('http')) return url;

            return null;
        } catch (e) {
            return null;
        }
    }
}

export default new UserCleanupService();
