
import { createServer } from 'http';
import { Server as SocketIO } from 'socket.io';

import express from 'express';
import cors from 'cors';
import AuthRoutes from './AuthAPI/LoginAPI.js';
import AppError from './utils/AppError.js';
import errorHandler from './middleware/errorHandler.js';
import AttendanceRoutes from './Attendance/Attendance.js';
import AdminRoutes from './Admin/Admin.js';
import LocationRoutes from './Admin/WorkLocations.js';
import HolidayRoutes from './Admin/Holidays.js';
import PolicyRoutes from './Admin/Policies.js';
import EmployeeRoutes from './Employee/EmployeeRoutes.js';
import FeedbackRoutes from './Feedback/FeedbackRoutes.js';
import ReportRoutes from './Admin/ReportAPI.js';
import LeaveRoutes from './Attendance/Leaves.js';
import './config.js';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { generalLimiter } from './middleware/rateLimiter.js';
import EventsAPI from './DAR/EventsAPI.js';
import ActivitiesAPI from './DAR/ActivitiesAPI.js';
import ProfileRoutes from './Profile/ProfileRoutes.js';

const app = express();
const PORT = process.env.PORT || 5001;

// Allowed origins
const allowedOrigins = [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'https://localhost:5173',
  'https://127.0.0.1:5173',
  process.env.FRONTEND_URL,
];

app.use(cookieParser());
app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);

    // Check if origin is allowed
    const isAllowed = allowedOrigins.includes(origin) ||
      origin.startsWith('http://192.') || origin.startsWith('https://192.') ||
      origin.startsWith('http://10.') || origin.startsWith('https://10.') ||
      origin.startsWith('http://172.') || origin.startsWith('https://172.');

    if (isAllowed) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true
}));

app.use(helmet()); // Secure HTTP headers
app.use(generalLimiter); // Global Rate Limiter

app.use(express.json());

// Routes
import NotificationRoutes from './Notification/NotificationRoutes.js';
import NotificationService from './services/NotificationService.js';
import ActivityLogService from './services/ActivityLogService.js';


app.use('/auth', AuthRoutes);
app.use('/attendance', AttendanceRoutes);
app.use('/admin', AdminRoutes);
app.use('/admin/reports', ReportRoutes);
app.use('/attendance/reports', ReportRoutes);
app.use('/locations', LocationRoutes); // Admin locations
app.use('/leaves', LeaveRoutes);
app.use('/holiday', HolidayRoutes);
app.use('/policies', PolicyRoutes);
app.use('/notifications', NotificationRoutes);
app.use('/employee', EmployeeRoutes); // New Employee Module
app.use('/feedback', FeedbackRoutes); // Feedback & Bug Reports
app.use('/dar/events', EventsAPI);
app.use('/dar/activities', ActivitiesAPI);
app.use('/profile', ProfileRoutes);
app.get('/', (req, res) => {
  res.send('Backend is running 🚀');
});

// Create http server wrapping express app
const server = createServer(app);

// Create socket.io instance attached to that server
const io = new SocketIO(server, {
  path: '/socket.io/',
  cors: {
    origin: allowedOrigins,
    credentials: true
  },
});

// Basic connection handler
io.on('connection', (socket) => {
  console.log('Socket connected:', socket.id, 'from', socket.handshake.address);

  socket.on('disconnect', (reason) => {
    console.log('Socket disconnected', socket.id, reason);
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Backend server listening at http://0.0.0.0:${PORT}`);
});

// Handle 404 for undefined routes
app.all(/(.*)/, (req, res, next) => {
  next(new AppError(`Can't find ${req.originalUrl} on this server!`, 404));
});

// Global Error Handler
app.use(errorHandler);
