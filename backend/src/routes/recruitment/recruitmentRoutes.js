import express from 'express';
import multer from 'multer';
import { authenticateJWT, requireActiveOrg } from '../../middleware/auth.js';
import {
  getOpenings,
  createOpening,
  toggleOpeningStatus,
  getPublicOpening,
  getPipelineStages,
  savePipelineStages,
  getTemplates,
  saveTemplate,
  deleteTemplate,
  getCandidatesForJob,
  applyForJob,
  updateCandidateStage
} from '../../controllers/recruitmentController.js';

const router = express.Router();
const upload = multer(); // For handling memory uploads of PDF resumes

// --- PUBLIC ENDPOINTS (No Auth Required) ---
router.get('/public-opening/:slug', getPublicOpening);
router.post('/candidates/:jobId/apply', upload.single('resume'), applyForJob);

// --- PROTECTED ENDPOINTS (Requires Auth) ---
router.use(authenticateJWT, requireActiveOrg);

// Job postings
router.get('/openings', getOpenings);
router.post('/openings', createOpening);
router.put('/openings/:id/status', toggleOpeningStatus);

// Pipeline Customization
router.get('/pipeline-stages', getPipelineStages);
router.post('/pipeline-stages', savePipelineStages);

// Custom saved templates
router.get('/templates', getTemplates);
router.post('/templates', saveTemplate);
router.delete('/templates/:id', deleteTemplate);

// Candidate applications & pipeline
router.get('/candidates', getCandidatesForJob);
router.put('/candidates/:id/stage', updateCandidateStage);

export default router;
