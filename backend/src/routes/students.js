import express from 'express';
import { verifyToken, requireRole } from '../middleware/auth.js';
import { requireStudentOwnership, requireStudentRepRole } from '../middleware/authorization.js';
import Student from '../models/Student.js';
import ODRecord from '../models/ODRecord.js';
import Certificate from '../models/Certificate.js';
import { AppError } from '../middleware/errorHandler.js';

const router = express.Router();

/**
 * GET /api/students/me
 * Get authenticated student's own info
 */
router.get('/me', verifyToken, requireRole('student'), async (req, res, next) => {
    try {
        const student = await Student.getById(req.user.student_id);
        
        if (!student) {
            throw new AppError('Student not found', 'NOT_FOUND', 404);
        }

        res.json(student);
    } catch (err) {
        next(err);
    }
});

/**
 * GET /api/students/me/od-records
 * List authenticated student's OD records
 */
router.get('/me/od-records', verifyToken, requireRole('student'), async (req, res, next) => {
    try {
        const limit = Math.min(parseInt(req.query.limit || 50), 100);
        const offset = parseInt(req.query.offset || 0);

        const records = await ODRecord.getByStudentId(req.user.student_id, limit, offset);
        const count = await ODRecord.countByStudentId(req.user.student_id);

        res.json({
            data: records,
            total: count,
            limit,
            offset,
        });
    } catch (err) {
        next(err);
    }
});

/**
 * GET /api/students/me/certificates
 * List authenticated student's submitted certificates
 */
router.get('/me/certificates', verifyToken, requireRole('student'), async (req, res, next) => {
    try {
        const limit = Math.min(parseInt(req.query.limit || 50), 100);
        const offset = parseInt(req.query.offset || 0);

        const certificates = await Certificate.getByStudentId(req.user.student_id, limit, offset);
        const count = await Certificate.countByStudentId(req.user.student_id);

        res.json({
            data: certificates,
            total: count,
            limit,
            offset,
        });
    } catch (err) {
        next(err);
    }
});

/**
 * GET /api/students
 * Search students (for Student Rep registration)
 */
router.get('/', verifyToken, requireStudentRepRole, async (req, res, next) => {
    try {
        const query = req.query.q || '';
        const limit = Math.min(parseInt(req.query.limit || 20), 100);
        const offset = parseInt(req.query.offset || 0);

        if (!query || query.trim().length === 0) {
            throw new AppError('Search query required (q parameter)', 'VALIDATION_ERROR', 400);
        }

        const students = await Student.search(query.trim(), limit, offset);

        res.json({
            data: students,
            query,
            limit,
            offset,
        });
    } catch (err) {
        next(err);
    }
});

export default router;
