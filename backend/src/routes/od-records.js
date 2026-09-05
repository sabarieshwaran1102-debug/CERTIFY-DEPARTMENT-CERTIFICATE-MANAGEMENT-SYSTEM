import express from 'express';
import { verifyToken, requireRole } from '../middleware/auth.js';
import { requireStudentRepRole, requireFacultyRole } from '../middleware/authorization.js';
import ODRecord from '../models/ODRecord.js';
import Student from '../models/Student.js';
import Certificate from '../models/Certificate.js';
import { AppError } from '../middleware/errorHandler.js';

const router = express.Router();

/**
 * POST /api/od-records
 * Register new OD (Student Rep only)
 * Returns: { od_id, registration_number, student_id }
 */
router.post('/', verifyToken, requireStudentRepRole, async (req, res, next) => {
    try {
        const { student_id, event_details } = req.body;

        // Validate required fields
        if (!student_id || !event_details) {
            throw new AppError('Missing required fields: student_id, event_details', 'VALIDATION_ERROR', 400);
        }

        // Verify student exists
        const student = await Student.getById(student_id);
        if (!student) {
            throw new AppError('Student not found', 'NOT_FOUND', 404);
        }

        // Create OD record with auto-generated registration number
        const createdBy = req.user.username || `user_${req.user.user_id}`;
        const odRecord = await ODRecord.create(student_id, event_details, createdBy);

        res.status(201).json({
            od_id: odRecord.od_id,
            student_id: odRecord.student_id,
            registration_number: odRecord.registration_number,
            event_details: odRecord.event_details,
            od_status: odRecord.od_status,
            created_at: odRecord.created_at,
            created_by: odRecord.created_by,
        });
    } catch (err) {
        next(err);
    }
});

/**
 * GET /api/od-records
 * List OD records (accessible by Student Rep and Faculty)
 */
router.get('/', verifyToken, async (req, res, next) => {
    try {
        const { role } = req.user;
        if (!['student_representative', 'coordinating_faculty'].includes(role)) {
            throw new AppError('Insufficient permissions', 'FORBIDDEN', 403);
        }

        const limit = Math.min(parseInt(req.query.limit || 50), 100);
        const offset = parseInt(req.query.offset || 0);

        const filters = {};
        if (req.query.department) filters.department = req.query.department;
        if (req.query.status) filters.status = req.query.status;

        const records = await ODRecord.getAll(filters, limit, offset);

        res.json({
            data: records,
            limit,
            offset,
        });
    } catch (err) {
        next(err);
    }
});

/**
 * GET /api/od-records/:odId
 * Get specific OD record details
 */
router.get('/:odId', verifyToken, async (req, res, next) => {
    try {
        const { role, student_id } = req.user;
        const { odId } = req.params;

        const odRecord = await ODRecord.getById(odId);
        if (!odRecord) {
            throw new AppError('OD record not found', 'NOT_FOUND', 404);
        }

        // Students can only view their own OD records
        if (role === 'student' && odRecord.student_id !== student_id) {
            throw new AppError('You do not have access to this record', 'FORBIDDEN', 403);
        }

        // Faculty and Student Rep can view all
        if (!['student_representative', 'coordinating_faculty', 'student'].includes(role)) {
            throw new AppError('Insufficient permissions', 'FORBIDDEN', 403);
        }

        // Get associated certificate if exists
        const certificate = await Certificate.getByOdId(odId);

        res.json({
            ...odRecord,
            certificate: certificate ? {
                certificate_id: certificate.certificate_id,
                file_name: certificate.file_name,
                submitted_at: certificate.submitted_at,
            } : null,
        });
    } catch (err) {
        next(err);
    }
});

export default router;
