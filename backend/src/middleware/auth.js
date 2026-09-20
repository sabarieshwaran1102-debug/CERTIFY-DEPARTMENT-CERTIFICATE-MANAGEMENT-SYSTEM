import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import pool from '../config/database.js';
import { AppError } from './errorHandler.js';

const jwtSecret = process.env.JWT_SECRET || 'development-secret-key';

export const verifyToken = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return next(new AppError('Missing or invalid authorization token', 'UNAUTHORIZED', 401));
        }
        const token = authHeader.substring(7);
        const decoded = jwt.verify(token, jwtSecret);
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