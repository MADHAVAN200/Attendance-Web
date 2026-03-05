import express from 'express';
import { authenticateJWT } from '../../middleware/auth.js';
import ensureAdmin from '../../middleware/ensureAdmin.js';
import * as WorkLocationController from '../../controllers/workLocations/workLocationsController.js';

const router = express.Router();

// GET /locations - List all active locations for the user's org
router.get('/', authenticateJWT, WorkLocationController.getLocations);
// POST /locations - Add a new location
router.post('/', authenticateJWT, ensureAdmin, WorkLocationController.createLocation);
// PUT /locations/:id - Update location
router.put('/:id', authenticateJWT, ensureAdmin, WorkLocationController.updateLocation);
// DELETE /locations/:id - Soft delete location
router.delete('/:id', authenticateJWT, ensureAdmin, WorkLocationController.deleteLocation);
// POST /locations/assignments - Bulk assign users to locations
router.post('/assignments', authenticateJWT, ensureAdmin, WorkLocationController.bulkAssign);

export default router;