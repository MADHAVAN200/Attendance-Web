import express from 'express';
import multer from 'multer';
import { authenticateJWT } from '../../middleware/auth.js';
import * as holidaysController from '../../controllers/holidays/holidaysController.js';
import ensureAdmin from '../../middleware/ensureAdmin.js';

const router = express.Router();
const upload = multer();

// GET /holiday - Get all holidays for the organization
router.get('/',authenticateJWT, holidaysController.getHolidays);
// POST /holiday - Add new holidays (bulk or single)
router.post('/', authenticateJWT,ensureAdmin, holidaysController.addHolidays);
// POST /bulk-validate - Validate holidays before import
router.post('/bulk-validate', authenticateJWT, ensureAdmin, holidaysController.validateBulkHolidays);
// POST /bulk-json - Create holidays from parsed JSON
router.post('/bulk-json', authenticateJWT, ensureAdmin, holidaysController.bulkCreateFromJson);
// POST /bulk - Upload holidays from CSV/Excel file
router.post('/bulk', authenticateJWT, ensureAdmin, upload.single('file'), holidaysController.bulkUploadFromFile);
// PUT /:id - Single Update
router.put('/:id', authenticateJWT,ensureAdmin, holidaysController.updateHoliday);
// DELETE /holiday - Delete holidays (expects { ids: [...] } in body)
router.delete('/', authenticateJWT, ensureAdmin, holidaysController.deleteHolidays);


export default router;

