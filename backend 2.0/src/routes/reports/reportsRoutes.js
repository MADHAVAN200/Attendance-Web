import express from "express";
import { authenticateJWT, requireActiveOrg } from '../../middleware/auth.js';
import * as reportsController from '../../controllers/reports/reportsController.js';

const router = express.Router();

router.use(authenticateJWT, requireActiveOrg);

// GET /admin/reports/preview
router.get("/preview", reportsController.previewReport);

// GET /admin/reports/download OR /attendance/reports/download
router.get("/download", reportsController.downloadReport);

export default router;