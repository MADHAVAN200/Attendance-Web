import { Worker } from 'bullmq';
import { redisConnection } from '../config/queues.js';
import { attendanceDB } from '../config/database.js';
import { compileReportBuffer } from '../controllers/reports/reportsController.js';
import * as S3Service from '../services/s3/s3Service.js';
import EventBus from '../utils/EventBus.js';

const reportWorker = new Worker('{ReportQueue}', async (job) => {
    const { reportId, org_id, user_id, targetUserId, month, date, type, format } = job.data;
    console.log(`👷 [Worker] Processing report job #${reportId} for Org ${org_id}...`);

    // 1. Update database status to 'processing'
    await attendanceDB('generated_reports')
        .where({ report_id: reportId })
        .update({ status: 'processing', updated_at: attendanceDB.fn.now() });

    try {
        // 2. Generate the report buffer asynchronously
        const fileBuffer = await compileReportBuffer({ org_id, targetUserId, month, date, type, format });

        // 3. Define content type & S3 directory details
        const contentType = format === 'pdf' 
            ? 'application/pdf' 
            : format === 'csv'
                ? 'text/csv'
                : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

        const s3Key = `${reportId}.${format}`;
        const s3Directory = `reports/${org_id}`;

        // 4. Upload file buffer to S3
        await S3Service.uploadFile({
            fileBuffer,
            key: s3Key,
            directory: s3Directory,
            contentType
        });

        // 5. Generate signed S3 url (valid for 24 hours / 86400 seconds)
        const { url: preSignedUrl } = await S3Service.getFileUrl({
            key: s3Key,
            directory: s3Directory,
            expiresIn: 86400,
            filename: job.data.filename
        });

        // 6. Update Database tracking row as completed
        await attendanceDB('generated_reports')
            .where({ report_id: reportId })
            .update({
                status: 'completed',
                file_url: preSignedUrl,
                updated_at: attendanceDB.fn.now()
            });

        console.log(`✅ [Worker] Completed report job #${reportId}. Uploaded to S3 successfully.`);

        // 7. Fire notification Event! (Phase 1 EventBus will auto-save to DB and push via Socket.io)
        EventBus.emitNotification({
            org_id,
            user_id,
            title: "Report Ready",
            message: `Your requested ${type.replace(/_/g, ' ')} (${format.toUpperCase()}) report is completed and ready for download.`,
            type: "SUCCESS",
            related_entity_type: "REPORT",
            related_entity_id: reportId
        });

    } catch (err) {
        console.error(`❌ [Worker] Error generating report job #${reportId}:`, err);

        // Update database tracking row as failed
        await attendanceDB('generated_reports')
            .where({ report_id: reportId })
            .update({
                status: 'failed',
                error_message: err.message || 'Unknown error occurred',
                updated_at: attendanceDB.fn.now()
            });

        // Fire failure notification to user
        EventBus.emitNotification({
            org_id,
            user_id,
            title: "Report Failed",
            message: `Your requested ${type.replace(/_/g, ' ')} report generation failed: ${err.message}`,
            type: "ERROR",
            related_entity_type: "REPORT",
            related_entity_id: reportId
        });

        throw err; // Signal BullMQ the job failed
    }
}, {
    connection: redisConnection,
    concurrency: 2 // Max 2 reports processed in parallel per worker process
});

reportWorker.on('completed', (job) => {
    console.log(`🏁 [Worker] Job #${job.id} completed.`);
});

reportWorker.on('failed', (job, err) => {
    console.error(`💥 [Worker] Job #${job.id} failed with error:`, err);
});

reportWorker.on('error', (err) => {
    // Catch worker connection errors silently as redisConnection manages warnings
});

export default reportWorker;
