// NODE_ENV must be read before any function uses it — moved to top of module.
const NODE_ENV = process.env.NODE_ENV || 'development';

export const errorHandler = (err, req, res, _next) => {
    // Multer file-size error (client error — warn, not error)
    if (err.code === 'LIMIT_FILE_SIZE') {
        console.warn('[warn] File size limit exceeded:', req.path);
        return res.status(413).json({ error: 'Certificate file exceeds the 5 MB limit' });
    }

    // Known AppError types — expected client/business errors, log at warn level
    if (err.type === 'VALIDATION_ERROR') {
        console.warn('[warn] Validation error:', err.message, '|', req.method, req.path);
        return res.status(400).json({
            error: err.message,
            details: err.details || [],
        });
    }

    if (err.type === 'NOT_FOUND') {
        console.warn('[warn] Not found:', err.message, '|', req.method, req.path);
        return res.status(404).json({ error: err.message });
    }

    if (err.type === 'UNAUTHORIZED') {
        console.warn('[warn] Unauthorized:', err.message, '|', req.method, req.path);
        return res.status(401).json({ error: err.message });
    }

    if (err.type === 'FORBIDDEN') {
        console.warn('[warn] Forbidden:', err.message, '|', req.method, req.path);
        return res.status(403).json({ error: err.message });
    }

    if (err.type === 'CONFLICT') {
        console.warn('[warn] Conflict:', err.message, '|', req.method, req.path);
        return res.status(409).json({ error: err.message });
    }

    // Unexpected / 5xx errors — log full error object
    const statusCode = err.statusCode || 500;
    const message = NODE_ENV === 'production'
        ? 'Internal Server Error'
        : err.message;

    console.error('[error] Unhandled error:', err);

    res.status(statusCode).json({
        error: message,
        ...(NODE_ENV === 'development' && { stack: err.stack }),
    });
};

export class AppError extends Error {
    constructor(message, type = 'ERROR', statusCode = 500) {
        super(message);
        this.type = type;
        this.statusCode = statusCode;
    }
}
