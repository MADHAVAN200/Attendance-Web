import express from 'express';
import { attendanceDB } from '../database.js';
import { authenticateJWT } from '../middleware/auth.js';
import catchAsync from '../utils/catchAsync.js';
import AppError from '../utils/AppError.js';

import multer from 'multer';
import { uploadFile, getFileUrl } from '../s3/s3Service.js';

const router = express.Router();
const upload = multer();

// POST /apply - Submit a job application
router.post('/apply', upload.single('resume_url'), catchAsync(async (req, res) => {
    const { job_id, name, email, phone, referred_by, org_id } = req.body;
    const file = req.file;

    // 1. Validation
    if (!job_id || !name || !email || !phone) {
        throw new AppError('Job ID, name, email, and phone are required.', 400);
    }

    if (!file) {
        throw new AppError('Resume file is required.', 400);
    }

    // 2. Fetch Job Details (to get org_id and verify job exists)
    const job = await attendanceDB('job_description').where({ job_id }).first();
    if (!job) {
        throw new AppError('Job not found.', 404);
    }

    const applicationOrgId = org_id || job.org_id;

    // 3. Upload Resume to S3
    const timestamp = Date.now();
    const fileName = `${timestamp}_${file.originalname.replace(/\s+/g, '_')}`;
    const uploadResult = await uploadFile({
        fileBuffer: file.buffer,
        key: fileName,
        directory: 'resumes',
        contentType: file.mimetype
    });

    if (!uploadResult.success) {
        throw new AppError('Failed to upload resume to S3.', 500);
    }

    // 4. Save to Database
    const [insertedId] = await attendanceDB('job_application').insert({
        job_id,
        name,
        email,
        phone,
        resume_url: uploadResult.url,
        referred_by: referred_by || null,
        status: 'PENDING',
        org_id: applicationOrgId,
        created_at: attendanceDB.fn.now(),
        updated_at: attendanceDB.fn.now()
    });

    // 5. Generate signed URL for the response
    const signedUrlResult = await getFileUrl({
        key: fileName,
        directory: 'resumes'
    });

    res.status(201).json({
        ok: true,
        message: 'Application submitted successfully.',
        data: {
            app_id: insertedId,
            resume_url: signedUrlResult.url
        }
    });
}));

// GET /jobs - List active job descriptions
router.get('/jobs', catchAsync(async (req, res) => {
    const jobs = await attendanceDB('job_description')
        .select('job_id', 'title', 'description', 'created_at')
        .orderBy('created_at', 'desc');

    res.json({
        ok: true,
        data: jobs
    });
}));

export default router;
