import express from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import { verifyToken } from '../middleware/auth.js';
import User from '../models/User.js';
import { AppError } from '../middleware/errorHandler.js';

const router = express.Router();
/**
 * POST /api/auth/login
 * Students authenticate with register number + DOB. Staff authenticate with
 * credentials provisioned by the hierarchy management APIs.
 */
router.post('/login', async (req, res, next) => {
    try {
        const { username, password, role } = req.body || {};

        if (!username || !password) {
            throw new AppError('Username and password are required', 'VALIDATION_ERROR', 400);
        }

        const normalizedUsername = username.trim();
        if (role === 'student' && !/^\d{4}-\d{2}-\d{2}$/.test(password)) {
            throw new AppError('Student date of birth must use YYYY-MM-DD format', 'VALIDATION_ERROR', 400);
        }

        const user = await User.getForLogin(normalizedUsername);
        if (!user || !user.is_active || !user.password_hash) {
            throw new AppError('Invalid username or password', 'UNAUTHORIZED', 401);
        }

        const passwordMatches = await bcrypt.compare(password, user.password_hash);
        if (!passwordMatches || (role && user.role !== role)) {
            throw new AppError('Invalid username or password', 'UNAUTHORIZED', 401);
        }

        const token = jwt.sign(
            { user_id: user.user_id },
            process.env.JWT_SECRET,
            { expiresIn: process.env.JWT_EXPIRY || '30m' }
        );

        return res.json({
            token,
            user: {
                user_id: user.user_id,
                username: user.username,
                role: user.role,
                student_id: user.student_id,
                is_active: user.is_active,
            },
        });
    } catch (err) {
        next(err);
    }
});

/**
 * POST /api/auth/logout
 * Logout user
 * JWT-based stateless logout (client removes token)
 */
router.post('/logout', verifyToken, async (req, res, next) => {
    try {
        res.json({ message: 'Logged out successfully' });
    } catch (err) {
        next(err);
    }
});

/**
 * GET /api/auth/me
 * Get authenticated user info
 */
router.get('/me', verifyToken, async (req, res, next) => {
    try {
        const user = await User.getUserWithStudent(req.user.user_id);
        
        if (!user) {
            throw new AppError('User not found', 'NOT_FOUND', 404);
        }

        res.json({
            user_id: user.user_id,
            username: user.username,
            role: user.role,
            is_active: user.is_active,
            student_id: user.student_id,
            student: user.student_id ? {
                student_id: user.student_id,
                register_number: user.register_number,
                name: user.name,
                department: user.department,
                year: user.year,
                section: user.section,
            } : null,
        });
    } catch (err) {
        next(err);
    }
});

export default router;
