import express from 'express';
import { verifyToken } from '../middleware/auth.js';
import { requireGlobalManagement, requireManagementRole } from '../middleware/authorization.js';
import pool from '../config/database.js';
import Department from '../models/Department.js';
import AcademicYear from '../models/AcademicYear.js';
import ClassModel from '../models/Class.js';
import AuditEvent from '../models/AuditEvent.js';
import { AppError } from '../middleware/errorHandler.js';
import StudentAcademicHistory from '../models/StudentAcademicHistory.js';

const router = express.Router();
const management = [verifyToken, requireManagementRole('super_admin', 'admin')];
const broadManagement = [verifyToken, requireManagementRole('super_admin', 'admin', 'coordinating_faculty', 'class_advisor')];

const requireFields = (body, fields) => {
    const missing = fields.filter((f) => body?.[f] === undefined || body[f] === null || body[f] === '');
    if (missing.length) throw new AppError(`Missing required fields: ${missing.join(', ')}`, 'VALIDATION_ERROR', 400);
};

// ── Departments ───────────────────────────────────────────────────────────────

router.get('/departments', ...broadManagement, async (req, res, next) => {
    try { res.json({ data: await Department.getAll(req.query.active_only === 'true') }); } catch (err) { next(err); }
});

router.post('/departments', ...management, async (req, res, next) => {
    try {
        requireFields(req.body, ['name', 'code']);
        const department = await Department.create({ name: req.body.name.trim(), code: req.body.code.trim().toUpperCase() });
        await AuditEvent.record({ actorUserId: req.user.user_id, action: 'department_created', targetEntity: 'department', targetId: department.id, newData: department });
        res.status(201).json(department);
    } catch (err) { next(err); }
});

router.patch('/departments/:id', ...management, async (req, res, next) => {
    try {
        const existing = await Department.getById(req.params.id);
        if (!existing) throw new AppError('Department not found', 'NOT_FOUND', 404);
        const updates = { ...req.body };
        if (updates.code) updates.code = updates.code.trim().toUpperCase();
        const department = await Department.update(req.params.id, updates);
        await AuditEvent.record({ actorUserId: req.user.user_id, action: 'department_updated', targetEntity: 'department', targetId: req.params.id, oldData: existing, newData: department });
        res.json(department);
    } catch (err) { next(err); }
});

// ── Academic Years ─────────────────────────────────────────────────────────────

router.get('/academic-years', ...broadManagement, async (req, res, next) => {
    try { res.json({ data: await AcademicYear.getAll(req.query.active_only === 'true') }); } catch (err) { next(err); }
});

router.post('/academic-years', ...management, async (req, res, next) => {
    try {
        requireFields(req.body, ['name']);
        const academicYear = await AcademicYear.create(req.body);
        await AuditEvent.record({ actorUserId: req.user.user_id, action: 'academic_year_created', targetEntity: 'academic_year', targetId: academicYear.id, newData: academicYear });
        res.status(201).json(academicYear);
    } catch (err) { next(err); }
});

router.patch('/academic-years/:id', ...management, async (req, res, next) => {
    try {
        const result = await pool.query(
            `UPDATE academic_years
             SET name = COALESCE($1, name), start_date = COALESCE($2, start_date),
                 end_date = COALESCE($3, end_date), active = COALESCE($4, active), updated_at = NOW()
             WHERE id = $5 RETURNING *`,
            [req.body.name, req.body.start_date, req.body.end_date, req.body.active, req.params.id]
        );
        if (!result.rows[0]) throw new AppError('Academic year not found', 'NOT_FOUND', 404);
        await AuditEvent.record({ actorUserId: req.user.user_id, action: 'academic_year_updated', targetEntity: 'academic_year', targetId: req.params.id, newData: result.rows[0] });
        res.json(result.rows[0]);
    } catch (err) { next(err); }
});

// ── Classes ────────────────────────────────────────────────────────────────────

router.get('/classes', ...broadManagement, async (req, res, next) => {
    try {
        // Admin/super_admin: respect active_only param; default active_only=true for management UIs
        const activeOnly = req.query.active_only !== 'false';
        const filters = { ...req.query };
        if (activeOnly && !['super_admin', 'admin'].includes(req.user.role)) {
            filters.active_only = 'true';
        }
        const classes = await ClassModel.getAll(filters);
        if (['class_advisor', 'coordinating_faculty'].includes(req.user.role)) {
            const result = await pool.query(
                `SELECT c.id FROM classes c
                 JOIN class_advisor_history h ON h.class_id = c.id
                 WHERE h.user_id = $1 AND h.unassigned_at IS NULL`,
                [req.user.user_id]
            );
            const allowed = new Set(result.rows.map((r) => String(r.id)));
            return res.json({ data: classes.filter((c) => allowed.has(String(c.id))) });
        }
        return res.json({ data: classes });
    } catch (err) { next(err); }
});

router.post('/classes', ...management, async (req, res, next) => {
    try {
        requireFields(req.body, ['department_id', 'academic_year_id', 'year_of_study', 'section', 'display_name']);
        const classRecord = await ClassModel.create(req.body);
        await AuditEvent.record({ actorUserId: req.user.user_id, action: 'class_created', targetEntity: 'class', targetId: classRecord.id, newData: classRecord });
        res.status(201).json(classRecord);
    } catch (err) { next(err); }
});

router.patch('/classes/:id', ...management, async (req, res, next) => {
    try {
        const fields = ['department_id', 'academic_year_id', 'year_of_study', 'section', 'display_name', 'active'];
        const updates = fields.filter((f) => req.body[f] !== undefined);
        if (!updates.length) throw new AppError('No class fields supplied', 'VALIDATION_ERROR', 400);
        const values = updates.map((f) => req.body[f]);
        const assignments = updates.map((f, i) => `${f} = $${i + 1}`);
        values.push(req.params.id);
        const result = await pool.query(
            `UPDATE classes SET ${assignments.join(', ')}, updated_at = NOW() WHERE id = $${values.length} RETURNING *`,
            values
        );
        if (!result.rows[0]) throw new AppError('Class not found', 'NOT_FOUND', 404);
        await AuditEvent.record({ actorUserId: req.user.user_id, action: 'class_updated', targetEntity: 'class', targetId: req.params.id, newData: result.rows[0] });
        res.json(result.rows[0]);
    } catch (err) { next(err); }
});

router.get('/classes/:id', ...broadManagement, async (req, res, next) => {
    try {
        const classRecord = await ClassModel.getById(req.params.id);
        if (!classRecord) throw new AppError('Class not found', 'NOT_FOUND', 404);
        const [students, advisor, representatives] = await Promise.all([
            pool.query('SELECT student_id, register_number, name, status FROM students WHERE class_id = $1 ORDER BY register_number', [req.params.id]),
            pool.query(`SELECT h.*, u.username FROM class_advisor_history h JOIN users u ON u.user_id = h.user_id WHERE h.class_id = $1 AND h.unassigned_at IS NULL`, [req.params.id]),
            pool.query(`SELECT cr.*, s.register_number, s.name FROM class_representatives cr JOIN students s ON s.student_id = cr.student_id WHERE cr.class_id = $1 ORDER BY s.register_number`, [req.params.id]),
        ]);
        res.json({ ...classRecord, students: students.rows, advisor: advisor.rows[0] || null, representatives: representatives.rows });
    } catch (err) { next(err); }
});

// ── Class Advisor Management ──────────────────────────────────────────────────

// Get advisor history (super_admin + admin)
router.get('/classes/:id/advisor', verifyToken, requireGlobalManagement, async (req, res, next) => {
    try {
        const result = await pool.query(
            `SELECT h.*, u.username, u.role
             FROM class_advisor_history h JOIN users u ON u.user_id = h.user_id
             WHERE h.class_id = $1 ORDER BY h.assigned_at DESC`,
            [req.params.id]
        );
        res.json({ data: result.rows });
    } catch (err) { next(err); }
});

// Assign / replace advisor (super_admin + admin)
router.post('/classes/:id/advisor', ...management, async (req, res, next) => {
    const client = await pool.connect();
    try {
        requireFields(req.body, ['user_id']);
        await client.query('BEGIN');
        const user = (await client.query(
            `SELECT user_id, username, role FROM users
             WHERE user_id = $1 AND role IN ('coordinating_faculty', 'class_advisor') AND is_active = TRUE`,
            [req.body.user_id]
        )).rows[0];
        if (!user) throw new AppError('Active faculty/advisor account not found', 'NOT_FOUND', 404);

        // Unassign current advisor if any, and audit it
        const current = (await client.query(
            `UPDATE class_advisor_history SET unassigned_at = NOW()
             WHERE class_id = $1 AND unassigned_at IS NULL RETURNING *`,
            [req.params.id]
        )).rows[0];
        if (current) {
            await AuditEvent.record({
                actorUserId: req.user.user_id, action: 'advisor_unassigned',
                targetEntity: 'class', targetId: req.params.id,
                oldData: current, details: req.body.reason || null, client,
            });
        }

        const assignment = (await client.query(
            `INSERT INTO class_advisor_history (class_id, user_id, changed_by, reason)
             VALUES ($1, $2, $3, $4) RETURNING *`,
            [req.params.id, req.body.user_id, req.user.user_id, req.body.reason || null]
        )).rows[0];
        await AuditEvent.record({
            actorUserId: req.user.user_id, action: 'advisor_assigned',
            targetEntity: 'class', targetId: req.params.id,
            newData: assignment, details: req.body.reason || null, client,
        });
        await client.query('COMMIT');
        res.status(201).json(assignment);
    } catch (err) { await client.query('ROLLBACK'); next(err); } finally { client.release(); }
});

// ── Class Representatives ─────────────────────────────────────────────────────

router.get('/classes/:id/representatives', ...broadManagement, async (req, res, next) => {
    try {
        const result = await pool.query(
            `SELECT cr.*, s.register_number, s.name
             FROM class_representatives cr JOIN students s ON s.student_id = cr.student_id
             WHERE cr.class_id = $1 ORDER BY s.register_number`,
            [req.params.id]
        );
        res.json({ data: result.rows });
    } catch (err) { next(err); }
});

// Assign CR: super_admin, admin, class_advisor (own class)
router.post('/classes/:id/representatives', verifyToken, requireManagementRole('super_admin', 'admin', 'class_advisor'), async (req, res, next) => {
    try {
        requireFields(req.body, ['student_id']);
        // Class advisor: enforce own-class boundary
        if (req.user.role === 'class_advisor') {
            const advisorClass = (await pool.query(
                'SELECT class_id FROM class_advisor_history WHERE user_id = $1 AND unassigned_at IS NULL',
                [req.user.user_id]
            )).rows[0];
            if (!advisorClass || String(advisorClass.class_id) !== String(req.params.id)) {
                throw new AppError('You do not have access to this class', 'FORBIDDEN', 403);
            }
        }
        const result = await pool.query(
            `INSERT INTO class_representatives (class_id, student_id, assigned_by)
             SELECT $1, s.student_id, $3
             FROM students s
             WHERE s.student_id = $2 AND s.class_id = $1 AND s.status = 'ACTIVE'
             RETURNING *`,
            [req.params.id, req.body.student_id, req.user.user_id]
        );
        if (!result.rows[0]) {
            throw new AppError('Only an active student from this class can be a representative', 'VALIDATION_ERROR', 400);
        }
        await AuditEvent.record({ actorUserId: req.user.user_id, action: 'representative_assigned', targetEntity: 'class', targetId: req.params.id, newData: result.rows[0] });
        res.status(201).json(result.rows[0]);
    } catch (err) { next(err); }
});

// Remove CR: super_admin, admin, class_advisor (own class)
router.delete('/classes/:id/representatives/:studentId', verifyToken, requireManagementRole('super_admin', 'admin', 'class_advisor'), async (req, res, next) => {
    try {
        if (req.user.role === 'class_advisor') {
            const advisorClass = (await pool.query(
                'SELECT class_id FROM class_advisor_history WHERE user_id = $1 AND unassigned_at IS NULL',
                [req.user.user_id]
            )).rows[0];
            if (!advisorClass || String(advisorClass.class_id) !== String(req.params.id)) {
                throw new AppError('You do not have access to this class', 'FORBIDDEN', 403);
            }
        }
        const result = await pool.query(
            'DELETE FROM class_representatives WHERE class_id = $1 AND student_id = $2 RETURNING *',
            [req.params.id, req.params.studentId]
        );
        if (!result.rows[0]) throw new AppError('Representative assignment not found', 'NOT_FOUND', 404);
        await AuditEvent.record({ actorUserId: req.user.user_id, action: 'representative_removed', targetEntity: 'class', targetId: req.params.id, oldData: result.rows[0] });
        res.json({ message: 'Representative removed' });
    } catch (err) { next(err); }
});

// ── Class Representative user management ──────────────────────────────────────

// Create a class_representative user account and assign to a class
router.post('/classes/:id/representative-accounts', ...management, async (req, res, next) => {
    try {
        requireFields(req.body, ['student_id']);
        // Verify student is in this class and is a CR
        const crResult = await pool.query(
            `SELECT cr.student_id, s.register_number, s.date_of_birth
             FROM class_representatives cr
             JOIN students s ON s.student_id = cr.student_id
             WHERE cr.class_id = $1 AND cr.student_id = $2`,
            [req.params.id, req.body.student_id]
        );
        if (!crResult.rows[0]) {
            throw new AppError('Student must be assigned as a class representative first', 'VALIDATION_ERROR', 400);
        }
        const { register_number, date_of_birth } = crResult.rows[0];
        // Check if user account already exists for this student with CR role
        const existing = await pool.query(
            `SELECT user_id FROM users WHERE student_id = $1 AND role = 'class_representative'`,
            [req.body.student_id]
        );
        if (existing.rows[0]) {
            return res.json({ message: 'CR account already exists', user_id: existing.rows[0].user_id });
        }
        const dob = date_of_birth instanceof Date
            ? date_of_birth.toISOString().slice(0, 10)
            : String(date_of_birth).slice(0, 10);
        // Create user account (CR logs in with register_number + DOB like students)
        const user = await pool.query(
            `INSERT INTO users (username, role, student_id, password_hash, class_id)
             VALUES ($1, 'class_representative', $2, $3, $4)
             RETURNING user_id, username, role, class_id`,
            [register_number, req.body.student_id, await (async () => { const bcrypt = (await import('bcrypt')).default; return bcrypt.hash(dob, 12); })(), req.params.id]
        );
        res.status(201).json(user.rows[0]);
    } catch (err) { next(err); }
});

// ── Audit endpoint ─────────────────────────────────────────────────────────────

router.get('/audit/:targetEntity/:targetId', verifyToken, requireGlobalManagement, async (req, res, next) => {
    try {
        const result = await pool.query(
            `SELECT ae.*, u.username AS actor_username
             FROM audit_events ae
             LEFT JOIN users u ON u.user_id = ae.actor_user_id
             WHERE ae.target_entity = $1 AND ae.target_id = $2
             ORDER BY ae.created_at DESC, ae.id DESC`,
            [req.params.targetEntity, req.params.targetId]
        );
        res.json({ data: result.rows });
    } catch (err) { next(err); }
});

router.get('/audit', verifyToken, requireGlobalManagement, async (req, res, next) => {
    try {
        const limit = Math.min(parseInt(req.query.limit || 50, 10), 200);
        const offset = parseInt(req.query.offset || 0, 10);
        const result = await pool.query(
            `SELECT ae.*, u.username AS actor_username
             FROM audit_events ae
             LEFT JOIN users u ON u.user_id = ae.actor_user_id
             ORDER BY ae.created_at DESC, ae.id DESC
             LIMIT $1 OFFSET $2`,
            [limit, offset]
        );
        const total = parseInt((await pool.query('SELECT COUNT(*) FROM audit_events')).rows[0].count, 10);
        res.json({ data: result.rows, pagination: { limit, offset, total } });
    } catch (err) { next(err); }
});

// ── Faculty list for advisor assignment ───────────────────────────────────────
router.get('/faculty', verifyToken, requireGlobalManagement, async (req, res, next) => {
    try {
        const result = await pool.query(
            `SELECT u.user_id, u.username, u.role, u.is_active,
                    h.class_id AS assigned_class_id,
                    c.display_name AS assigned_class_name
             FROM users u
             LEFT JOIN class_advisor_history h ON h.user_id = u.user_id AND h.unassigned_at IS NULL
             LEFT JOIN classes c ON c.id = h.class_id
             WHERE u.role IN ('coordinating_faculty', 'class_advisor') AND u.is_active = TRUE
             ORDER BY u.username`
        );
        res.json({ data: result.rows });
    } catch (err) { next(err); }
});

// ── Academic Year Lifecycle ────────────────────────────────────────────────────

// Activate an academic year (super_admin + admin)
router.post('/academic-years/:id/activate', ...management, async (req, res, next) => {
    try {
        const ay = await AcademicYear.getById(req.params.id);
        if (!ay) throw new AppError('Academic year not found', 'NOT_FOUND', 404);
        if (ay.active) throw new AppError('Academic year is already active', 'CONFLICT', 409);
        const updated = await AcademicYear.activate(req.params.id);
        await AuditEvent.record({
            actorUserId: req.user.user_id,
            action: 'academic_year_activated',
            targetEntity: 'academic_year',
            targetId: req.params.id,
            newData: updated,
        });
        res.json(updated);
    } catch (err) { next(err); }
});

// Deactivate an academic year (super_admin + admin)
router.post('/academic-years/:id/deactivate', ...management, async (req, res, next) => {
    try {
        const ay = await AcademicYear.getById(req.params.id);
        if (!ay) throw new AppError('Academic year not found', 'NOT_FOUND', 404);
        if (!ay.active) throw new AppError('Academic year is already inactive', 'CONFLICT', 409);
        const updated = await AcademicYear.deactivate(req.params.id);
        await AuditEvent.record({
            actorUserId: req.user.user_id,
            action: 'academic_year_deactivated',
            targetEntity: 'academic_year',
            targetId: req.params.id,
            oldData: ay,
            newData: updated,
        });
        res.json(updated);
    } catch (err) { next(err); }
});

/**
 * POST /academic-years/:id/promote
 * Bulk-promote students from one academic year's classes to a target academic year.
 *
 * Body:
 *   {
 *     target_academic_year_id: number,   // required — destination academic year
 *     class_mappings: [                   // required — per-class promotion plan
 *       { from_class_id: number, to_class_id: number }
 *     ],
 *     notes: string                       // optional
 *   }
 *
 * Behaviour:
 *   - Validates source and target academic years exist and are distinct.
 *   - Validates each from_class belongs to source year, to_class belongs to target year.
 *   - Updates students' class_id, academic_year_id, department, year, section
 *     to match the destination class.
 *   - Preserves all existing OD records and certificates (historical records are untouched).
 *   - Records a promotion history entry and audit event.
 *   - Wraps everything in a transaction — any error rolls back fully.
 *
 * Permissions: super_admin, admin only.
 */
router.post('/academic-years/:id/promote', ...management, async (req, res, next) => {
    const client = await pool.connect();
    try {
        const sourceAyId = parseInt(req.params.id, 10);
        const { target_academic_year_id, class_mappings, notes } = req.body || {};

        if (!target_academic_year_id) throw new AppError('target_academic_year_id is required', 'VALIDATION_ERROR', 400);
        if (!Array.isArray(class_mappings) || class_mappings.length === 0)
            throw new AppError('class_mappings must be a non-empty array of { from_class_id, to_class_id }', 'VALIDATION_ERROR', 400);
        if (String(sourceAyId) === String(target_academic_year_id))
            throw new AppError('source and target academic years must be different', 'VALIDATION_ERROR', 400);

        // Validate source and target academic years
        const [sourceAy, targetAy] = await Promise.all([
            AcademicYear.getById(sourceAyId),
            AcademicYear.getById(target_academic_year_id),
        ]);
        if (!sourceAy) throw new AppError('Source academic year not found', 'NOT_FOUND', 404);
        if (!targetAy) throw new AppError('Target academic year not found', 'NOT_FOUND', 404);

        // Validate class mappings
        for (const mapping of class_mappings) {
            if (!mapping.from_class_id || !mapping.to_class_id)
                throw new AppError('Each mapping must have from_class_id and to_class_id', 'VALIDATION_ERROR', 400);
        }

        const fromClassIds = class_mappings.map((m) => m.from_class_id);
        const toClassIds   = class_mappings.map((m) => m.to_class_id);

        // Load source classes (must belong to source academic year)
        const srcResult = await pool.query(
            `SELECT c.*, d.name AS department_name
             FROM classes c JOIN departments d ON d.id = c.department_id
             WHERE c.id = ANY($1::bigint[]) AND c.academic_year_id = $2`,
            [fromClassIds, sourceAyId]
        );
        if (srcResult.rows.length !== fromClassIds.length)
            throw new AppError('One or more from_class_id values do not belong to the source academic year', 'VALIDATION_ERROR', 400);
        const srcMap = new Map(srcResult.rows.map((c) => [Number(c.id), c]));

        // Load target classes (must belong to target academic year)
        const tgtResult = await pool.query(
            `SELECT c.*, d.name AS department_name
             FROM classes c JOIN departments d ON d.id = c.department_id
             WHERE c.id = ANY($1::bigint[]) AND c.academic_year_id = $2`,
            [toClassIds, target_academic_year_id]
        );
        if (tgtResult.rows.length !== toClassIds.length)
            throw new AppError('One or more to_class_id values do not belong to the target academic year', 'VALIDATION_ERROR', 400);
        const tgtMap = new Map(tgtResult.rows.map((c) => [Number(c.id), c]));

        await client.query('BEGIN');

        let totalPromoted = 0;
        const classMappingRecord = {};

        for (const mapping of class_mappings) {
            const fromClass = srcMap.get(Number(mapping.from_class_id));
            const toClass   = tgtMap.get(Number(mapping.to_class_id));

            // Update all ACTIVE students in the source class
            const updateResult = await client.query(
                `UPDATE students
                 SET class_id         = $1,
                     academic_year_id = $2,
                     department       = $3,
                     year             = $4,
                     section          = $5,
                     updated_at       = NOW()
                 WHERE class_id = $6 AND status = 'ACTIVE'
                 RETURNING student_id`,
                [toClass.id, toClass.academic_year_id, toClass.department_name,
                 toClass.year_of_study, toClass.section, fromClass.id]
            );

            totalPromoted += updateResult.rows.length;
            classMappingRecord[String(mapping.from_class_id)] = String(mapping.to_class_id);

            // Write academic history: exit old year, enroll in target year
            for (const row of updateResult.rows) {
                await StudentAcademicHistory.exit({
                    studentId:      row.student_id,
                    academicYearId: sourceAyId,
                    exitStatus:     'promoted',
                    notes:          `Promoted to ${toClass.display_name} (${targetAy.name})`,
                }, client);
                await StudentAcademicHistory.enroll({
                    studentId:      row.student_id,
                    academicYearId: target_academic_year_id,
                    classId:        toClass.id,
                    status:         'active',
                    notes:          `Promoted from ${fromClass.display_name} (${sourceAy.name})`,
                }, client);
            }
        }

        // Record promotion history
        const promotionResult = await client.query(
            `INSERT INTO academic_year_promotions
               (from_academic_year_id, to_academic_year_id, promoted_by, student_count, class_mapping, notes)
             VALUES ($1, $2, $3, $4, $5::jsonb, $6)
             RETURNING id`,
            [sourceAyId, target_academic_year_id, req.user.user_id,
             totalPromoted, JSON.stringify(classMappingRecord), notes || null]
        );

        await AuditEvent.record({
            actorUserId: req.user.user_id,
            action: 'academic_year_promotion',
            targetEntity: 'academic_year',
            targetId: String(sourceAyId),
            newData: {
                from_academic_year_id: sourceAyId,
                to_academic_year_id: target_academic_year_id,
                student_count: totalPromoted,
                promotion_id: promotionResult.rows[0].id,
            },
            details: notes || `Promoted ${totalPromoted} students to academic year ${targetAy.name}`,
            client,
        });

        await client.query('COMMIT');

        res.status(200).json({
            promotion_id: promotionResult.rows[0].id,
            from_academic_year: sourceAy.name,
            to_academic_year: targetAy.name,
            students_promoted: totalPromoted,
            class_mappings_applied: class_mappings.length,
        });
    } catch (err) {
        await client.query('ROLLBACK');
        next(err);
    } finally {
        client.release();
    }
});

// ── Promotion history ─────────────────────────────────────────────────────────
router.get('/academic-years/:id/promotions', ...management, async (req, res, next) => {
    try {
        const result = await pool.query(
            `SELECT p.*, u.username AS promoted_by_username,
                    ay1.name AS from_year_name, ay2.name AS to_year_name
             FROM academic_year_promotions p
             JOIN users u ON u.user_id = p.promoted_by
             JOIN academic_years ay1 ON ay1.id = p.from_academic_year_id
             JOIN academic_years ay2 ON ay2.id = p.to_academic_year_id
             WHERE p.from_academic_year_id = $1 OR p.to_academic_year_id = $1
             ORDER BY p.promoted_at DESC`,
            [req.params.id]
        );
        res.json({ data: result.rows });
    } catch (err) { next(err); }
});

// ── Students enrolled in an academic year ────────────────────────────────────
router.get('/academic-years/:id/students', ...management, async (req, res, next) => {
    try {
        const students = await StudentAcademicHistory.getByAcademicYear(req.params.id);
        res.json({ data: students, total: students.length });
    } catch (err) { next(err); }
});

export default router;
