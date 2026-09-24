import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import { AppError } from './errorHandler.js';

// JWT_SECRET is required. No fallback — a missing secret must fail loudly.
// Production startup in app.js separately validates the secret length.
const jwtSecret = process.env.JWT_SECRET;
if (!jwtSecret) {
    throw new Error(
        'JWT_SECRET environment variable is not set. ' +
        'Set it to a random string of at least 32 characters before starting the server.'
    );
}

export const verifyToken = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return next(new AppError('Missing or invalid authorization token', 'UNAUTHORIZED', 401));
        }
        const token = authHeader.substring(7);
        // Pin to HS256 — prevents "alg: none" and algorithm confusion attacks.
        const decoded = jwt.verify(token, jwtSecret, { algorithms: ['HS256'] });
        const user = await User.getById(decoded.user_id);
        if (!user || !user.is_active) {
            return next(new AppError('User account is inactive or unavailable', 'UNAUTHORIZED', 401));
        }
        req.user = {
            user_id: user.user_id,
            student_id: user.student_id,
            role: user.role,
            username: user.username,
            assigned_faculty_id: user.assigned_faculty_id,
            class_id: user.class_id || null,
        };
        return next();
    } catch (err) {
        if (err instanceof AppError) return next(err);
        return next(new AppError('Invalid or expired token', 'UNAUTHORIZED', 401));
    }
};

export const requireRole = (...allowedRoles) => {
    return (req, res, next) => {
        if (!req.user) return next(new AppError('Authentication required', 'UNAUTHORIZED', 401));
        if (!allowedRoles.includes(req.user.role)) {
            return next(new AppError('Insufficient permissions for this action', 'FORBIDDEN', 403));
        }
        return next();
    };
};
