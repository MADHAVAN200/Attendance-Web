import express from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import * as DB from "../database.js";
import EventBus from "../utils/EventBus.js";
import { getEventSource } from "../utils/clientInfo.js";
import catchAsync from "../utils/catchAsync.js";

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
        user_type: decodedUser.user_type,
        org_id: decodedUser.org_id
      };

      next();
    });
  } catch (error) {
    console.error("❌ JWT Authentication Error:", error);
    return res.status(500).json({ message: "Internal Server Error during authentication" });
  }
}


// Login route
router.post("/login", catchAsync(async (req, res) => {
  // try removed
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
      'users.user_id', 'users.user_name', 'users.user_password', 'users.email', 'users.phone_no', 'users.org_id', 'users.user_type',
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
    user_type: user.user_type,
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

  // Optional: Security Notification
  EventBus.emitNotification({
    org_id: user.org_id,
    user_id: user.user_id,
    title: "New Login Detected",
    message: `Login detected from IP ${req.ip || 'Unknown'}`,
    type: "INFO"
  });

  // 5. Return response
  res.status(200).json({
    jwt_token: token,
    user: {
      id: user.user_id,
      name: user.user_name,
      email: user.email,
      phone: user.phone_no,
      type: user.user_type,
      designation: user.desg_name,
      department: user.dept_name,
      org_id: user.org_id,
    }
  });

}));


// Route: GET /me - Check current auth/session
router.get("/me", authenticateJWT, (req, res) => {
  res.json({
    user_id: req.user.user_id,
    user_name: req.user.user_name,
    email: req.user.email,
    user_type: req.user.user_type,
    org_id: req.user.org_id
  });
});


// Route: POST /logout - Clear cookie
router.post("/logout", authenticateJWT, (req, res) => {
  res.clearCookie("token", {
    httpOnly: true,
    secure: false, // Set to true in production if using HTTPS
    sameSite: "Lax"
  });

  const user_id = req.user?.user_id || null;
  const org_id = req.user?.org_id || null;

  if (user_id) {
    EventBus.emitActivityLog({
      user_id,
      org_id,
      event_type: "LOGOUT",
      event_source: getEventSource(req),
      object_type: "USER",
      object_id: user_id,
      description: "User logged out",
      request_ip: req.ip,
      user_agent: req.get('User-Agent')
    });
  }
  res.json({ message: "Logged out successfully" });
});

export default router;