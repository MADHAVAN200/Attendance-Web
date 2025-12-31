import axios from 'axios';
import AppError from '../utils/AppError.js';

export const verifyCaptcha = async (req, res, next) => {
    const { captchaToken } = req.body;

    // If no token provided, reject
    if (!captchaToken) {
        return next(new AppError('Please complete the CAPTCHA', 400));
    }

    const secretKey = process.env.RECAPTCHA_SECRET_KEY;

    if (!secretKey) {
        console.error("RECAPTCHA_SECRET_KEY is missing in env variables");
        return next(new AppError('Server configuration error: Captcha secret missing', 500));
    }

    try {
        const response = await axios.post(
            `https://www.google.com/recaptcha/api/siteverify?secret=${secretKey}&response=${captchaToken}`
        );

        const { success, score } = response.data;

        if (!success) {
            return next(new AppError('CAPTCHA verification failed. Please try again.', 400));
        }

        // verification passed
        next();
    } catch (error) {
        console.error('Captcha Verification Error:', error);
        return next(new AppError('CAPTCHA verification failed due to network error', 500));
    }
};
