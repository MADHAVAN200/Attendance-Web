import express from "express";
import { authenticateJWT } from '../../middleware/auth.js';
import * as reportsController from '../../controllers/reports/reportsController.js';

const router = express.Router();

// GET /admin/reports/preview
router.get("/preview", authenticateJWT, reportsController.previewReport);

// GET /admin/reports/download OR /attendance/reports/download
router.get("/download", authenticateJWT, reportsController.downloadReport);

export default router;