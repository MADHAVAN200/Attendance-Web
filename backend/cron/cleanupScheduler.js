import cron from 'node-cron';
import { knexDB } from '../database.js';
import { deleteFile } from '../s3/s3Service.js';

/**
 * Cleanup Old Refresh Tokens
 * Removes tokens that are:
 * 1. Expired for more than 7 days (grace period)
 * 2. Revoked and older than 7 days
 */
async function cleanupRefreshTokens() {
    try {
        console.log('🧹 Starting refresh token cleanup...');

        const gracePeriodDays = 7;
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - gracePeriodDays);

        // Delete expired tokens (with grace period)
        const expiredCount = await knexDB('refresh_tokens')
            .where('expires_at', '<', cutoffDate)
            .del();

        // Delete old revoked tokens
        const revokedCount = await knexDB('refresh_tokens')
            .where('revoked', true)
            .where('created_at', '<', cutoffDate)
            .del();

        console.log(`✅ Cleanup complete: ${expiredCount} expired tokens, ${revokedCount} revoked tokens deleted.`);
    } catch (error) {
        console.error('❌ Error during refresh token cleanup:', error);
    }
}

/**
 * Cleanup Old Attendance Images
 * Removes images from S3 and database for attendance records older than 30 days
 */
async function cleanupAttendanceImages() {
    try {
        console.log('🧹 Starting attendance image cleanup...');

        const retentionDays = 30;
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

        // Find old records with images
        const oldRecords = await knexDB('attendance_records')
            .where('time_in', '<', cutoffDate)
            .where(function () {
                this.whereNotNull('time_in_image_key')
                    .orWhereNotNull('time_out_image_key');
            })
            .select('attendance_id', 'time_in_image_key', 'time_out_image_key');

        let deletedCount = 0;

        for (const record of oldRecords) {
            // Delete time_in image from S3
            if (record.time_in_image_key) {
                try {
                    await deleteFile({ key: record.time_in_image_key });
                    console.log(`🗑️  Deleted: ${record.time_in_image_key}`);
                    deletedCount++; 
                } catch (err) {
                    console.error(`Failed to delete ${record.time_in_image_key}:`, err.message);
                }
            }

            // Delete time_out image from S3
            if (record.time_out_image_key) {
                try {
                    await deleteFile({ key: record.time_out_image_key });
                    console.log(`🗑️  Deleted: ${record.time_out_image_key}`);
                    deletedCount++;
                } catch (err) {
                    console.error(`Failed to delete ${record.time_out_image_key}:`, err.message);
                }
            }

            // Update database record to null out the keys
            await knexDB('attendance_records')
                .where('attendance_id', record.attendance_id)
                .update({
                    time_in_image_key: null,
                    time_out_image_key: null,
                    updated_at: knexDB.fn.now()
                });
        }

        console.log(`✅ Cleanup complete: ${deletedCount} images deleted from ${oldRecords.length} records.`);
    } catch (error) {
        console.error('❌ Error during attendance image cleanup:', error);
    }
}

/**
 * Run all cleanup tasks
 */
export async function runCleanup() {
    console.log('🚀 Running scheduled cleanup tasks...');
    await cleanupRefreshTokens();
    await cleanupAttendanceImages();
    console.log('✅ All cleanup tasks completed.');
}

/**
 * Initialize the cleanup scheduler
 * Runs every day at 2:00 AM
 */
export function initCleanupScheduler() {
    // Schedule: Every day at 2:00 AM (server time)
    // Cron pattern: minute hour day month weekday
    // '0 2 * * *' = At 02:00 every day
    cron.schedule('0 2 * * *', async () => {
        await runCleanup();
    });

    console.log('📅 Cleanup scheduler initialized: Daily at 2:00 AM');
}
