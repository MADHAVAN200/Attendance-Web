import axios from 'axios';
import AppError from '../utils/AppError.js';
import crypto from 'crypto';

// Store for captcha sessions (in production, use Redis or similar)
const captchaSessions = new Map();

// Clean up expired captcha sessions every 5 minutes
setInterval(() => {
    const now = Date.now();
    for (const [key, value] of captchaSessions.entries()) {
        if (now - value.timestamp > 5 * 60 * 1000) { // 5 minutes
            captchaSessions.delete(key);
        }
    }
}, 5 * 60 * 1000);

/**
 * Generate a random captcha text (6 characters)
 */
function generateCaptchaText() {
    // Use mix of uppercase letters and numbers, avoiding ambiguous characters (0, O, I, 1, etc.)
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let text = '';
    for (let i = 0; i < 6; i++) {
        text += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return text;
}

/**
 * Generate SVG captcha image
 */
function generateCaptchaSVG(text) {
    const width = 200;
    const height = 60;
    const fontSize = 28;

    // Random background color (light)
    const bgColor = `hsl(${Math.random() * 360}, 70%, 95%)`;

    // Generate noise lines
    let noiseLines = '';
    for (let i = 0; i < 5; i++) {
        const x1 = Math.random() * width;
        const y1 = Math.random() * height;
        const x2 = Math.random() * width;
        const y2 = Math.random() * height;
        const color = `hsl(${Math.random() * 360}, 70%, 60%)`;
        noiseLines += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${color}" stroke-width="1.5" opacity="0.3"/>`;
    }

    // Generate noise dots
    let noiseDots = '';
    for (let i = 0; i < 30; i++) {
        const cx = Math.random() * width;
        const cy = Math.random() * height;
        const color = `hsl(${Math.random() * 360}, 70%, 50%)`;
        noiseDots += `<circle cx="${cx}" cy="${cy}" r="1.5" fill="${color}" opacity="0.4"/>`;
    }

    // Generate text with random positions and rotations
    let textElements = '';
    const spacing = width / (text.length + 1);

    for (let i = 0; i < text.length; i++) {
        const char = text[i];
        const x = spacing * (i + 1);
        const y = height / 2 + fontSize / 3;
        const rotation = (Math.random() - 0.5) * 30; // Random rotation -15 to 15 degrees
        const offsetX = (Math.random() - 0.5) * 10;
        const offsetY = (Math.random() - 0.5) * 10;
        const color = `hsl(${Math.random() * 360}, 70%, 40%)`;

        textElements += `
            <text 
                x="${x + offsetX}" 
                y="${y + offsetY}" 
                font-size="${fontSize}" 
                font-family="Arial, sans-serif" 
                font-weight="bold" 
                fill="${color}"
                transform="rotate(${rotation} ${x + offsetX} ${y + offsetY})"
            >${char}</text>`;
    }

    const svg = `
        <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
            <rect width="${width}" height="${height}" fill="${bgColor}"/>
            ${noiseLines}
            ${noiseDots}
            ${textElements}
        </svg>
    `;

    return svg.trim();
}

/**
 * Generate a new captcha
 * Returns: { captchaId, captchaSvg }
 */
export const generateCaptcha = (req, res) => {
    try {
        const captchaText = generateCaptchaText();
        const captchaId = crypto.randomBytes(16).toString('hex');
        const captchaSvg = generateCaptchaSVG(captchaText);

        // Store captcha session
        captchaSessions.set(captchaId, {
            text: captchaText,
            timestamp: Date.now(),
            attempts: 0
        });

        // Convert SVG to base64 for easier transfer
        const captchaBase64 = Buffer.from(captchaSvg).toString('base64');

        res.json({
            captchaId,
            captchaSvg: `data:image/svg+xml;base64,${captchaBase64}`
        });
    } catch (error) {
        console.error('Captcha generation error:', error);
        res.status(500).json({ error: 'Failed to generate captcha' });
    }
};

/**
 * Verify Google reCAPTCHA v2
 */
async function verifyGoogleRecaptcha(captchaToken) {
    const secretKey = process.env.RECAPTCHA_SECRET_KEY;

    if (!secretKey) {
        console.error("RECAPTCHA_SECRET_KEY is missing in env variables");
        throw new Error('Server configuration error: Captcha secret missing');
    }

    try {
        const response = await axios.post(
            `https://www.google.com/recaptcha/api/siteverify?secret=${secretKey}&response=${captchaToken}`
        );

        const { success } = response.data;
        return success;
    } catch (error) {
        console.error('Google reCAPTCHA Verification Error:', error);
        throw new Error('CAPTCHA verification failed due to network error');
    }
}

/**
 * Verify word-based captcha
 */
function verifyWordCaptcha(captchaId, captchaText) {
    // Get captcha session
    const session = captchaSessions.get(captchaId);

    if (!session) {
        throw new Error('CAPTCHA expired or invalid. Please try again.');
    }

    // Check if expired (5 minutes)
    if (Date.now() - session.timestamp > 5 * 60 * 1000) {
        captchaSessions.delete(captchaId);
        throw new Error('CAPTCHA expired. Please try again.');
    }

    // Check attempts (max 3)
    if (session.attempts >= 3) {
        captchaSessions.delete(captchaId);
        throw new Error('Too many attempts. Please request a new CAPTCHA.');
    }

    // Increment attempts
    session.attempts++;

    // Verify captcha (case-insensitive)
    if (captchaText.toUpperCase() !== session.text.toUpperCase()) {
        throw new Error('Invalid CAPTCHA. Please try again.');
    }

    // Success - delete session
    captchaSessions.delete(captchaId);
    return true;
}

/**
 * Dynamic captcha verification middleware
 * Supports both Google reCAPTCHA v2 and word-based captcha
 */
export const verifyCaptcha = async (req, res, next) => {
    const { captchaToken, captchaId, captchaText } = req.body;

    try {
        // Determine which captcha type is being used
        if (captchaToken) {
            // Google reCAPTCHA v2 flow
            console.log('🔐 Verifying Google reCAPTCHA v2...');
            const isValid = await verifyGoogleRecaptcha(captchaToken);

            if (!isValid) {
                return next(new AppError('Google reCAPTCHA verification failed. Please try again.', 400));
            }

            console.log('✅ Google reCAPTCHA verified successfully');
            next();

        } else if (captchaId && captchaText) {
            // Word-based captcha flow
            console.log('🔐 Verifying word-based captcha...');
            verifyWordCaptcha(captchaId, captchaText);

            console.log('✅ Word-based captcha verified successfully');
            next();

        } else {
            // No valid captcha data provided
            return next(new AppError('Please complete the CAPTCHA. Provide either captchaToken (Google reCAPTCHA) or captchaId + captchaText (word-based).', 400));
        }

    } catch (error) {
        console.error('❌ Captcha Verification Error:', error.message);
        return next(new AppError(error.message || 'CAPTCHA verification failed', 400));
    }
};
