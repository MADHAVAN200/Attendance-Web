import express from 'express';
import { authenticateJWT, requireActiveOrg } from '../../middleware/auth.js';
import ensureAdmin from '../../middleware/ensureAdmin.js';
import * as WorkLocationController from '../../controllers/workLocations/workLocationsController.js';

const router = express.Router();

router.use(authenticateJWT, requireActiveOrg);

// GET /locations - List all active locations for the user's org
router.get('/', WorkLocationController.getLocations);
// POST /locations - Add a new location
router.post('/', ensureAdmin, WorkLocationController.createLocation);
// PUT /locations/:id - Update location
router.put('/:id', ensureAdmin, WorkLocationController.updateLocation);
// DELETE /locations/:id - Soft delete location
router.delete('/:id', ensureAdmin, WorkLocationController.deleteLocation);
// POST /locations/assignments - Bulk assign users to locations
router.post('/assignments', ensureAdmin, WorkLocationController.bulkAssign);

export default router;