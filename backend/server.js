import { createServer } from 'http';
import { Server as SocketIO } from 'socket.io';
import jwt from 'jsonwebtoken';
import './src/config/config.js';
import app from './src/app.js';
import { initAttendanceProcessor } from './src/cron/AttendanceProcessor.js';
import { initCleanupScheduler } from './src/cron/cleanupScheduler.js';
import { initDARReportScheduler } from './src/cron/DARReportScheduler.js';
import { initChatDatabase } from './src/services/collaboration/chatDatabaseInit.js';
import { initReportsDatabase } from './src/services/reports/reportsDatabaseInit.js';
import EventBus from './src/utils/EventBus.js';
import './src/workers/reportWorker.js';

const PORT = Number(process.env.PORT) || 5003;

const allowedOrigins = [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'https://localhost:5173',
  'https://127.0.0.1:5173',
  'http://localhost:5174',
  'https://localhost:5174',
  process.env.FRONTEND_URL,
].filter(Boolean);

function isLocalDevOrigin(origin) {
  return /^https?:\/\/(localhost|127\.0\.0\.1|localhost\.localdomain|lvh\.me|vite\.lvh\.me)(:\d+)?$/i.test(origin);
}

const server = createServer(app);
let activePort = PORT;
let hasStartedSchedulers = false;
const MAX_PORT_RETRIES = 5;
let portRetries = 0;

const io = new SocketIO(server, {
  path: '/socket.io/',
  cors: {
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);

      const isAllowed = allowedOrigins.includes(origin)
        || isLocalDevOrigin(origin)
        || origin.startsWith('http://192.') || origin.startsWith('https://192.')
        || origin.startsWith('http://10.') || origin.startsWith('https://10.')
        || origin.startsWith('http://172.') || origin.startsWith('https://172.');

      return isAllowed ? callback(null, true) : callback(new Error('Not allowed by CORS'));
    },
    credentials: true,
  },
});

app.set('io', io);

// Socket.io JWT Authentication Middleware
io.use((socket, next) => {
  try {
    const token = socket.handshake.auth?.token || socket.handshake.query?.token;
    if (!token) {
      return next(new Error('Authentication error: Token missing'));
    }
    const actualToken = token.startsWith('Bearer ') ? token.slice(7) : token;
    
    jwt.verify(actualToken, process.env.JWT_SECRET, (err, decoded) => {
      if (err) {
        return next(new Error('Authentication error: Invalid token'));
      }
      socket.user = decoded;
      next();
    });
  } catch (err) {
    next(new Error('Authentication error'));
  }
});

io.on('connection', (socket) => {
  const userId = socket.user?.user_id ?? socket.user?.id;
  
  if (userId) {
    // Join personal notification channel
    socket.join(`user_${userId}`);
  }

  socket.on('join_room', (roomId) => {
    socket.join(`room_${roomId}`);
  });

  socket.on('leave_room', (roomId) => {
    socket.leave(`room_${roomId}`);
  });

  socket.on('typing', ({ roomId, username }) => {
    socket.to(`room_${roomId}`).emit('user_typing', { roomId, userId, username });
  });

  socket.on('stop_typing', ({ roomId }) => {
    socket.to(`room_${roomId}`).emit('user_stop_typing', { roomId, userId });
  });

  socket.on('disconnect', (reason) => {
    // Socket disconnected
  });
});

// Listen to the EventBus saved notifications and push real-time alerts
EventBus.on('notification_saved', (notification) => {
  io.to(`user_${notification.user_id}`).emit('new-notification', notification);
  console.log(`📡 Real-time notification push sent to user_${notification.user_id} for alert #${notification.notification_id}`);
});

server.on('error', (err) => {
  if (err?.code === 'EADDRINUSE' && portRetries < MAX_PORT_RETRIES) {
    portRetries += 1;
    activePort += 1;
    console.warn(`Port in use. Retrying backend on port ${activePort}...`);
    server.listen(activePort, '0.0.0.0');
    return;
  }
  throw err;
});

server.listen(activePort, '0.0.0.0', () => {
  console.log(`Backend server listening at http://0.0.0.0:${activePort}`);

  // Auto-initialize Collaboration / Chat tables if needed
  initChatDatabase();
  
  // Auto-initialize Reports database table if needed
  initReportsDatabase();

  if (!hasStartedSchedulers) {
    hasStartedSchedulers = true;
    initAttendanceProcessor();
    initCleanupScheduler();
    initDARReportScheduler();
  }
});
