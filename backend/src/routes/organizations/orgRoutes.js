import express from 'express';
import * as orgController from '../../controllers/organizations/orgController.js';
import { authenticateJWT, authorize } from '../../middleware/auth.js';

const router = express.Router();

router.use(authenticateJWT, authorize('super_admin'));

router.post('/', orgController.createOrganization);
router.get('/', orgController.getOrganizations);
router.put('/:id', orgController.updateOrganization);
router.get('/:id/admins', orgController.getOrgAdmins);
router.put('/:id/admins/:adminId', orgController.updateOrgAdmin);

export default router;
