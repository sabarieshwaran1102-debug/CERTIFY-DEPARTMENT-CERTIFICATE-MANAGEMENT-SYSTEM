import express from 'express';
import { verifyToken } from '../middleware/auth.js';
import User from '../models/User.js';
import { AppError } from '../middleware/errorHandler.js';

const router = express.Router();

/**
 * POST /api/auth/login
 * Authenticate user
 * Note: Authentication method is pending department confirmation
 * This is a placeholder endpoint structure
 */
router.post('/login', async (req, res, next) => {
    try {
        // TODO: Implement after department confirms authentication method
        throw new AppError(
            'Authentication method not yet configured. Pending department decision.',
            'VALIDATION_ERROR',
            501
        );
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
