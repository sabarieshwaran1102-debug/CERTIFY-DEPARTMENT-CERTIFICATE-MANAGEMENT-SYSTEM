import jwt from 'jsonwebtoken';
import { AppError } from './errorHandler.js';

export const verifyToken = (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            throw new AppError('Missing or invalid authorization token', 'UNAUTHORIZED', 401);
        }

        const token = authHeader.substring(7); // Remove 'Bearer ' prefix

        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        
        req.user = {
            user_id: decoded.user_id,
            student_id: decoded.student_id,
            role: decoded.role,
        };

        next();
    } catch (err) {
        if (err instanceof AppError) {
            throw err;
        }
        throw new AppError('Invalid or expired token', 'UNAUTHORIZED', 401);
    }
};

export const requireRole = (...allowedRoles) => {
    return (req, res, next) => {
        if (!req.user) {
            throw new AppError('Authentication required', 'UNAUTHORIZED', 401);
        }

        if (!allowedRoles.includes(req.user.role)) {
            throw new AppError('Insufficient permissions for this action', 'FORBIDDEN', 403);
        }

        next();
    };
};
