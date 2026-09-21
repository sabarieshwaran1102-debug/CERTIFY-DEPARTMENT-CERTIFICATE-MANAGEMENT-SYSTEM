/**
 * Phase 4: OD Certificate Management — /api/od-certificates
 *
 * Endpoints:
 *   POST   /api/od-certificates                       Submit (first upload) or replace
 *   GET    /api/od-certificates                       List (paginated, scoped)
 *   GET    /api/od-certificates/:id                   Get single certificate
 *   GET    /api/od-certificates/:id/download          Download file
 *   GET    /api/od-certificates/:id/versions          Version history
 *   PATCH  /api/od-certificates/:id/verify            Verify
 *   PATCH  /api/od-certificates/:id/reject            Reject
 *   PATCH  /api/od-certificates/:id/approve-late      Approve late submission
 *   PATCH  /api/od-certificates/:id/reject-late       Reject late submission
 *   GET    /api/od-certificates/ods/:odId             All certs for one OD
 *   GET    /api/od-certificates/pending               Certs needing review (staff)
 */

import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs/promises';
import { access } from 'fs/promises';
import { verifyToken } from '../middleware/auth.js';
import { requireManagementRole } from '../middleware/authorization.js';
import OdCertificate, { computeDeadline, isLateSubmission } from '../models/OdCertificate.js';
import OD from '../models/OD.js';
import pool from '../config/database.js';
import { AppError } from '../middleware/errorHandler.js';
import { getCertificateSubdirectory, ensureStorageDirectory } from '../config/storage.js';

const router = express.Router();

// ── File upload middleware ─────────────────────────────────────────────────────
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: parseInt(process.env.MAX_FILE_SIZE || 5242880) },
    fileFilter: (req, file, cb) => {
        const allowed = ['application/pdf', 'image/jpeg', 'image/png', 'image/jpg'];
        if (allowed.includes(file.mimetype)) return cb(null, true);
        cb(new AppError(
            `Invalid file type: ${file.mimetype}. Allowed: PDF, JPG, PNG`,
            'VALIDATION_ERROR', 400
        ));
    },
});

// ── Role sets ─────────────────────────────────────────────────────────────────
const SUBMIT_ROLES   = ['student', 'class_representative'];
const REVIEW_ROLES   = ['super_admin', 'admin', 'coordinating_faculty', 'class_advisor'];
const READER_ROLES   = ['super_admin', 'admin', 'coordinating_faculty', 'class_advisor', 'class_representative', 'student'];

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Resolve the OD and verify the requesting user is a participant.
 * Returns { od, studentId }.
 */
async function resolveOdParticipation(req, odId) {
    const od = await OD.getById(odId);
    if (!od) throw new AppError('OD not found', 'NOT_FOUND', 404);
    if (od.status === 'cancelled') throw new AppError('Cannot submit certificate for a cancelled OD', 'VALIDATION_ERROR', 400);

    const { role } = req.user;

    if (role === 'student') {
        const isParticipant = (od.participants || []).some(
            (p) => Number(p.student_id) === Number(req.user.student_id)
        );
        if (!isParticipant) throw new AppError('You are not a participant of this OD', 'FORBIDDEN', 403);
        return { od, studentId: Number(req.user.student_id) };
    }

    if (role === 'class_representative') {
        // CR submitting on behalf: student_id must be provided and be in their class
        const studentId = Number(req.body?.student_id);
        if (!studentId) throw new AppError('student_id is required for class representative submission', 'VALIDATION_ERROR', 400);
        const isParticipant = (od.participants || []).some((p) => Number(p.student_id) === studentId);
        if (!isParticipant) throw new AppError('Student is not a participant of this OD', 'FORBIDDEN', 403);
        if (String(od.class_id) !== String(req.user.class_id))
            throw new AppError('OD does not belong to your class', 'FORBIDDEN', 403);
        return { od, studentId };
    }

    throw new AppError('Only students and class representatives can submit certificates', 'FORBIDDEN', 403);
}

/**
 * Save uploaded file buffer to disk and return the stored path.
 */
async function saveFile(buffer, originalName, registerNumber, odNumber) {
    const ext = path.extname(originalName).toLowerCase().replace('.', '') || 'bin';
    const subdir = getCertificateSubdirectory(new Date());
    ensureStorageDirectory(subdir);
    const fileName = `${registerNumber}_${odNumber}_${Date.now()}.${ext}`;
    const filePath = path.join(subdir, fileName);
    await fs.writeFile(filePath, buffer);
    return { fileName, filePath };
}

/**
 * Build read scope from the authenticated user.
 */
async function buildScope(req) {
    const { role } = req.user;
    if (role === 'student')            return { type: 'student', studentId: req.user.student_id };
    if (role === 'class_representative') {
        if (!req.user.class_id) throw new AppError('No class assigned to this representative', 'FORBIDDEN', 403);
        return { type: 'class', classId: req.user.class_id };
    }
    if (role === 'class_advisor') {
        const r = await pool.query(
            'SELECT class_id FROM class_advisor_history WHERE user_id=$1 AND unassigned_at IS NULL',
            [req.user.user_id]
        );
        if (!r.rows[0]) throw new AppError('No class assigned to this advisor', 'FORBIDDEN', 403);
        return { type: 'class', classId: r.rows[0].class_id };
    }
    return null; // global
}

/**
 * Assert caller may manage (review/verify/reject) a specific certificate.
 * Class advisor must be the active advisor for the OD's class.
 */
async function assertReviewAccess(req, cert) {
    const { role } = req.user;
    if (['super_admin', 'admin', 'coordinating_faculty'].includes(role)) return;
    if (role === 'class_advisor') {
        const check = await pool.query(
            'SELECT 1 FROM class_advisor_history WHERE class_id=$1 AND user_id=$2 AND unassigned_at IS NULL',
            [cert.class_id, req.user.user_id]
        );
        if (!check.rows[0]) throw new AppError('You are not the active advisor for this class', 'FORBIDDEN', 403);
        return;
    }
    throw new AppError('Insufficient permissions', 'FORBIDDEN', 403);
}

// ── POST /api/od-certificates  (submit or replace) ────────────────────────────
router.post('/', verifyToken, upload.single('file'), async (req, res, next) => {
    if (!SUBMIT_ROLES.includes(req.user.role))
        return next(new AppError('Only students and class representatives can submit certificates', 'FORBIDDEN', 403));

    if (!req.file) return next(new AppError('No file provided', 'VALIDATION_ERROR', 400));

    const odId = Number(req.body?.od_id);
    if (!odId) return next(new AppError('od_id is required', 'VALIDATION_ERROR', 400));

    const client = await pool.connect();
    try {
        const { od, studentId } = await resolveOdParticipation(req, odId);

        // Mark overdue before any submit logic
        await OdCertificate.markOverdue(odId);

        // Get student register number for file naming
        const stuRow = (await pool.query('SELECT register_number FROM students WHERE student_id=$1', [studentId])).rows[0];
        if (!stuRow) throw new AppError('Student not found', 'NOT_FOUND', 404);

        const deadline = computeDeadline(od.od_end_date);
        const late     = isLateSubmission(deadline);
        const lateReason = (req.body?.late_reason || '').trim() || null;

        if (late && !lateReason) {
            throw new AppError(
                'late_reason is required when submitting after the deadline',
                'VALIDATION_ERROR', 400
            );
        }

        const { fileName, filePath } = await saveFile(
            req.file.buffer, req.file.originalname,
            stuRow.register_number, od.od_number
        );

        await client.query('BEGIN');

        // Check if a certificate already exists for this (od, student)
        const existing = await OdCertificate.getByOdAndStudent(odId, studentId);

        let certId;
        if (!existing) {
            // First submission
            certId = await OdCertificate.submit({
                odId, studentId,
                fileName, filePath,
                fileSize: req.file.size,
                fileType: req.file.mimetype,
                deadline,
                isLate: late,
                lateReason,
                submittedBy: req.user.user_id,
            }, client);
        } else {
            // Replacement — only allowed if not already verified
            if (existing.status === 'verified') {
                await fs.unlink(filePath).catch(() => {});
                throw new AppError('Verified certificates cannot be replaced', 'CONFLICT', 409);
            }
            certId = existing.id;
            await OdCertificate.replace({
                certId,
                fileName, filePath,
                fileSize: req.file.size,
                fileType: req.file.mimetype,
                deadline,
                isLate: late,
                lateReason,
                replacedBy: req.user.user_id,
            }, client);
        }

        await client.query('COMMIT');

        const full = await OdCertificate.getById(certId);
        return res.status(existing ? 200 : 201).json(full);
    } catch (err) {
        await client.query('ROLLBACK');
        return next(err);
    } finally {
        client.release();
    }
});

// ── GET /api/od-certificates ──────────────────────────────────────────────────
router.get('/', verifyToken, async (req, res, next) => {
    try {
        if (!READER_ROLES.includes(req.user.role))
            throw new AppError('Insufficient permissions', 'FORBIDDEN', 403);

        const scope  = await buildScope(req);
        const limit  = Math.min(parseInt(req.query.limit  || 25, 10), 100);
        const offset = parseInt(req.query.offset || 0, 10);
        const filters = {};
        if (req.query.od_id)   filters.od_id   = req.query.od_id;
        if (req.query.status)  filters.status  = req.query.status;
        if (req.query.is_late) filters.is_late = req.query.is_late === 'true';
        // global roles may filter by class
        if (['super_admin','admin','coordinating_faculty'].includes(req.user.role) && req.query.class_id)
            filters.class_id = req.query.class_id;

        const result = await OdCertificate.getAll(filters, limit, offset, scope);
        return res.json({ data: result.rows, pagination: { total: result.total, limit, offset } });
    } catch (err) { return next(err); }
});

// ── GET /api/od-certificates/pending ─────────────────────────────────────────
router.get('/pending', verifyToken, async (req, res, next) => {
    try {
        if (!REVIEW_ROLES.includes(req.user.role))
            throw new AppError('Insufficient permissions', 'FORBIDDEN', 403);

        const scope  = await buildScope(req);
        const limit  = Math.min(parseInt(req.query.limit  || 25, 10), 100);
        const offset = parseInt(req.query.offset || 0, 10);
        const filters = { status: req.query.include_late === 'true' ? undefined : 'submitted' };
        if (req.query.include_late === 'true') {
            // both submitted and late_submitted
            const [submitted, lateSubmitted] = await Promise.all([
                OdCertificate.getAll({ status: 'submitted' }, limit, offset, scope),
                OdCertificate.getAll({ status: 'late_submitted' }, 100, 0, scope),
            ]);
            const combined = [...submitted.rows, ...lateSubmitted.rows]
                .sort((a, b) => new Date(b.submitted_at) - new Date(a.submitted_at));
            return res.json({ data: combined, pagination: { total: submitted.total + lateSubmitted.total, limit, offset } });
        }
        const result = await OdCertificate.getAll(filters, limit, offset, scope);
        return res.json({ data: result.rows, pagination: { total: result.total, limit, offset } });
    } catch (err) { return next(err); }
});

// ── GET /api/od-certificates/ods/:odId ────────────────────────────────────────
router.get('/ods/:odId(\\d+)', verifyToken, async (req, res, next) => {
    try {
        if (!READER_ROLES.includes(req.user.role))
            throw new AppError('Insufficient permissions', 'FORBIDDEN', 403);

        const od = await OD.getById(req.params.odId);
        if (!od) throw new AppError('OD not found', 'NOT_FOUND', 404);

        // Students: must be a participant
        if (req.user.role === 'student') {
            const isParticipant = (od.participants || []).some(
                (p) => Number(p.student_id) === Number(req.user.student_id)
            );
            if (!isParticipant) throw new AppError('You do not have access to this OD', 'FORBIDDEN', 403);
        }
        // Class-scoped: class must match
        if (['class_representative'].includes(req.user.role)) {
            if (String(od.class_id) !== String(req.user.class_id))
                throw new AppError('OD does not belong to your class', 'FORBIDDEN', 403);
        }
        if (req.user.role === 'class_advisor') {
            const check = await pool.query(
                'SELECT 1 FROM class_advisor_history WHERE class_id=$1 AND user_id=$2 AND unassigned_at IS NULL',
                [od.class_id, req.user.user_id]
            );
            if (!check.rows[0]) throw new AppError('You are not the active advisor for this OD\'s class', 'FORBIDDEN', 403);
        }

        // Mark overdue lazily
        await OdCertificate.markOverdue(od.id);

        const certs = await OdCertificate.getByOdId(od.id);
        return res.json({ data: certs });
    } catch (err) { return next(err); }
});

// ── GET /api/od-certificates/:id ──────────────────────────────────────────────
router.get('/:id(\\d+)', verifyToken, async (req, res, next) => {
    try {
        if (!READER_ROLES.includes(req.user.role))
            throw new AppError('Insufficient permissions', 'FORBIDDEN', 403);

        const cert = await OdCertificate.getById(req.params.id);
        if (!cert) throw new AppError('Certificate not found', 'NOT_FOUND', 404);

        // Ownership checks
        if (req.user.role === 'student' && Number(cert.student_id) !== Number(req.user.student_id))
            throw new AppError('You do not have access to this certificate', 'FORBIDDEN', 403);
        if (req.user.role === 'class_representative' && String(cert.class_id) !== String(req.user.class_id))
            throw new AppError('Certificate is not in your class', 'FORBIDDEN', 403);
        if (req.user.role === 'class_advisor') {
            const check = await pool.query(
                'SELECT 1 FROM class_advisor_history WHERE class_id=$1 AND user_id=$2 AND unassigned_at IS NULL',
                [cert.class_id, req.user.user_id]
            );
            if (!check.rows[0]) throw new AppError('Certificate is not in your assigned class', 'FORBIDDEN', 403);
        }

        return res.json(cert);
    } catch (err) { return next(err); }
});

// ── GET /api/od-certificates/:id/download ─────────────────────────────────────
router.get('/:id(\\d+)/download', verifyToken, async (req, res, next) => {
    try {
        if (!READER_ROLES.includes(req.user.role))
            throw new AppError('Insufficient permissions', 'FORBIDDEN', 403);

        const cert = await OdCertificate.getById(req.params.id);
        if (!cert) throw new AppError('Certificate not found', 'NOT_FOUND', 404);

        // Same ownership checks as GET /:id
        if (req.user.role === 'student' && Number(cert.student_id) !== Number(req.user.student_id))
            throw new AppError('You do not have access to this certificate', 'FORBIDDEN', 403);
        if (req.user.role === 'class_representative' && String(cert.class_id) !== String(req.user.class_id))
            throw new AppError('Certificate is not in your class', 'FORBIDDEN', 403);
        if (req.user.role === 'class_advisor') {
            const check = await pool.query(
                'SELECT 1 FROM class_advisor_history WHERE class_id=$1 AND user_id=$2 AND unassigned_at IS NULL',
                [cert.class_id, req.user.user_id]
            );
            if (!check.rows[0]) throw new AppError('Certificate is not in your assigned class', 'FORBIDDEN', 403);
        }

        // Verify file exists
        try { await access(cert.file_path); }
        catch { throw new AppError('Certificate file not found on server', 'NOT_FOUND', 404); }

        return res.download(cert.file_path, cert.file_name);
    } catch (err) { return next(err); }
});

// ── GET /api/od-certificates/:id/versions ────────────────────────────────────
router.get('/:id(\\d+)/versions', verifyToken, async (req, res, next) => {
    try {
        if (!READER_ROLES.includes(req.user.role))
            throw new AppError('Insufficient permissions', 'FORBIDDEN', 403);

        const cert = await OdCertificate.getById(req.params.id);
        if (!cert) throw new AppError('Certificate not found', 'NOT_FOUND', 404);

        // Only owner student or staff may see version history
        if (req.user.role === 'student' && Number(cert.student_id) !== Number(req.user.student_id))
            throw new AppError('You do not have access to this certificate', 'FORBIDDEN', 403);

        const versions = await OdCertificate.getVersions(req.params.id);
        return res.json({ data: versions, current_version: cert.version });
    } catch (err) { return next(err); }
});

// ── PATCH /api/od-certificates/:id/verify ────────────────────────────────────
router.patch('/:id(\\d+)/verify', verifyToken, async (req, res, next) => {
    if (!REVIEW_ROLES.includes(req.user.role))
        return next(new AppError('Insufficient permissions', 'FORBIDDEN', 403));

    const client = await pool.connect();
    try {
        const cert = await OdCertificate.getById(req.params.id);
        if (!cert) throw new AppError('Certificate not found', 'NOT_FOUND', 404);
        await assertReviewAccess(req, cert);

        if (!['submitted'].includes(cert.status))
            throw new AppError(`Cannot verify a certificate with status: ${cert.status}`, 'CONFLICT', 409);

        await client.query('BEGIN');
        await OdCertificate.verify(cert.id, req.user.user_id, client);
        await client.query('COMMIT');

        return res.json(await OdCertificate.getById(cert.id));
    } catch (err) { await client.query('ROLLBACK'); return next(err); }
    finally { client.release(); }
});

// ── PATCH /api/od-certificates/:id/reject ────────────────────────────────────
router.patch('/:id(\\d+)/reject', verifyToken, async (req, res, next) => {
    if (!REVIEW_ROLES.includes(req.user.role))
        return next(new AppError('Insufficient permissions', 'FORBIDDEN', 403));

    const client = await pool.connect();
    try {
        const cert = await OdCertificate.getById(req.params.id);
        if (!cert) throw new AppError('Certificate not found', 'NOT_FOUND', 404);
        await assertReviewAccess(req, cert);

        const reason = (req.body?.reason || '').trim();
        if (!reason) throw new AppError('reason is required to reject a certificate', 'VALIDATION_ERROR', 400);

        if (!['submitted', 'late_submitted'].includes(cert.status))
            throw new AppError(`Cannot reject a certificate with status: ${cert.status}`, 'CONFLICT', 409);

        await client.query('BEGIN');
        await OdCertificate.reject(cert.id, req.user.user_id, reason, client);
        await client.query('COMMIT');

        return res.json(await OdCertificate.getById(cert.id));
    } catch (err) { await client.query('ROLLBACK'); return next(err); }
    finally { client.release(); }
});

// ── PATCH /api/od-certificates/:id/approve-late ──────────────────────────────
router.patch('/:id(\\d+)/approve-late', verifyToken, async (req, res, next) => {
    if (!REVIEW_ROLES.includes(req.user.role))
        return next(new AppError('Insufficient permissions', 'FORBIDDEN', 403));

    const client = await pool.connect();
    try {
        const cert = await OdCertificate.getById(req.params.id);
        if (!cert) throw new AppError('Certificate not found', 'NOT_FOUND', 404);
        await assertReviewAccess(req, cert);

        if (cert.status !== 'late_submitted')
            throw new AppError('Certificate is not in late_submitted status', 'CONFLICT', 409);

        await client.query('BEGIN');
        await OdCertificate.approveLate(cert.id, req.user.user_id, client);
        await client.query('COMMIT');

        return res.json(await OdCertificate.getById(cert.id));
    } catch (err) { await client.query('ROLLBACK'); return next(err); }
    finally { client.release(); }
});

// ── PATCH /api/od-certificates/:id/reject-late ───────────────────────────────
router.patch('/:id(\\d+)/reject-late', verifyToken, async (req, res, next) => {
    if (!REVIEW_ROLES.includes(req.user.role))
        return next(new AppError('Insufficient permissions', 'FORBIDDEN', 403));

    const client = await pool.connect();
    try {
        const cert = await OdCertificate.getById(req.params.id);
        if (!cert) throw new AppError('Certificate not found', 'NOT_FOUND', 404);
        await assertReviewAccess(req, cert);

        const reason = (req.body?.reason || '').trim();
        if (!reason) throw new AppError('reason is required', 'VALIDATION_ERROR', 400);

        if (cert.status !== 'late_submitted')
            throw new AppError('Certificate is not in late_submitted status', 'CONFLICT', 409);

        await client.query('BEGIN');
        await OdCertificate.rejectLate(cert.id, req.user.user_id, reason, client);
        await client.query('COMMIT');

        return res.json(await OdCertificate.getById(cert.id));
    } catch (err) { await client.query('ROLLBACK'); return next(err); }
    finally { client.release(); }
});

export default router;
