import express from 'express';
import { authenticateJWT } from '../../middleware/auth.js';
import * as LocationController from "../../controllers/employees/employeeControllers.js";

const router = express.Router();

// GET /employee/locations
router.get('/locations', authenticateJWT, LocationController.getLocations);

export default router;
