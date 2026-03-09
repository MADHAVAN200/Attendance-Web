import { createServer } from 'http';
import { Server as SocketIO } from 'socket.io';

// Configuration and Database
import './src/config/config.js';
import './src/config/database.js';

import app from './src/app.js';
import { initAttendanceProcessor } from './src/cron/AttendanceProcessor.js';
import { initCleanupScheduler } from './src/cron/cleanupScheduler.js';

const PORT = 5003; // Using a different port initially for backend 2.0 to avoid conflicts

const server = createServer(app);

const allowedOrigins = [
    'http://localhost:5173',
    'http://127.0.0.1:5173',
    'https://localhost:5173',
    'https://127.0.0.1:5173',
    'http://localhost:5174',
    'https://localhost:5174',
    process.env.FRONTEND_URL,
];

const io = new SocketIO(server, {
    path: '/socket.io/',
    cors: {
        origin: allowedOrigins,
        credentials: true
    },
});

io.on('connection', (socket) => {
    console.log('Socket connected:', socket.id, 'from', socket.handshake.address);
    socket.on('disconnect', (reason) => {
        console.log('Socket disconnected', socket.id, reason);
    });
});

server.listen(PORT, '0.0.0.0', () => {
    console.log(`Backend 2.0 server listening at http://0.0.0.0:${PORT}`);

    // Initialize Cron Jobs
    //initAttendanceProcessor();
    //initCleanupScheduler();
});
