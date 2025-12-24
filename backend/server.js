
import { createServer } from 'http';
import { Server as SocketIO } from 'socket.io';

import express from 'express';
import cors from 'cors';
import AuthRoutes from './AuthAPI/LoginAPI.js';
import VerifyEmailRoutes from './AuthAPI/VerifyEmailAPI.js';
import AppError from './utils/AppError.js';
import errorHandler from './middleware/errorHandler.js';
import AttendanceRoutes from './Attendance/Attendance.js';
import AdminRoutes from './Admin/Admin.js';
import LocationRoutes from './Admin/WorkLocations.js';
import HolidayRoutes from './Admin/Holidays.js';
import PolicyRoutes from './Admin/Policies.js';
import './config.js';
import cookieParser from 'cookie-parser';

const app = express();
const PORT = process.env.PORT || 5001;

// Allowed origins
const allowedOrigins = [
  'http://localhost:5173',
  'http://127.0.0.1:5173'
];

app.use(cookieParser());
app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true
}));

app.use(express.json());

// Routes
// Routes
app.use('/api/auth', AuthRoutes);
app.use('/api/attendance', AttendanceRoutes);
app.use('/api/admin', AdminRoutes);
app.use('/api/locations', LocationRoutes);
app.use('/api/holidays', HolidayRoutes);
app.use('/api/policies', PolicyRoutes);
// app.use('/s3', S3Routes);

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
  console.log(`Backend server listening at http://127.0.0.1:${PORT}`);
});

// Handle 404 for undefined routes
app.all(/(.*)/, (req, res, next) => {
  next(new AppError(`Can't find ${req.originalUrl} on this server!`, 404));
});

// Global Error Handler
app.use(errorHandler);
