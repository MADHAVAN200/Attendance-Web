import express from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import * as DB from "../Database.js";

const tokenExpirePeriod = 7 * 24 * 60 * 60; // Time in seconds 
const router = express.Router();

export async function authenticateJWT(req, res, next) {
  try {
    let token;
    const authHeader = req.headers['authorization'];
    if (authHeader && authHeader.startsWith("Bearer ")) {
      token = authHeader.split(" ")[1];
    }

    if (!token) {
      token = req.cookies?.token;
    }

    if (!token) {
      return res.status(401).json({ message: "Unauthorized: No token provided" });
    }

    jwt.verify(token, process.env.JWT_SECRET, (err, decodedUser) => {
      if (err) {
        console.error("JWT verification failed:", err.message);
        return res.status(403).json({ message: "Forbidden: Invalid or expired token" });
      }

      req.user = {
        user_id: decodedUser.user_id,
        user_name: decodedUser.user_name,
        email: decodedUser.email,
        title: decodedUser.title_name,
        title_id: decodedUser.title_id
      };

      next();
    });
  } catch (error) {
    console.error("❌ JWT Authentication Error:", error);
    return res.status(500).json({ message: "Internal Server Error during authentication" });
  }
}



export async function generateJWT(user_data) {
  return jwt.sign(user_data, process.env.JWT_SECRET, { expiresIn: tokenExpirePeriod });
}



// Login route
router.post("/login", async (req, res) => {
  try {
    const { user_input, user_password } = req.body;
    if (!user_input || !user_password) {
      return res.status(400).json({ message: "Username and password are required." });
    }

    // 1. Fetch user by Email or Phone
    // 1. Fetch user by Email or Phone using Knex
    const user = await DB.knexDB('users')
      .leftJoin('departments', 'users.dept_id', 'departments.dept_id')
      .leftJoin('designations', 'users.desg_id', 'designations.desg_id')
      .leftJoin('shifts', 'users.shift_id', 'shifts.shift_id')
      .select(
        'users.user_id', 'users.user_name', 'users.user_password', 'users.email', 'users.phone_no', 'users.org_id',
        'departments.dept_name', 'designations.desg_name', 'shifts.shift_name', 'shifts.shift_id'
      )
      .where('users.email', user_input)
      .orWhere('users.phone_no', user_input)
      .first();

    if (!user) {
      return res.status(401).json({ error: 'Invalid Email/Phone or Password' });
    }

    // 2. Compare password
    const isMatch = await bcrypt.compare(user_password, user.user_password);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid Email/Phone or Password' });
    }

    // 3. Generate JWT
    const tokenPayload = {
      user_id: user.user_id,
      user_name: user.user_name,
      email: user.email,
      phone: user.phone_no,
      org_id: user.org_id,
      dept_name: user.dept_name,
      desg_name: user.desg_name,
      shift_id: user.shift_id,
      shift_name: user.shift_name
    };

    const token = jwt.sign(tokenPayload, process.env.JWT_SECRET, { expiresIn: '24h' });

    // 4. Set cookie
    res.cookie('token', token, {
      httpOnly: true,
      secure: false,
      sameSite: 'Lax',
      maxAge: tokenExpirePeriod * 1000
    });

    // 5. Return response
    res.status(200).json({
      jwt_token: token,
      user: {
        id: user.user_id,
        name: user.user_name,
        email: user.email,
        phone: user.phone_no,
        designation: user.desg_name,
        department: user.dept_name,
        org_id: user.org_id,
      }
    });

  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});



// Route: GET /me - Check current auth/session
router.get("/me", authenticateJWT, (req, res) => {
  res.json({
    user_id: req.user.user_id,
    user_name: req.user.user_name,
    email: req.user.email,
    title: req.user.title,
    title_id: req.user.title_id,
    org_id: req.user.org_id
  });
});


// Route: POST /logout - Clear cookie
router.post("/logout", (req, res) => {
  res.clearCookie("token", {
    httpOnly: true,
    secure: false, // Set to true in production if using HTTPS
    sameSite: "Lax"
  });
  res.json({ message: "Logged out successfully" });
});

export default router;