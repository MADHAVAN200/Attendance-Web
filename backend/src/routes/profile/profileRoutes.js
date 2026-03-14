import express from 'express';
import multer from 'multer';
import { authenticateJWT } from '../../middleware/auth.js';
import * as profileController from '../../controllers/profile/profileController.js';

const router = express.Router();
const upload = multer();

router.use(authenticateJWT);

router.post('/', upload.single('avatar'), profileController.uploadProfilePicture);
router.delete('/', profileController.deleteProfilePicture);
router.get('/me', profileController.getMyProfile);

export default router;
