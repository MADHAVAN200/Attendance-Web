import express from 'express';
import multer from 'multer';
import { authenticateJWT, requireActiveOrg } from '../../middleware/auth.js';
import ensureAdmin from '../../middleware/ensureAdmin.js';
import { attendanceDB } from '../../config/database.js';
import { uploadFile, getFileUrl, deleteFile, getFileStream } from '../../services/s3/s3Service.js';

const router = express.Router();
const upload = multer({
    limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

// Protect all routes
router.use(authenticateJWT, requireActiveOrg);

// GET /api/employee/onboarding/:employee_id/progress
router.get('/:employee_id/progress', async (req, res) => {
    const { employee_id } = req.params;

    try {
        // 1. Fetch user's assigned templates
        const user = await attendanceDB('users')
            .where({ user_id: employee_id })
            .select('checklist_template_id', 'document_template_id')
            .first();

        if (!user) {
            return res.status(404).json({ success: false, message: "User not found" });
        }

        // 2. Fetch templates items
        let checklist_items = [];
        let required_documents = [];

        if (user.checklist_template_id) {
            checklist_items = await attendanceDB('onboarding_checklist_items')
                .where({ template_id: user.checklist_template_id })
                .orderBy('sort_order', 'asc');
        }

        if (user.document_template_id) {
            required_documents = await attendanceDB('required_document_items')
                .where({ template_id: user.document_template_id })
                .orderBy('sort_order', 'asc');
        }

        // 3. Fetch progress logs
        const checklist_progress = await attendanceDB('employee_checklist_progress')
            .where({ employee_id });

        const uploaded_documents = await attendanceDB('employee_uploaded_documents')
            .where({ employee_id });

        res.json({
            success: true,
            checklist_template_id: user.checklist_template_id,
            document_template_id: user.document_template_id,
            checklist_items,
            checklist_progress,
            required_documents,
            uploaded_documents
        });
    } catch (error) {
        console.error("Error fetching onboarding progress:", error);
        res.status(500).json({ success: false, message: error.message });
    }
});

// POST /api/employee/onboarding/checklist/toggle
router.post('/checklist/toggle', async (req, res) => {
    const { employee_id, task_key, is_completed } = req.body;

    if (!employee_id || !task_key) {
        return res.status(400).json({ success: false, message: "Missing required fields" });
    }

    try {
        const existing = await attendanceDB('employee_checklist_progress')
            .where({ employee_id, task_key })
            .first();

        if (existing) {
            await attendanceDB('employee_checklist_progress')
                .where({ id: existing.id })
                .update({
                    is_completed: !!is_completed,
                    completed_at: is_completed ? attendanceDB.fn.now() : null,
                    completed_by: is_completed ? req.user.user_id : null
                });
        } else {
            await attendanceDB('employee_checklist_progress')
                .insert({
                    employee_id,
                    task_key,
                    is_completed: !!is_completed,
                    completed_at: is_completed ? attendanceDB.fn.now() : null,
                    completed_by: is_completed ? req.user.user_id : null
                });
        }

        res.json({ success: true });
    } catch (error) {
        console.error("Error toggling checklist item:", error);
        res.status(500).json({ success: false, message: error.message });
    }
});

// POST /api/employee/onboarding/assign-templates (Admin only)
router.post('/assign-templates', ensureAdmin, async (req, res) => {
    const { employee_id, checklist_template_id, document_template_id } = req.body;

    if (!employee_id) {
        return res.status(400).json({ success: false, message: "Employee ID is required" });
    }

    try {
        const updates = {};
        if (checklist_template_id !== undefined) {
            updates.checklist_template_id = checklist_template_id || null;
            
            // Delete all current checklist progress for this employee
            await attendanceDB('employee_checklist_progress')
                .where({ employee_id })
                .del();
        }
        if (document_template_id !== undefined) {
            updates.document_template_id = document_template_id || null;

            // Fetch and delete all uploaded documents from S3 and database
            const docs = await attendanceDB('employee_uploaded_documents')
                .where({ employee_id });

            for (const doc of docs) {
                try {
                    await deleteFile({ key: doc.file_key });
                } catch (s3DelErr) {
                    console.warn(`Could not delete file ${doc.file_key} from S3 on template reassign:`, s3DelErr);
                }
            }

            await attendanceDB('employee_uploaded_documents')
                .where({ employee_id })
                .del();
        }

        await attendanceDB('users')
            .where({ user_id: employee_id })
            .update(updates);

        res.json({ success: true, message: "Templates assigned successfully" });
    } catch (error) {
        console.error("Error assigning templates:", error);
        res.status(500).json({ success: false, message: error.message });
    }
});

// POST /api/employee/onboarding/upload-document
router.post('/upload-document', upload.single('file'), async (req, res) => {
    const { employee_id, doc_key } = req.body;

    if (!employee_id || !doc_key || !req.file) {
        return res.status(400).json({ success: false, message: "Missing required fields or file" });
    }

    try {
        const timestamp = Date.now();
        const cleanName = req.file.originalname.replace(/\s+/g, '_');
        const fileKey = `onboarding-documents/org_${req.user.org_id}/user_${employee_id}/${doc_key}/${timestamp}_${cleanName}`;

        // Upload to S3
        await uploadFile({
            fileBuffer: req.file.buffer,
            key: fileKey,
            contentType: req.file.mimetype
        });

        // Check if there is an existing uploaded document record
        const existing = await attendanceDB('employee_uploaded_documents')
            .where({ employee_id, doc_key })
            .first();

        let insertedOrUpdated;

        if (existing) {
            // Delete old file from S3 asynchronously/safely
            try {
                await deleteFile({ key: existing.file_key });
            } catch (s3DelErr) {
                console.warn(`Could not delete previous file ${existing.file_key} from S3:`, s3DelErr);
            }

            await attendanceDB('employee_uploaded_documents')
                .where({ id: existing.id })
                .update({
                    file_name: req.file.originalname,
                    file_key: fileKey,
                    file_type: req.file.mimetype,
                    uploaded_at: attendanceDB.fn.now(),
                    verified_status: 'Pending',
                    verification_comments: null,
                    verified_by: null,
                    verified_at: null
                });

            insertedOrUpdated = await attendanceDB('employee_uploaded_documents').where({ id: existing.id }).first();
        } else {
            const [newId] = await attendanceDB('employee_uploaded_documents')
                .insert({
                    employee_id,
                    doc_key,
                    file_name: req.file.originalname,
                    file_key: fileKey,
                    file_type: req.file.mimetype,
                    verified_status: 'Pending'
                });

            insertedOrUpdated = await attendanceDB('employee_uploaded_documents').where({ id: newId }).first();
        }

        res.status(201).json({ success: true, doc: insertedOrUpdated });
    } catch (error) {
        console.error("Error uploading onboarding document:", error);
        res.status(500).json({ success: false, message: error.message });
    }
});

// PUT /api/employee/onboarding/document/:id/verify (Admin only)
router.put('/document/:id/verify', ensureAdmin, async (req, res) => {
    const { id } = req.params;
    const { status, comments } = req.body;

    if (!status) {
        return res.status(400).json({ success: false, message: "Status is required" });
    }

    try {
        const affected = await attendanceDB('employee_uploaded_documents')
            .where({ id })
            .update({
                verified_status: status,
                verification_comments: comments || null,
                verified_by: req.user.user_id,
                verified_at: attendanceDB.fn.now()
            });

        if (!affected) {
            return res.status(404).json({ success: false, message: "Uploaded document record not found" });
        }

        res.json({ success: true, message: `Document verification status updated to ${status}` });
    } catch (error) {
        console.error("Error verifying document:", error);
        res.status(500).json({ success: false, message: error.message });
    }
});

// GET /api/employee/onboarding/document-url/:id
router.get('/document-url/:id', async (req, res) => {
    const { id } = req.params;

    try {
        const doc = await attendanceDB('employee_uploaded_documents')
            .where({ id })
            .first();

        if (!doc) {
            return res.status(404).json({ success: false, message: "Document record not found" });
        }

        const { url } = await getFileUrl({
            key: doc.file_key,
            expiresIn: 3600,
            filename: doc.file_name,
            inline: true
        });

        res.json({ success: true, url });
    } catch (error) {
        console.error("Error generating signed download URL:", error);
        res.status(500).json({ success: false, message: error.message });
    }
});

// GET /api/employee/onboarding/document-content/:id
router.get('/document-content/:id', async (req, res) => {
    const { id } = req.params;

    try {
        const doc = await attendanceDB('employee_uploaded_documents')
            .where({ id })
            .first();

        if (!doc) {
            return res.status(404).json({ success: false, message: "Document record not found" });
        }

        const stream = await getFileStream(doc.file_key);
        
        res.setHeader('Content-Type', doc.file_type || 'application/octet-stream');
        res.setHeader('Content-Disposition', `attachment; filename="${doc.file_name}"`);
        
        stream.pipe(res);
    } catch (error) {
        console.error("Error streaming onboarding document content:", error);
        res.status(500).json({ success: false, message: error.message });
    }
});

// DELETE /api/employee/onboarding/document/:id
router.delete('/document/:id', async (req, res) => {
    const { id } = req.params;

    try {
        const doc = await attendanceDB('employee_uploaded_documents')
            .where({ id })
            .first();

        if (!doc) {
            return res.status(404).json({ success: false, message: "Document record not found" });
        }

        // Delete from S3
        try {
            await deleteFile({ key: doc.file_key });
        } catch (s3DelErr) {
            console.warn(`Could not delete file ${doc.file_key} from S3:`, s3DelErr);
        }

        // Delete from DB
        await attendanceDB('employee_uploaded_documents')
            .where({ id })
            .del();

        res.json({ success: true, message: "Document deleted successfully" });
    } catch (error) {
        console.error("Error deleting onboarding document:", error);
        res.status(500).json({ success: false, message: error.message });
    }
});

export default router;
