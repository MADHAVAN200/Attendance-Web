
import express from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { attendanceDB } from "../database.js";
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
    const user = await attendanceDB('users')
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

    const userName = user?.user_name || 'there';

    const emailHtml = `
<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">

<style>
body {
    margin: 0;
    padding: 0;
    width: 100% !important;
    background-color: #F2F2F2;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;
}

.wrapper {
    width: 100%;
    background-color: #F2F2F2;
}

.container {
    width: 100%;
    max-width: 600px;
    margin: 0 auto;
    background-color: #FFFFFF;
}

.header {
    background-color: #2F3A45;
    padding: 26px 20px;
    text-align: center;
}
.header h1 {
    color: #FFFFFF;
    margin: 0;
    font-size: 22px;
    font-weight: 600;
}
.header p {
    color: #D1D5DB;
    margin-top: 6px;
    font-size: 14px;
}

.content {
    padding: 26px 20px;
}

.badge {
    display: inline-block;
    padding: 6px 12px;
    border-radius: 4px;
    font-size: 12px;
    font-weight: 600;
    background-color: #ede9fe;
    color: #7c3aed;
    text-transform: uppercase;
}

.date {
    font-size: 14px;
    color: #6B7280;
    margin-left: 12px;
}

h2 {
    color: #1A1A1A;
    font-size: 20px;
    margin-bottom: 16px;
}

.description-box,
.info-card {
    background-color: #FFFFFF;
    border: 1px solid #D1D5DB;
    border-radius: 6px;
    padding: 16px;
}

.label {
    font-size: 12px;
    font-weight: 600;
    color: #4B5563;
    text-transform: uppercase;
    margin-bottom: 6px;
}

.value {
    font-size: 15px;
    color: #1A1A1A;
    line-height: 1.6;
}

.divider {
    height: 1px;
    background-color: #D1D5DB;
    margin: 24px 0;
}

.info-row {
    margin-bottom: 12px;
}

.footer {
    background-color: #F2F2F2;
    padding: 16px;
    text-align: center;
    border-top: 1px solid #D1D5DB;
}
.footer p {
    font-size: 13px;
    color: #6B7280;
    margin: 4px 0;
}

/* MOBILE */
@media only screen and (max-width: 480px) {
    .content {
        padding: 18px 14px;
    }
    h2 {
        font-size: 18px;
    }
    .header h1 {
        font-size: 20px;
    }
    .date {
        display: block;
        margin-left: 0;
        margin-top: 6px;
    }
}
</style>
</head>

<body>
<div class="wrapper">
<div class="container">

    <div class="header">
        <h1>Secure Your Account</h1>
        <p>Mano Attendance System</p>
    </div>

    <div class="content">
        <div style="margin-bottom: 18px;">
            <span class="badge">Verification Code</span>
            <span class="date">Valid for 5 minutes</span>
        </div>

        <h2>Hi ${userName},</h2>
        
        <p style="color: #374151; font-size: 15px; line-height: 1.6; margin-bottom: 20px;">
            We received a request to reset your password. No worries, it happens! Please use the following code to continue:
        </p>

        <div class="description-box" style="padding: 30px 16px;">
            <div class="value" style="font-size: 42px; font-weight: 900; color: #4F46E5; letter-spacing: 12px; margin: 0; text-align: center;">
                ${otp}
            </div>
        </div>

        <div class="divider"></div>

        <div class="info-card">
            <div class="info-row">
                <div class="label">Sent To:</div>
                <div class="value">${email}</div>
            </div>
            <div class="info-row">
                <div class="label" style="color: #6366f1;">Safety Check:</div>
                <div class="value" style="font-size: 13px; color: #4B5563;">
                    If you didn't ask for this reset, you can safely ignore this email. Your password won't change unless you use the code above.
                </div>
            </div>
            <div style="margin-top: 15px; padding-top: 10px; border-top: 1px dashed #E5E7EB; text-align: right;">
                <span style="font-size: 10px; color: #9CA3AF; text-transform: uppercase; letter-spacing: 1px;">Request ID: ${Date.now().toString().slice(-6)}-${otp}</span>
            </div>
        </div>

    </div>

    <div class="footer">
        <p><strong>Mano Attendance System</strong></p>
        <p>This is an automated mail sent to protect your account. Please do not reply.</p>
    </div>

    </div>
</div>
</div>
</body>
</html>
    `;

    const emailResult = await sendEmail({
        to: email,
        subject: "Secure your account - Mano Attendance System",
        text: `Hi ${userName}, your verification code is ${otp}. It remains valid for 5 minutes.`,
        html: emailHtml
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

    const user = await attendanceDB('users')
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

        await attendanceDB("users")
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
