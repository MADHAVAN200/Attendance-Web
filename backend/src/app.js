import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import requestIp from 'request-ip';

import { generalLimiter } from './middleware/rateLimiter.js';
import errorHandler from './middleware/errorHandler.js';
import AppError from './utils/AppError.js';
import { apiMonitor } from './middleware/apiMonitor.js';

// Import route definitions
import routes from './routes/index.js';

const app = express();

app.set('trust proxy', 1); // Trust reverse proxy (Nginx) for secure cookies

const allowedOrigins = [
    'http://localhost:5173',
    'http://127.0.0.1:5173',
    'https://localhost:5173',
    'https://127.0.0.1:5173',
    'http://localhost:5174',
    'https://localhost:5174',
    process.env.FRONTEND_URL,
];

function isLocalDevOrigin(origin) {
    return /^https?:\/\/(localhost|127\.0\.0\.1|localhost\.localdomain|lvh\.me|vite\.lvh\.me)(:\d+)?$/i.test(origin);
}

app.use(cookieParser());
app.use(cors({
    origin: (origin, callback) => {
        if (!origin) return callback(null, true);

        const isAllowed = allowedOrigins.includes(origin) ||
            isLocalDevOrigin(origin) ||
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

app.use(helmet());
app.use(requestIp.mw());
app.use(generalLimiter);
app.use(express.json());
app.use(apiMonitor);

// Main API Router
app.use('/', routes);

app.get('/health', (req, res) => {
    res.status(200).json({ status: 'success', message: 'Backend 2.0 is running 🚀' });
});

// Handle 404 for undefined routes
app.all(/(.*)/, (req, res, next) => {
    next(new AppError(`Can't find ${req.originalUrl} on this server!`, 404));
});

// Global Error Handler
app.use(errorHandler);

export default app;
