import EventBus from '../utils/EventBus.js';

const errorHandler = (err, req, res, next) => {
    err.statusCode = err.statusCode || 500;
    err.status = err.status || 'error';

    // Log to EventBus (which writes to DB)
    if (err.statusCode === 500) {
        EventBus.emitError({
            level: 'ERROR',
            user_id: req.user?.user_id || null,
            org_id: req.user?.org_id || null,
            error_message: err.message,
            stack_trace: err.stack,
            request_method: req.method,
            request_path: req.originalUrl,
            client_ip: req.clientIp || req.ip
        });
    }

    if (process.env.NODE_ENV === 'development') {
        console.error('ERROR 💥', err);
    }

    const isDevelopment = process.env.NODE_ENV === 'development';

    // In strict default mode, we hide details unless explicitly in 'development'
    const message = (!isDevelopment && err.statusCode === 500)
        ? 'Something went wrong! Please contact support.'
        : err.message;

    res.status(err.statusCode).json({
        ok: false,
        status: err.status,
        message: message,
        ...(isDevelopment && { stack: err.stack, error: err })
    });
};

export default errorHandler;
