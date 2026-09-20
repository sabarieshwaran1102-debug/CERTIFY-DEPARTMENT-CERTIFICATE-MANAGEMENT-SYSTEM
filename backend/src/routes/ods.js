import express from 'express';
import { verifyToken } from '../middleware/auth.js';
import OD from '../models/OD.js';
import pool from '../config/database.js';
import { AppError } from '../middleware/errorHandler.js';

const router = express.Router();

// ── role constants ────────────────────────────────────────────────────────────
const OD_CREATOR_ROLES   = ['super_admin', 'admin', 'class_advisor', 'class_representative'];
const OD_CANCEL_ROLES    = ['super_admin', 'admin', 'class_advisor', 'coordinating_faculty'];
const OD_READER_ROLES    = ['super_admin', 'admin', 'class_advisor', 'class_representative', 'student'];

// ── helpers ───────────────────────────────────────────────────────────────────

/**
 * Look up the active class the caller is authorised to act upon.
 * Returns the class record from the DB.
 * Throws AppError if the class doesn't exist, is inactive, or
 * the caller doesn't have the required class-level access.
 *
 * For super_admin / admin: trusts the supplied classId.
 * For class_advisor:       must be the active advisor for that class (DB-checked).
 * For class_representative: must be assigned to exactly that class (req.user.class_id).
 */
async function resolveAndAuthoriseClass(req, requestedClassId) {
    if (!requestedClassId) throw new AppError('class_id is required', 'VALIDATION_ERROR', 400);

    const classResult = await pool.query(
        `SELECT c.*, d.name AS department_name, d.code AS department_code,
                ay.name AS academic_year_name
         FROM classes c
         JOIN departments   d  ON d.id  = c.department_id
         JOIN academic_years ay ON ay.id = c.academic_year_id
         WHERE c.id = $1 AND c.active = TRUE`,
        [requestedClassId]
    );
    const classRecord = classResult.rows[0];
    if (!classRecord) throw new AppError('Class not found or inactive', 'NOT_FOUND', 404);

    const { role } = req.user;

    if (role === 'class_advisor') {
        const check = await pool.query(
            'SELECT 1 FROM class_advisor_history WHERE class_id = $1 AND user_id = $2 AND unassigned_at IS NULL',
            [requestedClassId, req.user.user_id]
        );
        if (!check.rows[0])
            throw new AppError('You are not the active advisor for this class', 'FORBIDDEN', 403);
    }

    if (role === 'class_representative') {
        if (!req.user.class_id)
            throw new AppError('Class Representative is not assigned to a class', 'FORBIDDEN', 403);
        if (String(req.user.class_id) !== String(requestedClassId))
            throw new AppError('You can only create ODs for your own class', 'FORBIDDEN', 403);
    }

    return classRecord;
}

/**
 * Validate, deduplicate, and verify each participant student ID.
 * All students must be ACTIVE and belong to classId.
 * Returns a clean array of Numbers.
 */
async function resolveParticipants(studentIds, classId) {
    if (!Array.isArray(studentIds) || studentIds.length === 0)
        throw new AppError('At least one participant student_id is required', 'VALIDATION_ERROR', 400);

    const asNumbers = studentIds.map(Number).filter((n) => !Number.isNaN(n) && n > 0);
    if (asNumbers.length !== studentIds.length)
        throw new AppError('Invalid student_id value in list', 'VALIDATION_ERROR', 400);

    const unique = [...new Set(asNumbers)];
    if (unique.length !== studentIds.length)
        throw new AppError('Duplicate participant student IDs are not allowed', 'VALIDATION_ERROR', 400);

    const result = await pool.query(
        'SELECT student_id, register_number, name, status, class_id FROM students WHERE student_id = ANY($1::bigint[])',
        [unique]
    );

    const found = new Map(result.rows.map((s) => [Number(s.student_id), s]));

    for (const id of unique) {
        const s = found.get(id);
        if (!s) throw new AppError(`Student ${id} not found`, 'NOT_FOUND', 404);
        if (s.status !== 'ACTIVE')
            throw new AppError(`Student ${s.register_number} (${s.name}) is not active`, 'VALIDATION_ERROR', 400);
        if (String(s.class_id) !== String(classId))
            throw new AppError(`Student ${s.register_number} does not belong to the selected class`, 'VALIDATION_ERROR', 400);
    }

    return unique;
}

/** Basic date validation: YYYY-MM-DD format and logical ordering. */
function validateDates(eventDate, odStartDate, odEndDate) {
    const dateRe = /^\d{4}-\d{2}-\d{2}$/;
    for (const [name, val] of [['event_date', eventDate], ['od_start_date', odStartDate], ['od_end_date', odEndDate]]) {
        if (!val || !dateRe.test(val) || Number.isNaN(Date.parse(val)))
            throw new AppError(`${name} must be a valid YYYY-MM-DD date`, 'VALIDATION_ERROR', 400);
    }
    if (new Date(odEndDate) < new Date(odStartDate))
        throw new AppError('od_end_date must be >= od_start_date', 'VALIDATION_ERROR', 400);
}

/**
 * Build the authoritative read scope for the requesting user.
 * Scoped users (class_advisor, class_representative, student) cannot
 * supply query params that escape their scope — the scope is derived
 * entirely from verified DB state or the JWT payload.
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
    // admin / super_admin — global access, no scope restriction
    return null;
}

// ── POST /api/ods ─────────────────────────────────────────────────────────────
router.post('/', verifyToken, async (req, res, next) => {
    if (!OD_CREATOR_ROLES.includes(req.user.role))
        return next(new AppError('Insufficient permissions to create an OD', 'FORBIDDEN', 403));

    const client = await pool.connect();
    try {
        const { class_id, event_name, event_type, event_date, od_start_date,
                od_end_date, purpose, venue, student_ids } = req.body || {};

        const missing = ['event_name','event_type','event_date','od_start_date','od_end_date','purpose','venue']
            .filter((f) => !req.body?.[f]);
        if (missing.length)
            throw new AppError(`Missing required fields: ${missing.join(', ')}`, 'VALIDATION_ERROR', 400);

        validateDates(event_date, od_start_date, od_end_date);

        const classRecord        = await resolveAndAuthoriseClass(req, class_id);
        const validatedStudentIds = await resolveParticipants(student_ids, classRecord.id);

        await client.query('BEGIN');

        const od = await OD.create(
            {
                department_id:    classRecord.department_id,
                academic_year_id: classRecord.academic_year_id,
                class_id:         classRecord.id,
                event_name, event_type, event_date, od_start_date, od_end_date, purpose, venue,
            },
            validatedStudentIds,
            req.user.user_id,
            client
        );

        await client.query('COMMIT');

        const full = await OD.getById(od.id);
        return res.status(201).json(full);
    } catch (err) {
        await client.query('ROLLBACK');
        return next(err);
    } finally {
        client.release();
    }
});

// ── POST /api/ods/:id/cancel ──────────────────────────────────────────────────
router.post('/:id(\\d+)/cancel', verifyToken, async (req, res, next) => {
    if (!OD_CANCEL_ROLES.includes(req.user.role))
        return next(new AppError('Insufficient permissions to cancel an OD', 'FORBIDDEN', 403));

    const client = await pool.connect();
    try {
        // Fetch OD first (outside transaction — just to validate)
        const od = await OD.getById(req.params.id);
        if (!od) throw new AppError('OD not found', 'NOT_FOUND', 404);

        if (od.status === 'cancelled')
            throw new AppError('OD is already cancelled', 'CONFLICT', 409);

        // Class-level authorisation for class_advisor
        if (req.user.role === 'class_advisor') {
            const check = await pool.query(
                'SELECT 1 FROM class_advisor_history WHERE class_id = $1 AND user_id = $2 AND unassigned_at IS NULL',
                [od.class_id, req.user.user_id]
            );
            if (!check.rows[0])
                throw new AppError('You are not the active advisor for this class', 'FORBIDDEN', 403);
        }

        // Validate reason
        const reason = (req.body?.reason || '').trim();
        if (!reason)
            throw new AppError('cancellation_reason is required', 'VALIDATION_ERROR', 400);

        await client.query('BEGIN');

        await OD.cancel(od.id, reason, req.user.user_id, client);

        await client.query('COMMIT');

        // Return full updated OD
        const updated = await OD.getById(od.id);
        return res.json(updated);
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
        if (!OD_READER_ROLES.includes(req.user.role))
            throw new AppError('Insufficient permissions', 'FORBIDDEN', 403);

        const scope  = await buildScope(req);
        const limit  = Math.min(parseInt(req.query.limit  || 25, 10), 100);
        const offset = parseInt(req.query.offset || 0, 10);

        const filters = {};
        const isGlobal = ['super_admin', 'admin'].includes(req.user.role);

        // Org-level filters: only permitted for global roles — scoped users
        // already have their scope set and cannot override it via query params.
        if (isGlobal) {
            if (req.query.class_id)         filters.class_id         = req.query.class_id;
            if (req.query.department_id)    filters.department_id    = req.query.department_id;
            if (req.query.academic_year_id) filters.academic_year_id = req.query.academic_year_id;
        }

        // Filters available to all roles (they operate within the scope)
        if (req.query.od_number)        filters.od_number        = req.query.od_number;
        if (req.query.event_name)       filters.event_name       = req.query.event_name;
        if (req.query.event_type)       filters.event_type       = req.query.event_type;
        if (req.query.status)           filters.status           = req.query.status;
        if (req.query.event_date)       filters.event_date       = req.query.event_date;
        if (req.query.event_date_from)  filters.event_date_from  = req.query.event_date_from;
        if (req.query.event_date_to)    filters.event_date_to    = req.query.event_date_to;
        if (req.query.from_date)        filters.from_date        = req.query.from_date;
        if (req.query.to_date)          filters.to_date          = req.query.to_date;
        if (req.query.student_register) filters.student_register = req.query.student_register;
        if (req.query.student_name)     filters.student_name     = req.query.student_name;

        const result = await OD.getAll(filters, limit, offset, scope);

        return res.json({
            data:       result.rows,
            pagination: { total: result.total, limit: result.limit, offset: result.offset },
        });
    } catch (err) {
        return next(err);
    }
});

// ── GET /api/ods/:id ──────────────────────────────────────────────────────────
router.get('/:id(\\d+)', verifyToken, async (req, res, next) => {
    try {
        if (!OD_READER_ROLES.includes(req.user.role))
            throw new AppError('Insufficient permissions', 'FORBIDDEN', 403);

        const od = await OD.getById(req.params.id);
        if (!od) throw new AppError('OD not found', 'NOT_FOUND', 404);

        const { role } = req.user;

        if (role === 'student') {
            const isParticipant = (od.participants || []).some(
                (p) => String(p.student_id) === String(req.user.student_id)
            );
            if (!isParticipant)
                throw new AppError('You do not have access to this OD', 'FORBIDDEN', 403);
        }

        if (role === 'class_representative') {
            if (!req.user.class_id || String(od.class_id) !== String(req.user.class_id))
                throw new AppError('You do not have access to this OD', 'FORBIDDEN', 403);
        }

        if (role === 'class_advisor') {
            const check = await pool.query(
                'SELECT 1 FROM class_advisor_history WHERE class_id = $1 AND user_id = $2 AND unassigned_at IS NULL',
                [od.class_id, req.user.user_id]
            );
            if (!check.rows[0])
                throw new AppError('You do not have access to this OD', 'FORBIDDEN', 403);
        }

        return res.json(od);
    } catch (err) {
        return next(err);
    }
});

export default router;
