import express from 'express';
import bcrypt from 'bcrypt';
import { verifyToken, requireRole } from '../middleware/auth.js';
import User from '../models/User.js';
import { AppError } from '../middleware/errorHandler.js';

const router = express.Router();
const MIN_PASSWORD_LENGTH = 8;

const validateCredentials = (username, password) => {
    if (!username || !password) {
        throw new AppError('Username and password are required', 'VALIDATION_ERROR', 400);
    }
    if (password.length < MIN_PASSWORD_LENGTH) {
        throw new AppError(`Password must be at least ${MIN_PASSWORD_LENGTH} characters`, 'VALIDATION_ERROR', 400);
    }
}

const publicUser = (user) => ({
    user_id: user.user_id,
    username: user.username,
    role: user.role,
    student_id: user.student_id,
    is_active: user.is_active,
    assigned_faculty_id: user.assigned_faculty_id || null,
});

router.get('/coordinating-faculty', verifyToken, requireRole('admin'), async (req, res, next) => {
    try {
        res.json({ data: await User.getCoordinatingFaculty() });
    } catch (err) {
        next(err);
    }
});

router.post('/coordinating-faculty', verifyToken, requireRole('admin'), async (req, res, next) => {
    try {
        const { username, password } = req.body || {};
        validateCredentials(username, password);
        const existing = await User.getByUsername(username);
        if (existing) throw new AppError('Username is already in use', 'CONFLICT', 409);
        const user = await User.create({
            username,
            role: 'coordinating_faculty',
            password_hash: await bcrypt.hash(password, 12),
        });
        res.status(201).json(publicUser(user));
    } catch (err) {
        next(err);
    }
});

router.patch('/coordinating-faculty/:userId', verifyToken, requireRole('admin'), async (req, res, next) => {
    try {
        const user = await User.getById(req.params.userId);
        if (!user || user.role !== 'coordinating_faculty') throw new AppError('Coordinating Faculty account not found', 'NOT_FOUND', 404);
        const updates = {};
        if (req.body?.is_active !== undefined) updates.is_active = Boolean(req.body.is_active);
        if (req.body?.password) {
            validateCredentials(user.username, req.body.password);
            updates.password_hash = await bcrypt.hash(req.body.password, 12);
        }
        const updated = await User.update(user.user_id, updates);
        res.json(publicUser(updated));
    } catch (err) {
        next(err);
    }
});

router.get('/student-representatives', verifyToken, requireRole('coordinating_faculty'), async (req, res, next) => {
    try {
        res.json({ data: await User.getRepresentatives(req.user.user_id) });
    } catch (err) {
        next(err);
    }
});

router.post('/student-representatives', verifyToken, requireRole('coordinating_faculty'), async (req, res, next) => {
    try {
        const { username, password } = req.body || {};
        validateCredentials(username, password);
        const existing = await User.getByUsername(username);
        if (existing) throw new AppError('Username is already in use', 'CONFLICT', 409);
        const user = await User.create({
            username,
            role: 'student_representative',
            password_hash: await bcrypt.hash(password, 12),
            assigned_faculty_id: req.user.user_id,
        });
        res.status(201).json(publicUser(user));
    } catch (err) {
        next(err);
    }
});

router.patch('/student-representatives/:userId', verifyToken, requireRole('coordinating_faculty'), async (req, res, next) => {
    try {
        const user = await User.getById(req.params.userId);
        if (!user || user.role !== 'student_representative' || String(user.assigned_faculty_id) !== String(req.user.user_id)) {
            throw new AppError('Assigned Student Representative account not found', 'NOT_FOUND', 404);
        }
        const updates = {};
        if (req.body?.is_active !== undefined) updates.is_active = Boolean(req.body.is_active);
        if (req.body?.password) updates.password_hash = await bcrypt.hash(req.body.password, 12);
        const updated = await User.update(user.user_id, updates);
        res.json(publicUser(updated));
    } catch (err) {
        next(err);
    }
});

export default router;
