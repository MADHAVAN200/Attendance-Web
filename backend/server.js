import { createServer } from 'http';
import { Server as SocketIO } from 'socket.io';
import './src/config/config.js';
import app from './src/app.js';
import { initAttendanceProcessor } from './src/cron/AttendanceProcessor.js';
import { initCleanupScheduler } from './src/cron/cleanupScheduler.js';
import { initDARReportScheduler } from './src/cron/DARReportScheduler.js';

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

io.on('connection', (socket) => {
  console.log('Socket connected:', socket.id, 'from', socket.handshake.address);
  socket.on('disconnect', (reason) => {
    console.log('Socket disconnected', socket.id, reason);
  });
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

  if (!hasStartedSchedulers) {
    hasStartedSchedulers = true;
    initAttendanceProcessor();
    initCleanupScheduler();
    initDARReportScheduler();
  }
});
