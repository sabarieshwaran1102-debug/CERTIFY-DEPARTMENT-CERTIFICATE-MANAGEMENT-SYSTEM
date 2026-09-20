import express from 'express';
import { verifyToken } from '../middleware/auth.js';
import { requireManagementRole } from '../middleware/authorization.js';
import OD from '../models/OD.js';
import pool from '../config/database.js';
import { AppError } from '../middleware/errorHandler.js';

const router = express.Router();

// Roles allowed to create ODs
const OD_CREATOR_ROLES = ['super_admin', 'admin', 'class_advisor', 'class_representative'];

// ── helpers ───────────────────────────────────────────────────────────────────

/**
 * Resolve the class_id the caller is authorised to create ODs for.
 * Returns the class record from the DB, or throws AppError.
 *
 * Rules:
 *  - super_admin / admin  → trust the request body class_id
 *  - class_advisor        → must be the active advisor for that class
 *  - class_representative → must be assigned to exactly that class
 */
async function resolveAndAuthoriseClass(req, requestedClassId) {
    if (!requestedClassId) {
        throw new AppError('class_id is required', 'VALIDATION_ERROR', 400);
    }

    const classResult = await pool.query(
        `SELECT c.*, d.name AS department_name, d.code AS department_code,
                ay.name AS academic_year_name
         FROM classes c
         JOIN departments d    ON d.id  = c.department_id
         JOIN academic_years ay ON ay.id = c.academic_year_id
         WHERE c.id = $1 AND c.active = TRUE`,
        [requestedClassId]
    );
    const classRecord = classResult.rows[0];
    if (!classRecord) {
        throw new AppError('Class not found or inactive', 'NOT_FOUND', 404);
    }

    const { role } = req.user;

    if (role === 'class_advisor') {
        const check = await pool.query(
            `SELECT 1 FROM class_advisor_history
             WHERE class_id = $1 AND user_id = $2 AND unassigned_at IS NULL`,
            [requestedClassId, req.user.user_id]
        );
        if (!check.rows[0]) {
            throw new AppError('You are not the active advisor for this class', 'FORBIDDEN', 403);
        }
    }

    if (role === 'class_representative') {
        if (!req.user.class_id) {
            throw new AppError('Class Representative is not assigned to a class', 'FORBIDDEN', 403);
        }
        if (String(req.user.class_id) !== String(requestedClassId)) {
            throw new AppError('You can only create ODs for your own class', 'FORBIDDEN', 403);
        }
    }

    return classRecord;
}

/**
 * Validate and resolve participant student IDs.
 * Returns the fully-loaded student rows.
 * Throws AppError for any validation failure.
 */
async function resolveParticipants(studentIds, classId) {
    if (!Array.isArray(studentIds) || studentIds.length === 0) {
        throw new AppError('At least one participant student_id is required', 'VALIDATION_ERROR', 400);
    }

    // Deduplicate — normalise to Number for the Set, then back to string for Map key consistency
    const asNumbers = studentIds.map(Number).filter((n) => !Number.isNaN(n) && n > 0);
    if (asNumbers.length !== studentIds.length) {
        throw new AppError('Invalid student_id value in list', 'VALIDATION_ERROR', 400);
    }
    const unique = [...new Set(asNumbers)];
    if (unique.length !== studentIds.length) {
        throw new AppError('Duplicate participant student IDs are not allowed', 'VALIDATION_ERROR', 400);
    }

    // Fetch all at once
    const result = await pool.query(
        'SELECT student_id, register_number, name, status, class_id FROM students WHERE student_id = ANY($1::bigint[])',
        [unique]
    );

    // pg returns bigint columns as strings — normalise to Number to match unique[] type
    const found = new Map(result.rows.map((s) => [Number(s.student_id), s]));

    for (const id of unique) {
        const s = found.get(id);
        if (!s) {
            throw new AppError(`Student ${id} not found`, 'NOT_FOUND', 404);
        }
        if (s.status !== 'ACTIVE') {
            throw new AppError(
                `Student ${s.register_number} (${s.name}) is not active`,
                'VALIDATION_ERROR', 400
            );
        }
        if (String(s.class_id) !== String(classId)) {
            throw new AppError(
                `Student ${s.register_number} does not belong to the selected class`,
                'VALIDATION_ERROR', 400
            );
        }
    }

    return unique; // validated, deduped list
}

/**
 * Validate date fields: format, logical ordering.
 */
function validateDates(eventDate, odStartDate, odEndDate) {
    const dateRe = /^\d{4}-\d{2}-\d{2}$/;
    for (const [name, val] of [['event_date', eventDate], ['od_start_date', odStartDate], ['od_end_date', odEndDate]]) {
        if (!val || !dateRe.test(val) || Number.isNaN(Date.parse(val))) {
            throw new AppError(`${name} must be a valid YYYY-MM-DD date`, 'VALIDATION_ERROR', 400);
        }
    }
    if (new Date(odEndDate) < new Date(odStartDate)) {
        throw new AppError('od_end_date must be >= od_start_date', 'VALIDATION_ERROR', 400);
    }
}

/**
 * Build the role-based scope for OD listing.
 */
async function buildScope(req) {
    const { role } = req.user;
    if (role === 'student') {
        return { type: 'student', studentId: req.user.student_id };
    }
    if (role === 'class_representative') {
        if (!req.user.class_id) throw new AppError('No class assigned to this representative', 'FORBIDDEN', 403);
        return { type: 'class', classId: req.user.class_id };
    }
    if (role === 'class_advisor') {
        const r = await pool.query(
            'SELECT class_id FROM class_advisor_history WHERE user_id = $1 AND unassigned_at IS NULL',
            [req.user.user_id]
        );
        if (!r.rows[0]) throw new AppError('No class assigned to this advisor', 'FORBIDDEN', 403);
        return { type: 'class', classId: r.rows[0].class_id };
    }
    // admin / super_admin → global (null scope)
    return null;
}

// ── POST /api/ods ─────────────────────────────────────────────────────────────
router.post('/', verifyToken, async (req, res, next) => {
    if (!OD_CREATOR_ROLES.includes(req.user.role)) {
        return next(new AppError('Insufficient permissions to create an OD', 'FORBIDDEN', 403));
    }

    const client = await pool.connect();
    try {
        const {
            class_id,
            event_name,
            event_type,
            event_date,
            od_start_date,
            od_end_date,
            purpose,
            venue,
            student_ids,
        } = req.body || {};

        // Required field check
        const missing = ['event_name', 'event_type', 'event_date', 'od_start_date', 'od_end_date', 'purpose', 'venue']
            .filter((f) => !req.body?.[f]);
        if (missing.length) {
            throw new AppError(`Missing required fields: ${missing.join(', ')}`, 'VALIDATION_ERROR', 400);
        }

        // Date validation
        validateDates(event_date, od_start_date, od_end_date);

        // Auth + class resolution
        const classRecord = await resolveAndAuthoriseClass(req, class_id);

        // Participant validation
        const validatedStudentIds = await resolveParticipants(student_ids, classRecord.id);

        await client.query('BEGIN');

        const od = await OD.create(
            {
                department_id:    classRecord.department_id,
                academic_year_id: classRecord.academic_year_id,
                class_id:         classRecord.id,
                event_name,
                event_type,
                event_date,
                od_start_date,
                od_end_date,
                purpose,
                venue,
            },
            validatedStudentIds,
            req.user.user_id,
            client
        );

        await client.query('COMMIT');

        // Return full OD with participants
        const full = await OD.getById(od.id);
        return res.status(201).json(full);
    } catch (err) {
        await client.query('ROLLBACK');
        return next(err);
    } finally {
        client.release();
    }
});

// ── GET /api/ods ──────────────────────────────────────────────────────────────
router.get('/', verifyToken, async (req, res, next) => {
    try {
        // All authenticated roles can list ODs (with scoped access)
        const allowedRoles = ['super_admin', 'admin', 'class_advisor', 'class_representative', 'student'];
        if (!allowedRoles.includes(req.user.role)) {
            throw new AppError('Insufficient permissions', 'FORBIDDEN', 403);
        }

        const scope = await buildScope(req);

        const limit  = Math.min(parseInt(req.query.limit  || 25, 10), 100);
        const offset = parseInt(req.query.offset || 0, 10);

        const filters = {};
        // Global managers can filter freely; scoped users cannot override their scope
        if (['super_admin', 'admin'].includes(req.user.role)) {
            if (req.query.class_id)        filters.class_id        = req.query.class_id;
            if (req.query.department_id)   filters.department_id   = req.query.department_id;
            if (req.query.academic_year_id) filters.academic_year_id = req.query.academic_year_id;
        }
        if (req.query.status)     filters.status     = req.query.status;
        if (req.query.event_type) filters.event_type = req.query.event_type;
        if (req.query.from_date)  filters.from_date  = req.query.from_date;
        if (req.query.to_date)    filters.to_date    = req.query.to_date;

        const result = await OD.getAll(filters, limit, offset, scope);

        return res.json({
            data: result.rows,
            pagination: { total: result.total, limit: result.limit, offset: result.offset },
        });
    } catch (err) {
        return next(err);
    }
});

// ── GET /api/ods/:id ──────────────────────────────────────────────────────────
router.get('/:id(\\d+)', verifyToken, async (req, res, next) => {
    try {
        const allowedRoles = ['super_admin', 'admin', 'class_advisor', 'class_representative', 'student'];
        if (!allowedRoles.includes(req.user.role)) {
            throw new AppError('Insufficient permissions', 'FORBIDDEN', 403);
        }

        const od = await OD.getById(req.params.id);
        if (!od) throw new AppError('OD not found', 'NOT_FOUND', 404);

        const { role } = req.user;

        // Student: must be a participant
        if (role === 'student') {
            const isParticipant = (od.participants || []).some(
                (p) => String(p.student_id) === String(req.user.student_id)
            );
            if (!isParticipant) {
                throw new AppError('You do not have access to this OD', 'FORBIDDEN', 403);
            }
        }

        // Class Representative: must belong to their class
        if (role === 'class_representative') {
            if (!req.user.class_id || String(od.class_id) !== String(req.user.class_id)) {
                throw new AppError('You do not have access to this OD', 'FORBIDDEN', 403);
            }
        }

        // Class Advisor: must be active advisor for that class
        if (role === 'class_advisor') {
            const check = await pool.query(
                'SELECT 1 FROM class_advisor_history WHERE class_id = $1 AND user_id = $2 AND unassigned_at IS NULL',
                [od.class_id, req.user.user_id]
            );
            if (!check.rows[0]) {
                throw new AppError('You do not have access to this OD', 'FORBIDDEN', 403);
            }
        }

        return res.json(od);
    } catch (err) {
        return next(err);
    }
});

export default router;
