import catchAsync from '../../utils/catchAsync.js';
import * as authService from '../../services/auth/authService.js';
import AppError from '../../utils/AppError.js';

const REFRESH_TOKEN_COOKIE_MAX_AGE = 30 * 24 * 60 * 60 * 1000; // 30 Days
const IS_PROD = process.env.NODE_ENV === 'production';

export const login = catchAsync(async (req, res, next) => {
    const { user_input, user_password, captchaToken, rememberMe } = req.body;

    if (!user_input || !user_password) {
        throw new AppError("Username and password are required.", 400);
    }

    const reqInfo = {
        ip: req.clientIp || req.ip,
        userAgent: req.get('User-Agent') || 'Unknown'
    };

    const { accessToken, refreshToken, user } = await authService.authenticateUser(user_input, user_password, reqInfo, rememberMe === true);

    const cookieOptions = {
        httpOnly: true,
        secure: IS_PROD,
        sameSite: 'Lax',
        path: '/'
    };

    if (rememberMe === true) {
        cookieOptions.maxAge = REFRESH_TOKEN_COOKIE_MAX_AGE;
    }

    res.cookie('refreshToken', refreshToken, cookieOptions);

    res.status(200).json({ accessToken, user });
});

export const superAdminLogin = catchAsync(async (req, res, next) => {
    const { email, password } = req.body;

    if (!email || !password) {
        throw new AppError("Email and password are required.", 400);
    }

    const reqInfo = { ip: req.clientIp || req.ip, userAgent: req.get('User-Agent') || 'Unknown' };
    const { accessToken, refreshToken, user } = await authService.authenticateSuperAdmin(email, password, reqInfo);

    res.cookie('refreshToken', refreshToken, {
        httpOnly: true,
        secure: IS_PROD,
        sameSite: 'Lax',
        maxAge: 12 * 60 * 60 * 1000,
        path: '/'
    });

    res.status(200).json({ accessToken, user });
});

export const requestPasswordReset = catchAsync(async (req, res, next) => {
    const { email } = req.body;
    if (!email) throw new AppError("Email is required", 400);

    const reqInfo = {
        ip: req.clientIp || req.ip,
        userAgent: req.get('User-Agent') || 'Unknown'
    };

    await authService.validatePasswordResetRequest(email, reqInfo);
    res.json({ message: "OTP sent to your email" });
});

export const verifyOtp = catchAsync(async (req, res, next) => {
    const { email, otp } = req.body;
    if (!email || !otp) throw new AppError("Email and OTP are required", 400);

    const reqInfo = {
        ip: req.clientIp || req.ip,
        userAgent: req.get('User-Agent') || 'Unknown'
    };

    const resetToken = await authService.verifyPasswordResetOtp(email, otp, reqInfo);
    res.json({ message: "OTP verified", resetToken });
});

export const resetPassword = catchAsync(async (req, res, next) => {
    const { resetToken, newPassword } = req.body;
    if (!resetToken || !newPassword) throw new AppError("Token and new password are required", 400);

    await authService.executePasswordReset(resetToken, newPassword);
    res.json({ message: "Password reset successfully. You can now login." });
});

export const refreshToken = catchAsync(async (req, res, next) => {
    const currentRefreshToken = req.cookies.refreshToken;

    const reqInfo = {
        ip: req.clientIp || req.ip,
        userAgent: req.get('User-Agent') || 'Unknown'
    };

    try {
        const { accessToken, refreshToken: newRefreshToken, rememberMe } = await authService.refreshAuthTokens(currentRefreshToken, reqInfo);

        const cookieOptions = {
            httpOnly: true,
            secure: IS_PROD,
            sameSite: 'Lax',
            path: '/'
        };

        if (rememberMe === true) {
            cookieOptions.maxAge = REFRESH_TOKEN_COOKIE_MAX_AGE;
        }

        res.cookie('refreshToken', newRefreshToken, cookieOptions);

        res.json({ accessToken });
    } catch (err) {
        res.clearCookie('refreshToken', { path: '/' });
        throw err; // Passed to the global error handler which will send the AppError
    }
});

export const getCurrentUser = catchAsync(async (req, res, next) => {
    // `req.user` comes from authenticateJWT middleware
    const user = await authService.getCurrentUser(req.user.user_id, req.user.user_type);
    res.json(user);
});

export const logout = catchAsync(async (req, res, next) => {
    const refreshToken = req.cookies.refreshToken;
    await authService.logoutUser(refreshToken);

    res.clearCookie("refreshToken", { path: '/' });
    res.json({ message: "Logged out successfully" });
});
