import express from 'express';
import multer from 'multer';
import { authenticateJWT } from '../middleware/auth.js';
import * as adminController from '../controllers/adminController.js';

const router = express.Router();
const upload = multer(); // memory storage

// Protected by JWT
router.use(authenticateJWT);

// User Operations
router.get('/users', adminController.getAllUsers);
router.get('/user/:user_id', adminController.getUserById);
router.post('/user', adminController.createUser);
router.put('/user/:user_id', adminController.updateUser);
router.delete('/user/:user_id', adminController.softDeleteUser);
router.delete('/user/:user_id/force', adminController.forceDeleteUser);
router.post('/user/:user_id/restore', adminController.restoreUser);
router.put('/user/:user_id/status', adminController.toggleUserStatus);
router.post('/users/bulk', upload.single('file'), adminController.bulkCreateUsers);
router.post('/users/bulk-validate', adminController.bulkValidateUsers);

// Lookups
router.get('/departments', adminController.getDepartments);
router.post('/departments', adminController.createDepartment);

router.get('/designations', adminController.getDesignations);
router.post('/designations', adminController.createDesignation);

router.get('/shifts', adminController.getShifts);
router.post('/shifts', adminController.createShift);
router.put('/shifts/:shift_id', adminController.updateShift);
router.delete('/shifts/:shift_id', adminController.deleteShift);

// Locations (Frontend might use /locations or /api/locations depending on proxy, mounting here first)
router.get('/locations', adminController.getWorkLocations);

export default router;
