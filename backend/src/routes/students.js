import express from 'express';
import multer from 'multer';
import ExcelJS from 'exceljs';
import bcrypt from 'bcrypt';
import { verifyToken, requireRole } from '../middleware/auth.js';
import { requireManagementRole } from '../middleware/authorization.js';
import Student from '../models/Student.js';
import ODRecord from '../models/ODRecord.js';
import Certificate from '../models/Certificate.js';
import AuditEvent from '../models/AuditEvent.js';
import pool from '../config/database.js';
import { AppError } from '../middleware/errorHandler.js';
import StudentAcademicHistory from '../models/StudentAcademicHistory.js';

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

const GLOBAL_ROLES = ['super_admin', 'admin'];
const MANAGEMENT_ROLES = ['super_admin', 'admin', 'class_advisor'];

const isGlobalManager = (req) => GLOBAL_ROLES.includes(req.user.role);

// ── helpers ──────────────────────────────────────────────────────────────────

const getClass = async (classId) => {
    const result = await pool.query(
        `SELECT c.*, d.name AS department, d.code AS department_code, ay.name AS academic_year
         FROM classes c
         JOIN departments d ON d.id = c.department_id
         JOIN academic_years ay ON ay.id = c.academic_year_id
         WHERE c.id = $1`, [classId]
    );
    return result.rows[0] || null;
};

const assertClassAccess = async (req, classId) => {
    const classRecord = await getClass(classId);
    if (!classRecord) throw new AppError('Class not found', 'NOT_FOUND', 404);
    if (!isGlobalManager(req)) {
        const result = await pool.query(
            'SELECT 1 FROM class_advisor_history WHERE class_id = $1 AND user_id = $2 AND unassigned_at IS NULL',
            [classId, req.user.user_id]
        );
        if (!result.rows[0]) throw new AppError('You do not have access to this class', 'FORBIDDEN', 403);
    }
    return classRecord;
};

const buildStudentQuery = async (req) => {
    const q = String(req.query.q || '').trim();
    const departmentId = req.query.department_id || null;
    const academicYearId = req.query.academic_year_id || null;
    const year = req.query.year || null;
    const section = req.query.section || null;
    const status = req.query.status || null;
    const classId = req.query.class_id || null;
    const limit = Math.min(parseInt(req.query.limit || 25, 10), 200);
    const offset = parseInt(req.query.offset || 0, 10);

    const values = [];
    const conditions = [];

    if (q) {
        values.push(`%${q}%`);
        conditions.push(`(s.register_number ILIKE $${values.length} OR s.name ILIKE $${values.length})`);
    }
    if (departmentId) { values.push(departmentId); conditions.push(`c.department_id = $${values.length}`); }
    if (academicYearId) { values.push(academicYearId); conditions.push(`s.academic_year_id = $${values.length}`); }
    if (year) { values.push(year); conditions.push(`s.year = $${values.length}`); }
    if (section) { values.push(section); conditions.push(`s.section = $${values.length}`); }
    if (status) { values.push(status); conditions.push(`s.status = $${values.length}`); }
    if (classId) { values.push(classId); conditions.push(`s.class_id = $${values.length}`); }

    // Class-scoped users: always restrict to their assigned class
    if (req.user.role === 'class_advisor') {
        const result = await pool.query(
            'SELECT class_id FROM class_advisor_history WHERE user_id = $1 AND unassigned_at IS NULL',
            [req.user.user_id]
        );
        if (!result.rows[0]) throw new AppError('No class assigned to this advisor', 'FORBIDDEN', 403);
        const advisorClassId = result.rows[0].class_id;
        values.push(advisorClassId);
        conditions.push(`s.class_id = $${values.length}`);
    } else if (req.user.role === 'class_representative') {
        if (!req.user.class_id) throw new AppError('No class assigned to this representative', 'FORBIDDEN', 403);
        values.push(req.user.class_id);
        conditions.push(`s.class_id = $${values.length}`);
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const countResult = await pool.query(
        `SELECT COUNT(*) FROM students s
         JOIN classes c ON c.id = s.class_id
         ${where}`, values
    );
    const total = parseInt(countResult.rows[0].count, 10);

    const dataValues = [...values, limit, offset];
    const rows = await pool.query(
        `SELECT s.*, c.display_name, d.name AS department_name, ay.name AS academic_year_name
         FROM students s
         JOIN classes c ON c.id = s.class_id
         JOIN departments d ON d.id = c.department_id
         JOIN academic_years ay ON ay.id = c.academic_year_id
         ${where}
         ORDER BY s.register_number
         LIMIT $${dataValues.length - 1} OFFSET $${dataValues.length}`,
        dataValues
    );

    return { rows: rows.rows, total, limit, offset };
};

// ── /me routes ────────────────────────────────────────────────────────────────

router.get('/me', verifyToken, requireRole('student'), async (req, res, next) => {
    try {
        const student = await Student.getById(req.user.student_id);
        if (!student) throw new AppError('Student not found', 'NOT_FOUND', 404);
        res.json(student);
    } catch (err) { next(err); }
});

router.get('/me/od-records', verifyToken, requireRole('student'), async (req, res, next) => {
    try {
        const limit = Math.min(parseInt(req.query.limit || 50, 10), 100);
        const offset = parseInt(req.query.offset || 0, 10);
        const records = await ODRecord.getByStudentId(req.user.student_id, limit, offset);
        const count = await ODRecord.countByStudentId(req.user.student_id);
        res.json({ data: records, total: count, limit, offset });
    } catch (err) { next(err); }
});

router.get('/me/certificates', verifyToken, requireRole('student'), async (req, res, next) => {
    try {
        const limit = Math.min(parseInt(req.query.limit || 50, 10), 100);
        const offset = parseInt(req.query.offset || 0, 10);
        const certificates = await Certificate.getByStudentId(req.user.student_id, limit, offset);
        const count = await Certificate.countByStudentId(req.user.student_id);
        res.json({ data: certificates, total: count, limit, offset });
    } catch (err) { next(err); }
});

// ── list / search ─────────────────────────────────────────────────────────────

router.get('/', verifyToken, async (req, res, next) => {
    try {
        const { role } = req.user;
        if (MANAGEMENT_ROLES.includes(role) || role === 'class_representative') {
            const result = await buildStudentQuery(req);
            return res.json({ data: result.rows, pagination: { total: result.total, limit: result.limit, offset: result.offset } });
        }
        // Legacy student_representative: search only (no pagination scope)
        if (role === 'student_representative') {
            const q = req.query.q || '';
            if (!q.trim()) throw new AppError('Search query required (q parameter)', 'VALIDATION_ERROR', 400);
            const limit = Math.min(parseInt(req.query.limit || 20, 10), 100);
            const offset = parseInt(req.query.offset || 0, 10);
            const students = await Student.search(q.trim(), limit, offset);
            return res.json({ data: students, query: q, limit, offset });
        }
        throw new AppError('Insufficient permissions', 'FORBIDDEN', 403);
    } catch (err) { next(err); }
});

// ── create ────────────────────────────────────────────────────────────────────

router.post('/', verifyToken, requireManagementRole(...MANAGEMENT_ROLES), async (req, res, next) => {
    try {
        const { register_number, name, date_of_birth, class_id, status } = req.body || {};
        if (!register_number || !name || !class_id) {
            throw new AppError('Missing required fields: register_number, name, class_id', 'VALIDATION_ERROR', 400);
        }
        if (!date_of_birth) throw new AppError('date_of_birth is required for student login', 'VALIDATION_ERROR', 400);
        if (!/^\d{4}-\d{2}-\d{2}$/.test(date_of_birth)) {
            throw new AppError('date_of_birth must use YYYY-MM-DD format', 'VALIDATION_ERROR', 400);
        }
        const classRecord = await assertClassAccess(req, class_id);
        const result = await pool.query(
            `INSERT INTO students (register_number, name, department, year, section, date_of_birth,
                                   class_id, academic_year_id, status)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, COALESCE($9, 'ACTIVE')) RETURNING *`,
            [register_number.trim(), name.trim(), classRecord.department, classRecord.year_of_study,
             classRecord.section, date_of_birth, classRecord.id, classRecord.academic_year_id, status || 'ACTIVE']
        );
        const student = result.rows[0];
        await pool.query(
            `INSERT INTO users (username, role, student_id, password_hash)
             VALUES ($1, 'student', $2, $3)`,
            [student.register_number, student.student_id, await bcrypt.hash(date_of_birth, 12)]
        );
        await AuditEvent.record({ actorUserId: req.user.user_id, action: 'student_created', targetEntity: 'student', targetId: student.student_id, newData: student });
        // Create initial academic history record
        await pool.query(
            `INSERT INTO student_academic_history (student_id, academic_year_id, class_id, status, notes)
             VALUES ($1, $2, $3, 'active', 'Initial enrollment')
             ON CONFLICT (student_id, academic_year_id) DO NOTHING`,
            [student.student_id, student.academic_year_id, student.class_id]
        );
        res.status(201).json(student);
    } catch (err) { next(err); }
});

// ── edit ──────────────────────────────────────────────────────────────────────

router.patch('/:studentId(\\d+)', verifyToken, requireManagementRole(...MANAGEMENT_ROLES), async (req, res, next) => {
    try {
        const current = (await pool.query('SELECT * FROM students WHERE student_id = $1', [req.params.studentId])).rows[0];
        if (!current) throw new AppError('Student not found', 'NOT_FOUND', 404);
        // Verify access to the student's current class
        await assertClassAccess(req, current.class_id);
        const targetClassId = req.body.class_id || current.class_id;
        let nextClass = null;
        if (req.body.class_id && String(req.body.class_id) !== String(current.class_id)) {
            nextClass = await assertClassAccess(req, req.body.class_id);
        }
        const fields = ['updated_at = NOW()'];
        const values = [];
        const add = (col, val) => { fields.push(`${col} = $${values.length + 1}`); values.push(val); };
        if (req.body.name !== undefined) add('name', req.body.name.trim());
        if (req.body.register_number !== undefined) add('register_number', req.body.register_number.trim());
        if (req.body.date_of_birth !== undefined) {
            if (!/^\d{4}-\d{2}-\d{2}$/.test(req.body.date_of_birth)) {
                throw new AppError('date_of_birth must use YYYY-MM-DD format', 'VALIDATION_ERROR', 400);
            }
            add('date_of_birth', req.body.date_of_birth);
        }
        if (nextClass) {
            add('class_id', nextClass.id);
            add('academic_year_id', nextClass.academic_year_id);
            add('department', nextClass.department);
            add('year', nextClass.year_of_study);
            add('section', nextClass.section);
        }
        if (req.body.status !== undefined) add('status', req.body.status);
        if (fields.length === 1) throw new AppError('No student fields supplied', 'VALIDATION_ERROR', 400);
        values.push(req.params.studentId);
        const result = await pool.query(
            `UPDATE students SET ${fields.join(', ')} WHERE student_id = $${values.length} RETURNING *`,
            values
        );
        await AuditEvent.record({ actorUserId: req.user.user_id, action: 'student_updated', targetEntity: 'student', targetId: req.params.studentId, oldData: current, newData: result.rows[0] });
        if (req.body.date_of_birth !== undefined) {
            await pool.query(
                `UPDATE users SET password_hash = $1, updated_at = NOW() WHERE student_id = $2 AND role = 'student'`,
                [await bcrypt.hash(req.body.date_of_birth, 12), req.params.studentId]
            );
        }
        res.json(result.rows[0]);
    } catch (err) { next(err); }
});

// ── deactivate ────────────────────────────────────────────────────────────────

router.patch('/:studentId(\\d+)/deactivate', verifyToken, requireManagementRole(...MANAGEMENT_ROLES), async (req, res, next) => {
    try {
        const current = (await pool.query('SELECT * FROM students WHERE student_id = $1', [req.params.studentId])).rows[0];
        if (!current) throw new AppError('Student not found', 'NOT_FOUND', 404);
        await assertClassAccess(req, current.class_id);
        const result = await pool.query(
            `UPDATE students SET status = 'INACTIVE', updated_at = NOW() WHERE student_id = $1 RETURNING *`,
            [req.params.studentId]
        );
        await pool.query(`UPDATE users SET is_active = FALSE, updated_at = NOW() WHERE student_id = $1`, [req.params.studentId]);
        await AuditEvent.record({ actorUserId: req.user.user_id, action: 'student_deactivated', targetEntity: 'student', targetId: req.params.studentId, oldData: current, newData: result.rows[0], details: req.body.reason || null });
        res.json(result.rows[0]);
    } catch (err) { next(err); }
});

// ── permanent delete (super_admin only) ───────────────────────────────────────

router.delete('/:studentId(\\d+)', verifyToken, requireManagementRole('super_admin'), async (req, res, next) => {
    const client = await pool.connect();
    try {
        const current = (await client.query('SELECT * FROM students WHERE student_id = $1 FOR UPDATE', [req.params.studentId])).rows[0];
        if (!current) throw new AppError('Student not found', 'NOT_FOUND', 404);
        // Block if historical records exist
        const odCount = (await client.query('SELECT COUNT(*) FROM od_records WHERE student_id = $1', [req.params.studentId])).rows[0].count;
        const certCount = (await client.query('SELECT COUNT(*) FROM certificates WHERE student_id = $1', [req.params.studentId])).rows[0].count;
        if (parseInt(odCount, 10) > 0 || parseInt(certCount, 10) > 0) {
            throw new AppError(
                `Cannot permanently delete: student has ${odCount} OD record(s) and ${certCount} certificate(s). Use deactivation instead.`,
                'CONFLICT', 409
            );
        }
        await client.query('BEGIN');
        // Remove CR assignment if any
        await client.query('DELETE FROM class_representatives WHERE student_id = $1', [req.params.studentId]);
        // Remove academic history records (ON DELETE RESTRICT requires explicit deletion)
        await client.query('DELETE FROM student_academic_history WHERE student_id = $1', [req.params.studentId]);
        // Remove user account
        await client.query('DELETE FROM users WHERE student_id = $1', [req.params.studentId]);
        // Remove student
        await client.query('DELETE FROM students WHERE student_id = $1', [req.params.studentId]);
        await AuditEvent.record({ actorUserId: req.user.user_id, action: 'student_permanently_deleted', targetEntity: 'student', targetId: req.params.studentId, oldData: current, details: req.body.reason || 'Permanent deletion by super_admin', client });
        await client.query('COMMIT');
        res.json({ message: 'Student permanently deleted', student_id: parseInt(req.params.studentId, 10) });
    } catch (err) { await client.query('ROLLBACK'); next(err); } finally { client.release(); }
});

// ── get single student ────────────────────────────────────────────────────────

router.get('/:studentId(\\d+)', verifyToken, requireManagementRole(...MANAGEMENT_ROLES, 'class_representative'), async (req, res, next) => {
    try {
        const result = await pool.query(
            `SELECT s.*, c.display_name, d.name AS department_name, ay.name AS academic_year_name
             FROM students s
             JOIN classes c ON c.id = s.class_id
             JOIN departments d ON d.id = c.department_id
             JOIN academic_years ay ON ay.id = c.academic_year_id
             WHERE s.student_id = $1`, [req.params.studentId]
        );
        if (!result.rows[0]) throw new AppError('Student not found', 'NOT_FOUND', 404);
        const student = result.rows[0];
        // Class-scoped check
        if (req.user.role === 'class_advisor') {
            await assertClassAccess(req, student.class_id);
        } else if (req.user.role === 'class_representative') {
            if (String(student.class_id) !== String(req.user.class_id)) {
                throw new AppError('You do not have access to this student', 'FORBIDDEN', 403);
            }
        }
        res.json(student);
    } catch (err) { next(err); }
});

// ── GET /:studentId/academic-history ─────────────────────────────────────────
router.get('/:studentId(\\d+)/academic-history',
    verifyToken,
    requireManagementRole(...MANAGEMENT_ROLES, 'class_representative'),
    async (req, res, next) => {
        try {
            const student = (await pool.query(
                'SELECT student_id, register_number, name, class_id FROM students WHERE student_id = $1',
                [req.params.studentId]
            )).rows[0];
            if (!student) throw new AppError('Student not found', 'NOT_FOUND', 404);

            if (req.user.role === 'class_advisor') {
                await assertClassAccess(req, student.class_id);
            }
            if (req.user.role === 'class_representative') {
                if (String(student.class_id) !== String(req.user.class_id))
                    throw new AppError('You do not have access to this student', 'FORBIDDEN', 403);
            }

            const history = await StudentAcademicHistory.getByStudent(req.params.studentId);
            return res.json({ student_id: Number(req.params.studentId), data: history });
        } catch (err) { next(err); }
    }
);

// ── bulk import ───────────────────────────────────────────────────────────────

const parseImportRows = async (file) => {
    if (!file) throw new AppError('An .xlsx or .csv file is required', 'VALIDATION_ERROR', 400);
    const ext = file.originalname.toLowerCase().split('.').pop();
    if (!['xlsx', 'csv'].includes(ext)) throw new AppError('Only .xlsx and .csv files are supported', 'VALIDATION_ERROR', 400);
    const wb = new ExcelJS.Workbook();
    if (ext === 'csv') {
        const { Readable } = await import('stream');
        const stream = Readable.from(file.buffer);
        await wb.csv.read(stream);
    } else {
        await wb.xlsx.load(file.buffer);
    }
    const sheet = wb.worksheets[0];
    if (!sheet) throw new AppError('The uploaded file has no worksheet', 'VALIDATION_ERROR', 400);
    const headers = sheet.getRow(1).values.slice(1).map((v) => String(v || '').trim().toLowerCase().replace(/\s+/g, '_'));
    const required = ['register_number', 'name', 'date_of_birth'];
    if (!required.every((h) => headers.includes(h))) {
        throw new AppError(`File must contain columns: ${required.join(', ')}`, 'VALIDATION_ERROR', 400);
    }
    return (sheet.getRows(2, Math.max(sheet.rowCount - 1, 0)) || []).map((row, i) => {
        const vals = row.values.slice(1);
        const item = Object.fromEntries(headers.map((h, c) => [h, vals[c] ?? '']));
        return { ...item, row_number: i + 2 };
    });
};

const validateImportRows = async (rows, classId) => {
    const classRecord = await getClass(classId);
    if (!classRecord) throw new AppError('Class not found', 'NOT_FOUND', 404);
    const seen = new Set();
    const regNums = rows.map((r) => String(r.register_number || '').trim()).filter(Boolean);
    const existing = regNums.length
        ? (await pool.query('SELECT register_number FROM students WHERE register_number = ANY($1::text[])', [regNums])).rows
        : [];
    const existingSet = new Set(existing.map((r) => r.register_number));
    const validated = rows.map((row) => {
        const rn = String(row.register_number || '').trim();
        const name = String(row.name || '').trim();
        const dobRaw = row.date_of_birth instanceof Date
            ? row.date_of_birth.toISOString().slice(0, 10)
            : String(row.date_of_birth || '').slice(0, 10);
        const errors = [];
        if (!rn) errors.push('missing register_number');
        if (!name) errors.push('missing name');
        if (!/^\d{4}-\d{2}-\d{2}$/.test(dobRaw) || Number.isNaN(Date.parse(dobRaw))) errors.push('invalid date_of_birth');
        if (rn && seen.has(rn)) errors.push('duplicate in file');
        if (rn && existingSet.has(rn)) errors.push('register_number already exists');
        if (rn) seen.add(rn);
        return { register_number: rn, name, date_of_birth: dobRaw, row_number: row.row_number, errors };
    });
    const summary = {
        total: validated.length,
        valid: validated.filter((r) => !r.errors.length).length,
        duplicates: validated.filter((r) => r.errors.some((e) => e.includes('duplicate') || e.includes('already exists'))).length,
        invalid: validated.filter((r) => r.errors.length && !r.errors.some((e) => e.includes('duplicate') || e.includes('already exists'))).length,
    };
    return { class: classRecord, rows: validated, summary };
};

// Preview: parse file, validate, store session server-side
router.post('/import/preview', verifyToken, requireManagementRole(...MANAGEMENT_ROLES), upload.single('file'), async (req, res, next) => {
    try {
        if (!req.body.class_id) throw new AppError('class_id is required before uploading', 'VALIDATION_ERROR', 400);
        await assertClassAccess(req, req.body.class_id);
        // Lazily purge expired sessions to prevent unbounded table growth.
        await pool.query('DELETE FROM import_sessions WHERE expires_at < NOW()').catch(() => {});
        const rows = await parseImportRows(req.file);
        const validation = await validateImportRows(rows, req.body.class_id);
        // Store validated preview server-side
        const session = await pool.query(
            `INSERT INTO import_sessions (class_id, created_by, validated_rows, summary)
             VALUES ($1, $2, $3::jsonb, $4::jsonb) RETURNING id`,
            [req.body.class_id, req.user.user_id, JSON.stringify(validation.rows), JSON.stringify(validation.summary)]
        );
        res.json({ session_id: session.rows[0].id, preview: true, ...validation });
    } catch (err) { next(err); }
});

// Confirm: re-validate from stored session, then insert
router.post('/import/confirm', verifyToken, requireManagementRole(...MANAGEMENT_ROLES), async (req, res, next) => {
    const client = await pool.connect();
    try {
        const { session_id } = req.body || {};
        if (!session_id) throw new AppError('session_id is required', 'VALIDATION_ERROR', 400);
        const sessionResult = await client.query(
            `SELECT * FROM import_sessions WHERE id = $1 AND created_by = $2 AND expires_at > NOW()`,
            [session_id, req.user.user_id]
        );
        const session = sessionResult.rows[0];
        if (!session) throw new AppError('Import session not found or expired. Please re-upload the file.', 'NOT_FOUND', 404);
        await assertClassAccess(req, session.class_id);
        const rows = session.validated_rows;
        // Re-validate against DB (detect duplicates added since preview)
        const validation = await validateImportRows(rows, session.class_id);
        if (validation.summary.valid !== validation.summary.total) {
            throw new AppError(
                'Import contains invalid or duplicate rows. Please preview again.',
                'VALIDATION_ERROR', 400
            );
        }
        await client.query('BEGIN');
        for (const row of validation.rows) {
            const inserted = await client.query(
                `INSERT INTO students (register_number, name, department, year, section, date_of_birth,
                                       class_id, academic_year_id, status)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'ACTIVE') RETURNING student_id`,
                [row.register_number, row.name, validation.class.department, validation.class.year_of_study,
                 validation.class.section, row.date_of_birth, validation.class.id, validation.class.academic_year_id]
            );
            await client.query(
                `INSERT INTO users (username, role, student_id, password_hash) VALUES ($1, 'student', $2, $3)`,
                [row.register_number, inserted.rows[0].student_id, await bcrypt.hash(row.date_of_birth, 12)]
            );
            await client.query(
                `INSERT INTO student_academic_history (student_id, academic_year_id, class_id, status, notes)
                 VALUES ($1, $2, $3, 'active', 'Bulk import enrollment')
                 ON CONFLICT (student_id, academic_year_id) DO NOTHING`,
                [inserted.rows[0].student_id, validation.class.academic_year_id, validation.class.id]
            );
        }
        await AuditEvent.record({ actorUserId: req.user.user_id, action: 'bulk_import', targetEntity: 'class', targetId: session.class_id, newData: validation.summary, client });
        // Clean up session
        await client.query('DELETE FROM import_sessions WHERE id = $1', [session_id]);
        await client.query('COMMIT');
        res.status(201).json({ imported: validation.summary.valid, class_id: session.class_id });
    } catch (err) { await client.query('ROLLBACK'); next(err); } finally { client.release(); }
});

// Legacy combined import endpoint (backward compat)
router.post('/import', verifyToken, requireManagementRole(...MANAGEMENT_ROLES), upload.single('file'), async (req, res, next) => {
    const client = await pool.connect();
    try {
        if (!req.body.class_id) throw new AppError('class_id is required before uploading', 'VALIDATION_ERROR', 400);
        await assertClassAccess(req, req.body.class_id);
        let rows;
        if (req.body.confirm === 'true') rows = JSON.parse(req.body.rows || '[]');
        else rows = await parseImportRows(req.file);
        const validation = await validateImportRows(rows, req.body.class_id);
        if (req.body.confirm !== 'true') return res.json({ preview: true, ...validation });
        if (validation.summary.valid !== validation.summary.total) {
            throw new AppError('Import contains invalid or duplicate rows; correct the preview before confirming', 'VALIDATION_ERROR', 400);
        }
        await client.query('BEGIN');
        for (const row of validation.rows) {
            const inserted = await client.query(
                `INSERT INTO students (register_number, name, department, year, section, date_of_birth,
                                       class_id, academic_year_id, status)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'ACTIVE') RETURNING student_id`,
                [row.register_number, row.name, validation.class.department, validation.class.year_of_study,
                 validation.class.section, row.date_of_birth, validation.class.id, validation.class.academic_year_id]
            );
            await client.query(
                `INSERT INTO users (username, role, student_id, password_hash) VALUES ($1, 'student', $2, $3)`,
                [row.register_number, inserted.rows[0].student_id, await bcrypt.hash(row.date_of_birth, 12)]
            );
            await client.query(
                `INSERT INTO student_academic_history (student_id, academic_year_id, class_id, status, notes)
                 VALUES ($1, $2, $3, 'active', 'Bulk import enrollment')
                 ON CONFLICT (student_id, academic_year_id) DO NOTHING`,
                [inserted.rows[0].student_id, validation.class.academic_year_id, validation.class.id]
            );
        }
        await AuditEvent.record({ actorUserId: req.user.user_id, action: 'bulk_import', targetEntity: 'class', targetId: req.body.class_id, newData: validation.summary, client });
        await client.query('COMMIT');
        res.status(201).json({ imported: validation.summary.valid, class_id: req.body.class_id });
    } catch (err) { await client.query('ROLLBACK'); next(err); } finally { client.release(); }
});

export default router;