
import express from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { knexDB } from "../database.js";
import catchAsync from "../utils/catchAsync.js";
import { authLimiter } from "../middleware/rateLimiter.js";
import OtpService from "../services/OtpService.js";
import { sendEmail } from "../utils/emailService.js";

const router = express.Router();

// Route: POST /forgot-password - Request OTP
router.post("/forgot-password", authLimiter, catchAsync(async (req, res) => {
    const { email } = req.body;

    if (!email) {
        return res.status(400).json({ message: "Email is required" });
    }

    console.log(`[DEBUG] Forgot Password Request for: ${email}`);
    const user = await knexDB('users')
        .where('email', email)
        .first();

    console.log(`[DEBUG] User found in DB: ${!!user}`);

    // Enumeration safe
    // Enumeration safe - DISABLED by user request
    if (!user) {
        console.log(`[DEBUG] User not found, returning 404.`);
        return res.status(404).json({
            message: "User does not exist"
        });
    }

    // 🔐 pass req for UA/IP binding
    const otp = OtpService.generateOtp(email, req);
    console.log(`[DEBUG] Generated OTP for ${email}: ${otp}`);

    const emailResult = await sendEmail({
        to: email,
        subject: "Password Reset OTP - Mano Attendance System",
        text: `Your OTP for password reset is: ${otp}. It expires in 5 minutes.`,
        html: `
      <div style="font-family: Arial, sans-serif; padding: 20px;">
        <h2>Password Reset Request</h2>
        <p>You requested a password reset. Please use the following OTP:</p>
        <h1 style="color: #4F46E5; letter-spacing: 5px;">${otp}</h1>
        <p>This code will expire in 5 minutes.</p>
        <p>If you did not request this, please ignore this email.</p>
      </div>
    `
    });


    if (!emailResult.ok) {
        return res.status(500).json({
            message: "Failed to send email. Please try again later."
        });
    }

    res.json({ message: "OTP sent to your email" });
}));


/* --------------------------------------------------- */


// Route: POST /verify-otp
router.post("/verify-otp", authLimiter, catchAsync(async (req, res) => {
    const { email, otp } = req.body;

    if (!email || !otp) {
        return res.status(400).json({ message: "Email and OTP are required" });
    }

    // 🔐 pass req for UA/IP validation + attempt limits
    const isValid = OtpService.verifyOtp(email, otp, req);

    if (!isValid) {
        return res.status(400).json({ message: "Invalid or expired OTP" });
    }

    const user = await knexDB('users')
        .where('email', email)
        .first();

    if (!user) {
        return res.status(400).json({ message: "User not found" });
    }

    const resetToken = jwt.sign(
        {
            user_id: user.user_id,
            email: user.email,
            type: "password_reset"
        },
        process.env.JWT_SECRET,
        { expiresIn: "5m" }
    );

    res.json({
        message: "OTP verified",
        resetToken
    });
}));


/* --------------------------------------------------- */
// Route: POST /reset-password
router.post("/reset-password", authLimiter, catchAsync(async (req, res) => {
    const { resetToken, newPassword } = req.body;

    if (!resetToken || !newPassword) {
        return res.status(400).json({
            message: "Token and new password are required"
        });
    }

    if (newPassword.length < 8) {
        return res.status(400).json({
            message: "Password must be at least 8 characters long"
        });
    }

    try {
        const decoded = jwt.verify(resetToken, process.env.JWT_SECRET);

        if (decoded.type !== "password_reset") {
            return res.status(403).json({ message: "Invalid token type" });
        }

        const hashedPassword = await bcrypt.hash(newPassword, 10);

        await knexDB("users")
            .where("user_id", decoded.user_id)
            .update({
                user_password: hashedPassword
            });

        res.json({
            message: "Password reset successfully. You can now login."
        });

    } catch (err) {
        if (err.name === 'TokenExpiredError') {
            return res.status(403).json({ message: "Reset token has expired. Please request a new OTP." });
        }
        return res.status(403).json({
            message: "Invalid or expired reset token"
        });
    }
}));

export default router;
