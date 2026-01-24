import express from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import * as DB from "../database.js";
import EventBus from "../utils/EventBus.js";
import { getEventSource } from "../utils/clientInfo.js";
import catchAsync from "../utils/catchAsync.js";
import { verifyCaptcha, generateCaptcha } from "../middleware/verifyCaptcha.js";
import { authLimiter } from "../middleware/rateLimiter.js";
import * as TokenService from "../services/tokenService.js";
import OtpService from "../services/OtpService.js";
import { sendEmail } from "../utils/emailService.js";

const ACCESS_TOKEN_EXPIRY = '15m';
const REFRESH_TOKEN_COOKIE_MAX_AGE = 7 * 24 * 60 * 60 * 1000; // 7 Days

const router = express.Router();

// Generate Captcha route
router.get("/captcha/generate", generateCaptcha);

export async function authenticateJWT(req, res, next) {
  try {
    let token;
    const authHeader = req.headers['authorization'];
    if (authHeader && authHeader.startsWith("Bearer ")) {
      token = authHeader.split(" ")[1];
    }
    if (!token) {
      return res.status(401).json({ message: "Unauthorized: No token provided" });
    }
    jwt.verify(token, process.env.JWT_SECRET, (err, decodedUser) => {
      if (err) {
        // Explicitly return 403 for expired/invalid, frontend uses this to trigger refresh
        return res.status(403).json({ message: "Forbidden: Invalid or expired token" });
      }

      req.user = {
        ...decodedUser,
        user_type: decodedUser.user_type?.toLowerCase()
      };
      next();
    });
  } catch (error) {
    console.error("❌ JWT Authentication Error:", error);
    return res.status(500).json({ message: "Internal Server Error during authentication" });
  }
}


// Login route
router.post("/login", authLimiter, verifyCaptcha, catchAsync(async (req, res) => {
  const { user_input, user_password } = req.body;

  if (!user_input || !user_password) {
    return res.status(400).json({ message: "Username and password are required." });
  }

  // 1. Fetch user by Email or Phone
  const user = await DB.knexDB('users')
    .leftJoin('departments', 'users.dept_id', 'departments.dept_id')
    .leftJoin('designations', 'users.desg_id', 'designations.desg_id')
    .leftJoin('shifts', 'users.shift_id', 'shifts.shift_id')
    .select(
      'users.user_id', 'users.user_code', 'users.user_name', 'users.user_password', 'users.email', 'users.phone_no', 'users.org_id', 'users.user_type',
      'users.profile_image_url', 'departments.dept_name', 'designations.desg_name', 'shifts.shift_name', 'shifts.shift_id'
    )
    .where('users.email', user_input)
    .orWhere('users.phone_no', user_input)
    .first();


  if (!user) {
    return res.status(401).json({ message: 'User not found' });
  }

  // 2. Compare password
  const isMatch = await bcrypt.compare(user_password, user.user_password);
  if (!isMatch) {
    return res.status(401).json({ message: 'Incorrect Password' });
  }

  // 3. Generate Access Token (JWT)
  const tokenPayload = {
    user_id: user.user_id,
    user_name: user.user_name,
    email: user.email,
    user_type: user.user_type,
    org_id: user.org_id,
    profile_image_url: user.profile_image_url
  };

  const accessToken = jwt.sign(tokenPayload, process.env.JWT_SECRET, { expiresIn: ACCESS_TOKEN_EXPIRY });

  // 4. Generate & Save Refresh Token (Opaque)
  const refreshToken = TokenService.generateRefreshToken();
  const ipAddress = req.ip || req.connection.remoteAddress;
  const userAgent = req.get('User-Agent') || 'Unknown';

  await TokenService.saveRefreshToken(user.user_id, refreshToken, ipAddress, userAgent);

  // 5. Set Refresh Token in Cookie (HttpOnly)
  res.cookie('refreshToken', refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production', // true in prod
    sameSite: 'Lax', // or 'Strict' depending on cross-site needs, 'Lax' is good for now
    maxAge: REFRESH_TOKEN_COOKIE_MAX_AGE,
    path: '/'
  });

  // Event Logging
  EventBus.emitActivityLog({
    user_id: user.user_id,
    org_id: user.org_id,
    event_type: "LOGIN",
    event_source: getEventSource(req),
    object_type: "USER",
    object_id: user.user_id,
    description: "User logged in successfully",
    request_ip: req.ip,
    user_agent: req.get('User-Agent')
  });

  // 6. Return response (Access Token in Body)
  res.status(200).json({
    accessToken: accessToken,
    user: {
      id: user.user_id,
      user_code: user.user_code,
      user_name: user.user_name,
      email: user.email,
      phone: user.phone_no,
      user_type: user.user_type,
      designation: user.desg_name,
      department: user.dept_name,
      org_id: user.org_id,
      avatar_url: user.profile_image_url
    }
  });

}));


// Refresh Token Route
router.post("/refresh", async (req, res) => {
  const refreshToken = req.cookies.refreshToken;

  if (!refreshToken) {
    return res.status(401).json({ message: "No refresh token provided" });
  }

  try {
    const result = await TokenService.verifyRefreshToken(refreshToken);

    if (!result) {
      // Invalid or expired
      res.clearCookie('refreshToken');
      return res.status(403).json({ message: "Invalid refresh token" });
    }

    if (result.error) {
      // Reuse detected!
      res.clearCookie('refreshToken');
      return res.status(403).json({ message: "Security Alert: Token reuse detected. Re-login required." });
    }

    const { user } = result;

    // Rotate Token: Revoke old, Issue new
    const newRefreshToken = TokenService.generateRefreshToken();
    const ipAddress = req.ip;
    const userAgent = req.get('User-Agent');

    await TokenService.revokeRefreshToken(refreshToken, newRefreshToken);
    await TokenService.saveRefreshToken(user.user_id, newRefreshToken, ipAddress, userAgent);

    // Issue new Access Token
    const tokenPayload = {
      user_id: user.user_id,
      user_name: user.user_name,
      email: user.email,
      user_type: user.user_type,
      org_id: user.org_id,
      profile_image_url: user.profile_image_url
    };
    const newAccessToken = jwt.sign(tokenPayload, process.env.JWT_SECRET, { expiresIn: ACCESS_TOKEN_EXPIRY });

    // Set new cookie
    res.cookie('refreshToken', newRefreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'Lax',
      maxAge: REFRESH_TOKEN_COOKIE_MAX_AGE,
      path: '/'
    });

    res.json({ accessToken: newAccessToken });

  } catch (error) {
    console.error("Refresh Logic Error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});


// Route: GET /me - Check current auth/session
router.get("/me", authenticateJWT, catchAsync(async (req, res) => {
  // Fetch fresh user data to ensure avatar updates are reflected immediately
  const user = await DB.knexDB('users')
    .where('user_id', req.user.user_id)
    .select('user_code', 'user_name', 'email', 'user_type', 'org_id', 'profile_image_url')
    .first();

  if (!user) {
    return res.status(404).json({ message: "User not found" });
  }

  res.json({
    user_id: req.user.user_id,
    user_code: user.user_code,
    user_name: user.user_name,
    email: user.email,
    user_type: user.user_type,
    org_id: user.org_id,
    avatar_url: user.profile_image_url,
    profile_image_url: user.profile_image_url
  });
}));

// Route: POST /forgot-password - Request OTP
router.post("/forgot-password", authLimiter, catchAsync(async (req, res) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ message: "Email is required" });
  }

  console.log(`[DEBUG] Forgot Password Request for: ${email}`);
  const user = await DB.knexDB('users')
    .where('email', email)
    .first();

  console.log(`[DEBUG] User found in DB: ${!!user}`);

  // Enumeration safe
  if (!user) {
    console.log(`[DEBUG] User not found, returning generic success message.`);
    return res.status(200).json({
      message: "If your email is registered, you will receive an OTP shortly."
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

  const user = await DB.knexDB('users')
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

    await DB.knexDB("users")
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


// Route: POST /logout - Clear cookie
router.post("/logout", async (req, res) => {
  const refreshToken = req.cookies.refreshToken;
  if (refreshToken) {
    await TokenService.revokeRefreshToken(refreshToken);
  }

  res.clearCookie("refreshToken", {
    path: '/' // Important to match the path used to set it
  });
  res.json({ message: "Logged out successfully" });
});

export default router;
