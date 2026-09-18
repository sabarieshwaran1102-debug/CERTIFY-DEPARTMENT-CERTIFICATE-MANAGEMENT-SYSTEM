import express from 'express';
import { verifyToken } from '../middleware/auth.js';
import { requireGlobalManagement, requireManagementRole } from '../middleware/authorization.js';
import pool from '../config/database.js';
import Department from '../models/Department.js';
import AcademicYear from '../models/AcademicYear.js';
import ClassModel from '../models/Class.js';
import AuditEvent from '../models/AuditEvent.js';
import { AppError } from '../middleware/errorHandler.js';

const router = express.Router();
const management = [verifyToken, requireManagementRole('super_admin', 'admin')];

const requireFields = (body, fields) => {
    const missing = fields.filter((field) => body?.[field] === undefined || body[field] === null || body[field] === '');
    if (missing.length) throw new AppError(`Missing required fields: ${missing.join(', ')}`, 'VALIDATION_ERROR', 400);
};

router.get('/departments', verifyToken, requireManagementRole('super_admin', 'admin', 'coordinating_faculty', 'class_advisor'), async (req, res, next) => {
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

router.get('/academic-years', verifyToken, requireManagementRole('super_admin', 'admin', 'coordinating_faculty', 'class_advisor'), async (req, res, next) => {
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
            `UPDATE academic_years SET name = COALESCE($1, name), start_date = COALESCE($2, start_date),
             end_date = COALESCE($3, end_date), active = COALESCE($4, active), updated_at = NOW()
             WHERE id = $5 RETURNING *`,
            [req.body.name, req.body.start_date, req.body.end_date, req.body.active, req.params.id]
        );
        if (!result.rows[0]) throw new AppError('Academic year not found', 'NOT_FOUND', 404);
        await AuditEvent.record({ actorUserId: req.user.user_id, action: 'academic_year_updated', targetEntity: 'academic_year', targetId: req.params.id, newData: result.rows[0] });
        res.json(result.rows[0]);
    } catch (err) { next(err); }
});

router.get('/classes', verifyToken, requireManagementRole('super_admin', 'admin', 'coordinating_faculty', 'class_advisor'), async (req, res, next) => {
    try {
        const classes = await ClassModel.getAll(req.query);
        if (['class_advisor', 'coordinating_faculty'].includes(req.user.role)) {
            const result = await pool.query(
                `SELECT c.* FROM classes c JOIN class_advisor_history h ON h.class_id = c.id
                 WHERE h.user_id = $1 AND h.unassigned_at IS NULL`, [req.user.user_id]
            );
            const allowed = new Set(result.rows.map((row) => String(row.id)));
            return res.json({ data: classes.filter((item) => allowed.has(String(item.id))) });
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
        const updates = fields.filter((field) => req.body[field] !== undefined);
        if (!updates.length) throw new AppError('No class fields supplied', 'VALIDATION_ERROR', 400);
        const values = updates.map((field) => req.body[field]);
        const assignments = updates.map((field, index) => `${field} = $${index + 1}`);
        values.push(req.params.id);
        const result = await pool.query(`UPDATE classes SET ${assignments.join(', ')}, updated_at = NOW() WHERE id = $${values.length} RETURNING *`, values);
        if (!result.rows[0]) throw new AppError('Class not found', 'NOT_FOUND', 404);
        await AuditEvent.record({ actorUserId: req.user.user_id, action: 'class_updated', targetEntity: 'class', targetId: req.params.id, newData: result.rows[0] });
        res.json(result.rows[0]);
    } catch (err) { next(err); }
});

router.get('/classes/:id', verifyToken, requireManagementRole('super_admin', 'admin', 'coordinating_faculty', 'class_advisor'), async (req, res, next) => {
    try {
        const classRecord = await ClassModel.getById(req.params.id);
        if (!classRecord) throw new AppError('Class not found', 'NOT_FOUND', 404);
        const [students, advisor, representatives] = await Promise.all([
            pool.query('SELECT * FROM students WHERE class_id = $1 ORDER BY register_number', [req.params.id]),
            pool.query(`SELECT h.*, u.username FROM class_advisor_history h JOIN users u ON u.user_id = h.user_id WHERE h.class_id = $1 AND h.unassigned_at IS NULL`, [req.params.id]),
            pool.query(`SELECT cr.*, s.register_number, s.name FROM class_representatives cr JOIN students s ON s.student_id = cr.student_id WHERE cr.class_id = $1 ORDER BY s.register_number`, [req.params.id]),
        ]);
        res.json({ ...classRecord, students: students.rows, advisor: advisor.rows[0] || null, representatives: representatives.rows });
    } catch (err) { next(err); }
});

router.get('/classes/:id/advisor', verifyToken, requireGlobalManagement, async (req, res, next) => {
    try {
        const result = await pool.query(`SELECT h.*, u.username, u.role FROM class_advisor_history h JOIN users u ON u.user_id = h.user_id WHERE h.class_id = $1 ORDER BY h.assigned_at DESC`, [req.params.id]);
        res.json({ data: result.rows });
    } catch (err) { next(err); }
});

router.post('/classes/:id/advisor', ...management, async (req, res, next) => {
    const client = await pool.connect();
    try {
        requireFields(req.body, ['user_id']);
        await client.query('BEGIN');
        const user = await client.query(`SELECT user_id, username, role FROM users WHERE user_id = $1 AND role IN ('coordinating_faculty', 'class_advisor') AND is_active = TRUE`, [req.body.user_id]);
        if (!user.rows[0]) throw new AppError('Active faculty/advisor account not found', 'NOT_FOUND', 404);
        await client.query(`UPDATE class_advisor_history SET unassigned_at = NOW() WHERE class_id = $1 AND unassigned_at IS NULL`, [req.params.id]);
        const assignment = await client.query(`INSERT INTO class_advisor_history (class_id, user_id, changed_by, reason) VALUES ($1, $2, $3, $4) RETURNING *`, [req.params.id, req.body.user_id, req.user.user_id, req.body.reason || null]);
        await AuditEvent.record({ actorUserId: req.user.user_id, action: 'advisor_assigned', targetEntity: 'class', targetId: req.params.id, newData: assignment.rows[0], client });
        await client.query('COMMIT');
        res.status(201).json(assignment.rows[0]);
    } catch (err) { await client.query('ROLLBACK'); next(err); } finally { client.release(); }
});

router.get('/classes/:id/representatives', verifyToken, requireManagementRole('super_admin', 'admin', 'coordinating_faculty', 'class_advisor'), async (req, res, next) => {
    try {
        const result = await pool.query(`SELECT cr.*, s.register_number, s.name FROM class_representatives cr JOIN students s ON s.student_id = cr.student_id WHERE cr.class_id = $1 ORDER BY s.register_number`, [req.params.id]);
        res.json({ data: result.rows });
    } catch (err) { next(err); }
});

router.post('/classes/:id/representatives', ...management, async (req, res, next) => {
    try {
        requireFields(req.body, ['student_id']);
        const result = await pool.query(
            `INSERT INTO class_representatives (class_id, student_id, assigned_by)
             SELECT $1, s.student_id, $3 FROM students s WHERE s.student_id = $2 AND s.class_id = $1 AND s.status = 'ACTIVE'
             RETURNING *`,
            [req.params.id, req.body.student_id, req.user.user_id]
        );
        if (!result.rows[0]) throw new AppError('Only an active student from this class can be a representative', 'VALIDATION_ERROR', 400);
        await AuditEvent.record({ actorUserId: req.user.user_id, action: 'representative_assigned', targetEntity: 'class', targetId: req.params.id, newData: result.rows[0] });
        res.status(201).json(result.rows[0]);
    } catch (err) { next(err); }
});

router.delete('/classes/:id/representatives/:studentId', ...management, async (req, res, next) => {
    try {
        const result = await pool.query('DELETE FROM class_representatives WHERE class_id = $1 AND student_id = $2 RETURNING *', [req.params.id, req.params.studentId]);
        if (!result.rows[0]) throw new AppError('Representative assignment not found', 'NOT_FOUND', 404);
        await AuditEvent.record({ actorUserId: req.user.user_id, action: 'representative_removed', targetEntity: 'class', targetId: req.params.id, oldData: result.rows[0] });
        res.json({ message: 'Representative removed' });
    } catch (err) { next(err); }
});

router.get('/audit/:targetEntity/:targetId', verifyToken, requireGlobalManagement, async (req, res, next) => {
    try { res.json({ data: await AuditEvent.getForTarget(req.params.targetEntity, req.params.targetId) }); } catch (err) { next(err); }
});

export default router;