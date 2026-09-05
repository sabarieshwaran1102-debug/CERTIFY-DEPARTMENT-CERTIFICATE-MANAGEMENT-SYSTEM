export const errorHandler = (err, req, res, next) => {
    console.error('Error:', err);

    // Known error types
    if (err.type === 'VALIDATION_ERROR') {
        return res.status(400).json({
            error: err.message,
            details: err.details || [],
        });
    }

    if (err.type === 'NOT_FOUND') {
        return res.status(404).json({ error: err.message });
    }

    if (err.type === 'UNAUTHORIZED') {
        return res.status(401).json({ error: err.message });
    }

    if (err.type === 'FORBIDDEN') {
        return res.status(403).json({ error: err.message });
    }

    if (err.type === 'CONFLICT') {
        return res.status(409).json({ error: err.message });
    }

    // Default error response
    const statusCode = err.statusCode || 500;
    const message = NODE_ENV === 'production' 
        ? 'Internal Server Error' 
        : err.message;

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

const NODE_ENV = process.env.NODE_ENV || 'development';
