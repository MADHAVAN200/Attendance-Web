import express from 'express';
import multer from 'multer';
import { authenticateJWT, requireActiveOrg } from '../../middleware/auth.js';
import * as holidaysController from '../../controllers/holidays/holidaysController.js';
import ensureAdmin from '../../middleware/ensureAdmin.js';

const router = express.Router();
const upload = multer();

// Global Middleware for these routes
router.use(authenticateJWT, requireActiveOrg);

// GET /holiday - Get all holidays for the organization
router.get('/', holidaysController.getHolidays);
// POST /holiday - Add new holidays (bulk or single)
router.post('/', ensureAdmin, holidaysController.addHolidays);
// POST /bulk-validate - Validate holidays before import
router.post('/bulk-validate', ensureAdmin, holidaysController.validateBulkHolidays);
// POST /bulk-json - Create holidays from parsed JSON
router.post('/bulk-json', ensureAdmin, holidaysController.bulkCreateFromJson);
// POST /bulk - Upload holidays from CSV/Excel file
router.post('/bulk', ensureAdmin, upload.single('file'), holidaysController.bulkUploadFromFile);
// PUT /:id - Single Update
router.put('/:id', ensureAdmin, holidaysController.updateHoliday);
// DELETE /holiday - Delete holidays (expects { ids: [...] } in body)
router.delete('/', ensureAdmin, holidaysController.deleteHolidays);


export default router;

