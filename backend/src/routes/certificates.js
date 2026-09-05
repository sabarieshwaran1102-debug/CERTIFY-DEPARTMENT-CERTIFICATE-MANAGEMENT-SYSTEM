import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs/promises';
import { access, mkdir } from 'fs/promises';
import { verifyToken, requireRole } from '../middleware/auth.js';
import { requireStudentRepRole, requireFacultyRole } from '../middleware/authorization.js';
import Certificate from '../models/Certificate.js';
import ODRecord from '../models/ODRecord.js';
import Student from '../models/Student.js';
import { AppError } from '../middleware/errorHandler.js';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const STORAGE_BASE = path.join(__dirname, '../../..', process.env.STORAGE_PATH || '../storage/certificates');

const router = express.Router();

// File upload middleware
const storage = multer.memoryStorage();
const upload = multer({
    storage,
    limits: { fileSize: parseInt(process.env.MAX_FILE_SIZE || 5242880) }, // 5 MB default
    fileFilter: (req, file, cb) => {
        const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/jpg'];
        if (allowedTypes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new AppError(`Invalid file type: ${file.mimetype}. Allowed types: PDF, JPG, JPEG, PNG`, 'VALIDATION_ERROR', 400));
        }
    },
});

/**
 * POST /api/certificates
 * Submit certificate (Student only)
 * Body: { registration_number, file }
 */
router.post('/', 
    verifyToken, 
    requireRole('student'),
    upload.single('file'),
    async (req, res, next) => {
        try {
            const { registration_number } = req.body;

            if (!registration_number) {
                throw new AppError('registration_number is required', 'VALIDATION_ERROR', 400);
            }

            if (!req.file) {
                throw new AppError('No file provided', 'VALIDATION_ERROR', 400);
            }

            // Get OD record by registration number
            const odRecord = await ODRecord.getByRegistrationNumber(registration_number);
            if (!odRecord) {
                throw new AppError(`OD record not found for registration number: ${registration_number}`, 'NOT_FOUND', 404);
            }

            // Verify ownership: OD must belong to authenticated student
            if (odRecord.student_id !== req.user.student_id) {
                throw new AppError('This OD record belongs to another student', 'FORBIDDEN', 403);
            }

            // Check if certificate already exists for this OD
            const existingCert = await Certificate.getByOdId(odRecord.od_id);
            if (existingCert) {
                throw new AppError('A certificate has already been submitted for this OD record', 'CONFLICT', 409);
            }

            // Get student for register_number
            const student = await Student.getById(req.user.student_id);
            if (!student) {
                throw new AppError('Student not found', 'NOT_FOUND', 404);
            }

            // Prepare file storage path
            const now = new Date();
            const year = now.getFullYear();
            const month = String(now.getMonth() + 1).padStart(2, '0');
            const submissionMonth = `${year}-${month}`;
            
            const dirPath = path.join(STORAGE_BASE, year.toString(), month);
            
            // Create directory if it doesn't exist
            try {
                await mkdir(dirPath, { recursive: true });
            } catch (err) {
                throw new AppError(`Could not create storage directory: ${err.message}`, 'VALIDATION_ERROR', 400);
            }

            // Generate filename: {register_number}_{registration_number}.{extension}
            const ext = path.extname(req.file.originalname).toLowerCase().substring(1);
            const fileName = `${student.register_number}_${registration_number}.${ext}`;
            const filePath = path.join(dirPath, fileName);

            // Save file to disk
            try {
                await fs.writeFile(filePath, req.file.buffer);
            } catch (err) {
                throw new AppError(`Could not save certificate file: ${err.message}`, 'VALIDATION_ERROR', 400);
            }

            // Create certificate record in database
            const certificate = await Certificate.create({
                od_id: odRecord.od_id,
                student_id: req.user.student_id,
                file_name: fileName,
                file_path: filePath,
                file_size: req.file.size,
                file_type: req.file.mimetype,
                submission_month: submissionMonth,
            });

            res.status(201).json({
                certificate_id: certificate.certificate_id,
                od_id: certificate.od_id,
                registration_number: registration_number,
                file_name: certificate.file_name,
                file_size: certificate.file_size,
                submitted_at: certificate.submitted_at,
                submission_month: certificate.submission_month,
            });
        } catch (err) {
            next(err);
        }
    }
);

/**
 * GET /api/certificates/:certId/download
 * Download certificate (Student can download own, Faculty can download any)
 */
router.get('/:certId/download', verifyToken, async (req, res, next) => {
    try {
        const { role, student_id } = req.user;
        const { certId } = req.params;

        const certificate = await Certificate.getById(certId);
        if (!certificate) {
            throw new AppError('Certificate not found', 'NOT_FOUND', 404);
        }

        // Students can only download their own certificates
        if (role === 'student' && certificate.student_id !== student_id) {
            throw new AppError('You do not have access to this certificate', 'FORBIDDEN', 403);
        }

        // Faculty and Student Rep cannot download (only list) - per requirements
        if (!['student', 'coordinating_faculty'].includes(role)) {
            throw new AppError('Insufficient permissions', 'FORBIDDEN', 403);
        }

        // Verify file exists
        try {
            await access(certificate.file_path);
        } catch (err) {
            throw new AppError('Certificate file not found on server', 'NOT_FOUND', 404);
        }

        // Stream file download
        res.download(certificate.file_path, certificate.file_name);
    } catch (err) {
        next(err);
    }
});

/**
 * GET /api/certificates
 * List certificates (Faculty only)
 */
router.get('/', verifyToken, requireRole('coordinating_faculty'), async (req, res, next) => {
    try {
        const limit = Math.min(parseInt(req.query.limit || 50), 100);
        const offset = parseInt(req.query.offset || 0);

        const filters = {};
        if (req.query.student_id) filters.student_id = req.query.student_id;
        if (req.query.submission_month) filters.submission_month = req.query.submission_month;
        if (req.query.department) filters.department = req.query.department;
        if (req.query.year) filters.year = req.query.year;
        if (req.query.section) filters.section = req.query.section;

        const certificates = await Certificate.getAll(filters, limit, offset);

        res.json({
            data: certificates,
            limit,
            offset,
        });
    } catch (err) {
        next(err);
    }
});

export default router;
