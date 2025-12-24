import express from 'express';
import bcrypt from 'bcrypt';
// import { sendSignupVerificationEmail, pendingSignups } from '../SignupEmailVerification/EmailUrlService.js';
import '../config.js';
import { insertUser, checkUserExists } from '../Database.js';

// MOCKING MISSING SERVICE
const pendingSignups = new Map();
const sendSignupVerificationEmail = async (data) => {
  console.log("MOCK EMAIL SENT:", data);
  return { success: true };
};

const router = express.Router();

/* ============================================================
   [1] Signup Route — Sends Verification Email
============================================================ */
// Route: POST /signup
router.post('/signup', async (req, res) => {
  const { username, email, password, phone } = req.body;

  // Basic validation
  if (!username || !email || !password || !phone) {
    return res.status(400).json({ error: 'All fields are required' });
  }

  try {
    // Check if user already exists (by email or phone)
    const userExists = await checkUserExists(email, phone);
    if (userExists) {
      return res.status(409).json({ error: 'User already exists with this email or phone' });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Insert user (Defaults to Org 1)
    const stored = await insertUser(username, email, hashedPassword, phone);

    if (stored) {
      // Send Welcome / Verification Email (Mocked for now)
      // await EmailUrlService.SendVerificationEmail(email); 
      console.log(`[Mock] Sending verification email to ${email}`);

      res.status(201).json({ message: 'User registered successfully. Please verify your email.' });
    } else {
      res.status(500).json({ error: 'Failed to register user' });
    }
  } catch (err) {
    console.error('Signup error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/* ============================================================
   [2] SHARED VERIFICATION HANDLER
   Works for BOTH GET (email click) & POST (frontend)
============================================================ */
export async function handleVerifySignup(req, res) {
  try {
    // Token from GET (email click) or POST (API)
    const token =
      req.method === 'GET' ? req.query.token : req.body?.token;

    if (!token) {
      return res.status(400).send('Missing verification token.');
    }

    const userData = pendingSignups.get(token);
    if (!userData) {
      return res.status(400).send('Invalid or expired verification link.');
    }

    // Check expiration
    if (Date.now() > userData.expiresAt) {
      pendingSignups.delete(token);
      return res.status(400).send('Link expired. Please sign up again.');
    }

    const { email, username, hashedPassword, phone } = userData;
    const insertSuccess = await insertUser(
      username,
      email,
      hashedPassword,
      phone
    );

    if (!insertSuccess) {
      return res
        .status(500)
        .send('Failed to create account. Please try again.');
    }

    pendingSignups.delete(token);

    if (req.method === 'GET') {
      // For email link → send plain HTML message
      return res.send(
        '✅ Your account has been created successfully! You can now log in.'
      );
    }

    // For POST API → return JSON
    return res.json({
      success: true,
      message: 'Account created successfully! You can now log in.',
    });
  } catch (error) {
    console.error('Verification error:', error);
    return res.status(500).send('Something went wrong.');
  }
}

/* ============================================================
   [3] API ROUTES UNDER /api
============================================================ */
router.get('/verify-signup', handleVerifySignup);
router.post('/verify-signup', handleVerifySignup);

/* ============================================================
   Export router as default
============================================================ */
export default router;