import express from 'express';
import { authenticateJWT } from '../../middleware/auth.js';
import * as ShiftController from '../../controllers/shifts/shiftController.js';

const router = express.Router();

// Shift CRUD
router.get('/shifts', authenticateJWT, ShiftController.getShifts);
router.post('/shifts', authenticateJWT, ShiftController.createShift);
router.put('/shifts/:shift_id', authenticateJWT, ShiftController.updateShift);
router.delete('/shifts/:shift_id', authenticateJWT, ShiftController.deleteShift);

// Shift assignment
router.get('/shift-users', authenticateJWT, ShiftController.getShiftUsers);
router.put('/users/:user_id/shift', authenticateJWT, ShiftController.assignUserShift);

export default router;
