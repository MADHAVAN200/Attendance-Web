import cron from 'node-cron';
import { attendanceDB } from '../config/database.js';
import { deleteFile } from '../services/s3/s3Service.js';
import { permanentlyDeleteUser } from '../services/users/userService.js';

/**
 * Cleanup Old Refresh Tokens
 * Removes tokens expired or revoked for more than 7 days.
 */
async function cleanupRefreshTokens() {
    try {
        console.log('🧹 Starting refresh token cleanup...');

        const gracePeriodDays = 7;
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - gracePeriodDays);

        const expiredCount = await attendanceDB('refresh_tokens')
            .where('expires_at', '<', cutoffDate)
            .del();

        const revokedCount = await attendanceDB('refresh_tokens')
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
 * Removes images from S3 and database for attendance records older than 30 days.
 */
async function cleanupAttendanceImages() {
    try {
        console.log('🧹 Starting attendance image cleanup...');

        const retentionDays = 30;
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

        const oldRecords = await attendanceDB('attendance_records')
            .where('time_in', '<', cutoffDate)
            .where(function () {
                this.whereNotNull('time_in_image_key')
                    .orWhereNotNull('time_out_image_key');
            })
            .select('attendance_id', 'time_in_image_key', 'time_out_image_key');

        let deletedCount = 0;

        for (const record of oldRecords) {
            if (record.time_in_image_key) {
                try {
                    await deleteFile({ key: record.time_in_image_key });
                    deletedCount++;
                } catch (err) {
                    console.error(`Failed to delete ${record.time_in_image_key}:`, err.message);
                }
            }

            if (record.time_out_image_key) {
                try {
                    await deleteFile({ key: record.time_out_image_key });
                    deletedCount++;
                } catch (err) {
                    console.error(`Failed to delete ${record.time_out_image_key}:`, err.message);
                }
            }

            await attendanceDB('attendance_records')
                .where('attendance_id', record.attendance_id)
                .update({
                    time_in_image_key: null,
                    time_out_image_key: null,
                    updated_at: attendanceDB.fn.now()
                });
        }

        console.log(`✅ Cleanup complete: ${deletedCount} images deleted from ${oldRecords.length} records.`);
    } catch (error) {
        console.error('❌ Error during attendance image cleanup:', error);
    }
}

/**
 * Cleanup Soft Deleted Users
 * Permanently deletes users who have been in trash for more than 30 days.
 */
async function cleanupDeletedUsers() {
    try {
        console.log('🧹 Running cleanupDeletedUsers...');

        const retentionDays = 30;
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

        const usersToDelete = await attendanceDB('users')
            .where('is_deleted', true)
            .andWhere('deleted_at', '<', cutoffDate)
            .select('user_id');

        console.log(`Found ${usersToDelete.length} users to permanently delete.`);

        for (const user of usersToDelete) {
            await permanentlyDeleteUser(user.user_id);
        }

        if (usersToDelete.length > 0) {
            console.log('✅ Cleanup of deleted users completed.');
        }
    } catch (error) {
        console.error('❌ Error cleaning up deleted users:', error);
    }
}

/**
 * Cleanup Organizations Pending Deletion
 * Permanently deletes organizations (and all associated data) whose
 * deletion_scheduled_at date has passed.
 */
async function cleanupDeletedOrganizations() {
    try {
        console.log('🧹 Running cleanupDeletedOrganizations...');

        const now = new Date();

        const orgsToDelete = await attendanceDB('organizations')
            .where('status', 'pending_deletion')
            .andWhere('deletion_scheduled_at', '<=', now)
            .select('org_id', 'org_name', 'org_code');

        console.log(`Found ${orgsToDelete.length} organization(s) to permanently delete.`);

        for (const org of orgsToDelete) {
            // Delete all data associated with this organization inside a transaction.
            // Add more tables here as your schema grows.
            await attendanceDB.transaction(async (trx) => {
                await trx('attendance_records')
                    .whereIn('user_id', trx('users').select('user_id').where('org_id', org.org_id))
                    .del();

                await trx('refresh_tokens')
                    .whereIn('user_id', trx('users').select('user_id').where('org_id', org.org_id))
                    .del();

                await trx('users').where('org_id', org.org_id).del();

                await trx('organizations').where('org_id', org.org_id).del();
            });

            console.log(`🗑️  Permanently deleted organization: ${org.org_name} (${org.org_code})`);
        }

        if (orgsToDelete.length > 0) {
            console.log('✅ Cleanup of pending-deletion organizations completed.');
        }
    } catch (error) {
        console.error('❌ Error cleaning up pending-deletion organizations:', error);
    }
}

/**
 * Run all cleanup tasks.
 */
export async function runCleanup() {
    console.log('🚀 Running scheduled cleanup tasks...');
    await cleanupRefreshTokens();
    await cleanupAttendanceImages();
    await cleanupDeletedUsers();
    await cleanupDeletedOrganizations();
    console.log('✅ All cleanup tasks completed.');
}

/**
 * Initialize the cleanup scheduler.
 * Runs every day at 2:00 AM.
 */
export function initCleanupScheduler() {
    cron.schedule('0 2 * * *', async () => {
        await runCleanup();
    });

    console.log('📅 Cleanup scheduler initialized: Daily at 2:00 AM');
}
