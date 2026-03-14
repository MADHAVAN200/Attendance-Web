import express from 'express';
import * as authController from '../../controllers/auth/authController.js';
import { authenticateJWT } from '../../middleware/auth.js';
import { generateCaptcha } from '../../middleware/verifyCaptcha.js';
import { authLimiter, loginIpLimiter } from '../../middleware/rateLimiter.js';

const router = express.Router();

// Captcha
router.get("/captcha/generate", generateCaptcha);

// Public Routes (Rate-Limited)
router.post('/login', loginIpLimiter, authLimiter, authController.login);
router.post('/super-admin/login', loginIpLimiter, authLimiter, authController.superAdminLogin);
router.post('/forgot-password', authLimiter, authController.requestPasswordReset);
router.post('/verify-otp', authLimiter, authController.verifyOtp);
router.post('/reset-password', authLimiter, authController.resetPassword);

// Token / Session
router.post('/refresh', authController.refreshToken);
router.post('/logout', authController.logout);

// Protected Auth Details
router.get('/me', authenticateJWT, authController.getCurrentUser);

export default router;
