import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { attendanceDB } from '../../config/database.js';
import EventBus from '../../utils/EventBus.js';
import AppError from '../../utils/AppError.js';
import * as TokenService from './tokenService.js';
import OtpService from './OtpService.js';
import { sendEmail } from './emailService.js';

const ACCESS_TOKEN_EXPIRY = '15m';

export const authenticateUser = async (userInput, password, reqInfo) => {
    const user = await attendanceDB('users')
        .leftJoin('departments', 'users.dept_id', 'departments.dept_id')
        .leftJoin('designations', 'users.desg_id', 'designations.desg_id')
        .leftJoin('shifts', 'users.shift_id', 'shifts.shift_id')
        .select(
            'users.user_id', 'users.user_code', 'users.user_name', 'users.user_password', 'users.email', 'users.phone_no', 'users.org_id', 'users.user_type',
            'users.profile_image_url', 'users.is_active', 'users.is_deleted',
            'departments.dept_name', 'designations.desg_name', 'shifts.shift_name', 'shifts.shift_id'
        )
        .where('users.email', userInput)
        .orWhere('users.phone_no', userInput)
        .first();

    if (!user) throw new AppError('User not found', 401);
    if (user.is_deleted) throw new AppError('Your account has been deleted. Please contact support.', 403);
    if (!user.is_active) throw new AppError('Your account is inactive. Please contact HR.', 403);

    const isMatch = await bcrypt.compare(password, user.user_password);
    if (!isMatch) throw new AppError('Incorrect Password', 401);

    const tokenPayload = {
        user_id: user.user_id,
        user_name: user.user_name,
        email: user.email,
        user_type: user.user_type,
        org_id: user.org_id,
        profile_image_url: user.profile_image_url
    };

    const accessToken = jwt.sign(tokenPayload, process.env.JWT_SECRET, { expiresIn: ACCESS_TOKEN_EXPIRY });
    const refreshToken = TokenService.generateRefreshToken();

    await TokenService.saveRefreshToken(user.user_id, refreshToken, reqInfo.ip, reqInfo.userAgent);

    try {
        EventBus.emitActivityLog({
            user_id: user.user_id,
            org_id: user.org_id,
            event_type: "LOGIN",
            event_source: "API",
            object_type: "USER",
            object_id: user.user_id,
            description: "User logged in successfully",
            request_ip: reqInfo.ip,
            user_agent: reqInfo.userAgent
        });
    } catch (err) {
        console.error("Failed to log login activity:", err);
    }

    return {
        accessToken,
        refreshToken, // To be set in cookie by Controller
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
            profile_image_url: user.profile_image_url
        }
    };
};

export const refreshAuthTokens = async (refreshToken, reqInfo) => {
    if (!refreshToken) throw new AppError("No refresh token provided", 401);

    const result = await TokenService.verifyRefreshToken(refreshToken);

    if (!result) throw new AppError("Invalid refresh token", 403);

    if (result.error) throw new AppError("Security Alert: Token reuse detected. Re-login required.", 403);

    const { user, gracePeriodActive, activeRefreshToken } = result;

    let newRefreshToken;

    if (gracePeriodActive) {
        newRefreshToken = activeRefreshToken;
    } else {
        newRefreshToken = TokenService.generateRefreshToken();
        await TokenService.revokeRefreshToken(refreshToken, newRefreshToken);
        await TokenService.saveRefreshToken(user.user_id, newRefreshToken, reqInfo.ip, reqInfo.userAgent);
    }

    const tokenPayload = {
        user_id: user.user_id,
        user_name: user.user_name,
        email: user.email,
        user_type: user.user_type,
        org_id: user.org_id,
        profile_image_url: user.profile_image_url
    };

    const newAccessToken = jwt.sign(tokenPayload, process.env.JWT_SECRET, { expiresIn: ACCESS_TOKEN_EXPIRY });

    return { accessToken: newAccessToken, refreshToken: newRefreshToken };
};

export const getCurrentUser = async (userId) => {
    const user = await attendanceDB('users')
        .where('user_id', userId)
        .select('user_code', 'user_name', 'email', 'user_type', 'org_id', 'profile_image_url')
        .first();

    if (!user) throw new AppError("User not found", 404);

    return { ...user, user_id: userId };
};

export const logoutUser = async (refreshToken) => {
    if (refreshToken) {
        await TokenService.revokeRefreshToken(refreshToken);
    }
};

export const validatePasswordResetRequest = async (email, reqInfo) => {
    const user = await attendanceDB('users').where('email', email).first();
    if (!user) throw new AppError("User does not exist", 404);

    // Construct mock req object for backward compatibility with OtpService
    const mockReq = { headers: { "user-agent": reqInfo.userAgent }, clientIp: reqInfo.ip, ip: reqInfo.ip };
    const otp = OtpService.generateOtp(email, mockReq);

    const userName = user.user_name || 'there';
    const emailHtml = `
  <div style="font-family: sans-serif; max-width: 600px; margin: auto;">
      <h2>Secure Your Account</h2>
      <p>Hi ${userName},</p>
      <p>We received a request to reset your password. Please use the following code to continue:</p>
      <h1 style="color: #4F46E5; letter-spacing: 5px;">${otp}</h1>
      <p>This code is valid for 5 minutes.</p>
  </div>`;

    const emailResult = await sendEmail({
        to: email,
        subject: "Secure your account - Mano Attendance System",
        text: `Hi ${userName}, your verification code is ${otp}. It remains valid for 5 minutes.`,
        html: emailHtml
    });

    if (!emailResult.ok) throw new AppError("Failed to send email. Please try again later.", 500);

    return true;
};

export const verifyPasswordResetOtp = async (email, otp, reqInfo) => {
    const mockReq = { headers: { "user-agent": reqInfo.userAgent }, clientIp: reqInfo.ip, ip: reqInfo.ip };
    const isValid = OtpService.verifyOtp(email, otp, mockReq);

    if (!isValid) throw new AppError("Invalid or expired OTP", 400);

    const user = await attendanceDB('users').where('email', email).first();
    if (!user) throw new AppError("User not found", 400);

    const resetToken = jwt.sign(
        { user_id: user.user_id, email: user.email, type: "password_reset" },
        process.env.JWT_SECRET,
        { expiresIn: "5m" }
    );

    return resetToken;
};

export const executePasswordReset = async (resetToken, newPassword) => {
    if (newPassword.length < 8) throw new AppError("Password must be at least 8 characters long", 400);

    try {
        const decoded = jwt.verify(resetToken, process.env.JWT_SECRET);
        if (decoded.type !== "password_reset") throw new AppError("Invalid token type", 403);

        const hashedPassword = await bcrypt.hash(newPassword, 10);
        await attendanceDB("users").where("user_id", decoded.user_id).update({ user_password: hashedPassword });

        return true;
    } catch (err) {
        if (err.name === 'TokenExpiredError') {
            throw new AppError("Reset token has expired. Please request a new OTP.", 403);
        }
        throw new AppError("Invalid or expired reset token", 403);
    }
};
