import express from 'express';
import { authenticateJWT } from '../middleware/auth.js';
import * as holidaysController from '../controllers/holidaysController.js';
import ensureAdmin from '../middleware/ensureAdmin.js';

const router = express.Router();

// GET /holiday - Get all holidays for the organization
router.get('/',authenticateJWT, holidaysController.getHolidays);
// POST /holiday - Add new holidays (bulk or single)
router.post('/', authenticateJWT,ensureAdmin, holidaysController.addHolidays);
// PUT /:id - Single Update
router.put('/:id', authenticateJWT,ensureAdmin, holidaysController.updateHoliday);
// DELETE /holiday - Delete holidays (expects { ids: [...] } in body)
router.delete('/', authenticateJWT, ensureAdmin, holidaysController.deleteHolidays);


export default router;

