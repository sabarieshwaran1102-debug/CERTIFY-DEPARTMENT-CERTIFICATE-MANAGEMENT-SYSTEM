import express from 'express';
import multer from 'multer';
import ExcelJS from 'exceljs';
import bcrypt from 'bcrypt';
import { verifyToken, requireRole } from '../middleware/auth.js';
import { requireManagementRole, requireStudentRepRole } from '../middleware/authorization.js';
import Student from '../models/Student.js';
import ODRecord from '../models/ODRecord.js';
import Certificate from '../models/Certificate.js';
import AuditEvent from '../models/AuditEvent.js';
import pool from '../config/database.js';
import { AppError } from '../middleware/errorHandler.js';

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });
const globalRoles = ['super_admin', 'admin'];
const managementRoles = ['super_admin', 'admin', 'class_advisor'];

const isGlobalManager = (req) => globalRoles.includes(req.user.role);

const getClass = async (classId) => {
    const result = await pool.query(
        `SELECT c.*, d.name AS department, d.code AS department_code, ay.name AS academic_year
         FROM classes c JOIN departments d ON d.id = c.department_id JOIN academic_years ay ON ay.id = c.academic_year_id
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

const validateStudentFields = (body, requireClass = true) => {
    const required = ['register_number', 'name'];
    if (requireClass) required.push('class_id');
    const missing = required.filter((field) => !body?.[field] && body?.[field] !== 0);
    if (missing.length) throw new AppError(`Missing required fields: ${missing.join(', ')}`, 'VALIDATION_ERROR', 400);
    if (body.date_of_birth && !/^\d{4}-\d{2}-\d{2}$/.test(body.date_of_birth)) {
        throw new AppError('date_of_birth must use YYYY-MM-DD format', 'VALIDATION_ERROR', 400);
    }
};

const normalizeSearch = (query) => ({
    q: String(query.q || '').trim(),
    department_id: query.department_id || null,
    academic_year_id: query.academic_year_id || null,
    year: query.year || null,
    section: query.section || null,
    status: query.status || null,
});

const findManagedStudents = async (req) => {
    const filters = normalizeSearch(req.query);
    const values = [];
    const conditions = [];
    if (filters.q) {
        values.push(`%${filters.q}%`);
        conditions.push(`(s.register_number ILIKE $${values.length} OR s.name ILIKE $${values.length})`);
    }
    for (const [field, expression] of [
        ['department_id', 'c.department_id'],
        ['academic_year_id', 's.academic_year_id'],
    ]) {
        if (filters[field]) { values.push(filters[field]); conditions.push(`${expression} = $${values.length}`); }
    }
    for (const [field, expression] of [['year', 's.year'], ['section', 's.section'], ['status', 's.status']]) {
        if (filters[field]) { values.push(filters[field]); conditions.push(`${expression} = $${values.length}`); }
    }
    if (!isGlobalManager(req)) {
        values.push(req.user.user_id);
        conditions.push(`EXISTS (SELECT 1 FROM class_advisor_history ah WHERE ah.class_id = s.class_id AND ah.user_id = $${values.length} AND ah.unassigned_at IS NULL)`);
    }
    const result = await pool.query(
        `SELECT s.*, c.display_name, d.name AS department_name, ay.name AS academic_year_name
         FROM students s JOIN classes c ON c.id = s.class_id JOIN departments d ON d.id = c.department_id
         JOIN academic_years ay ON ay.id = c.academic_year_id
         ${conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''}
         ORDER BY s.register_number`, values
    );
    return result.rows;
};

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
router.get('/', verifyToken, async (req, res, next) => {
    try {
        if (managementRoles.includes(req.user.role)) {
            const students = await findManagedStudents(req);
            return res.json({ data: students, total: students.length });
        }
        requireStudentRepRole(req, res, (error) => { if (error) throw error; });
        const query = req.query.q || '';
        const limit = Math.min(parseInt(req.query.limit || 20), 100);
        const offset = parseInt(req.query.offset || 0);

        if (!query || query.trim().length === 0) {
            throw new AppError('Search query required (q parameter)', 'VALIDATION_ERROR', 400);
        }

        const students = await Student.search(query.trim(), limit, offset);

        return res.json({
            data: students,
            query,
            limit,
            offset,
        });
    } catch (err) {
        next(err);
    }
});

router.post('/', verifyToken, requireManagementRole(...managementRoles), async (req, res, next) => {
    try {
        validateStudentFields(req.body);
        const classRecord = await assertClassAccess(req, req.body.class_id);
        if (!req.body.date_of_birth) throw new AppError('date_of_birth is required for student login', 'VALIDATION_ERROR', 400);
        const result = await pool.query(
            `INSERT INTO students (register_number, name, department, year, section, date_of_birth, class_id, academic_year_id, status)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, COALESCE($9, 'ACTIVE')) RETURNING *`,
            [req.body.register_number.trim(), req.body.name.trim(), classRecord.department, classRecord.year_of_study, classRecord.section, req.body.date_of_birth, classRecord.id, classRecord.academic_year_id, req.body.status || 'ACTIVE']
        );
        const student = result.rows[0];
        await pool.query(
            `INSERT INTO users (username, role, student_id, password_hash) VALUES ($1, 'student', $2, $3)`,
            [student.register_number, student.student_id, await bcrypt.hash(student.date_of_birth.toISOString().slice(0, 10), 12)]
        );
        await AuditEvent.record({ actorUserId: req.user.user_id, action: 'student_created', targetEntity: 'student', targetId: student.student_id, newData: student });
        res.status(201).json(student);
    } catch (err) { next(err); }
});

router.patch('/:studentId(\\d+)', verifyToken, requireManagementRole(...managementRoles), async (req, res, next) => {
    try {
        const currentResult = await pool.query('SELECT * FROM students WHERE student_id = $1', [req.params.studentId]);
        const current = currentResult.rows[0];
        if (!current) throw new AppError('Student not found', 'NOT_FOUND', 404);
        await assertClassAccess(req, req.body.class_id || current.class_id);
        const nextClass = req.body.class_id ? await assertClassAccess(req, req.body.class_id) : null;
        const fields = [];
        const values = [];
        const add = (field, value) => { fields.push(`${field} = $${values.length + 1}`); values.push(value); };
        if (req.body.name !== undefined) add('name', req.body.name.trim());
        if (req.body.date_of_birth !== undefined) {
            if (!/^\d{4}-\d{2}-\d{2}$/.test(req.body.date_of_birth)) throw new AppError('date_of_birth must use YYYY-MM-DD format', 'VALIDATION_ERROR', 400);
            add('date_of_birth', req.body.date_of_birth);
        }
        if (req.body.register_number !== undefined) add('register_number', req.body.register_number.trim());
        if (nextClass) {
            add('class_id', nextClass.id); add('academic_year_id', nextClass.academic_year_id); add('department', nextClass.department); add('year', nextClass.year_of_study); add('section', nextClass.section);
        }
        if (req.body.status !== undefined) add('status', req.body.status);
        if (!fields.length) throw new AppError('No student fields supplied', 'VALIDATION_ERROR', 400);
        fields.push('updated_at = NOW()'); values.push(req.params.studentId);
        const result = await pool.query(`UPDATE students SET ${fields.join(', ')} WHERE student_id = $${values.length} RETURNING *`, values);
        await AuditEvent.record({ actorUserId: req.user.user_id, action: 'student_updated', targetEntity: 'student', targetId: req.params.studentId, oldData: current, newData: result.rows[0] });
        if (req.body.date_of_birth !== undefined) {
            await pool.query('UPDATE users SET password_hash = $1, updated_at = NOW() WHERE student_id = $2 AND role = \'student\'', [await bcrypt.hash(req.body.date_of_birth, 12), req.params.studentId]);
        }
        res.json(result.rows[0]);
    } catch (err) { next(err); }
});

router.patch('/:studentId(\\d+)/deactivate', verifyToken, requireManagementRole(...managementRoles), async (req, res, next) => {
    try {
        const current = await pool.query('SELECT * FROM students WHERE student_id = $1', [req.params.studentId]);
        if (!current.rows[0]) throw new AppError('Student not found', 'NOT_FOUND', 404);
        await assertClassAccess(req, current.rows[0].class_id);
        const result = await pool.query(`UPDATE students SET status = 'INACTIVE', updated_at = NOW() WHERE student_id = $1 RETURNING *`, [req.params.studentId]);
        await pool.query(`UPDATE users SET is_active = FALSE, updated_at = NOW() WHERE student_id = $1`, [req.params.studentId]);
        await AuditEvent.record({ actorUserId: req.user.user_id, action: 'student_deactivated', targetEntity: 'student', targetId: req.params.studentId, oldData: current.rows[0], newData: result.rows[0] });
        res.json(result.rows[0]);
    } catch (err) { next(err); }
});

const parseImportRows = async (file) => {
    if (!file) throw new AppError('An .xlsx or .csv file is required', 'VALIDATION_ERROR', 400);
    const extension = file.originalname.toLowerCase().split('.').pop();
    if (!['xlsx', 'csv'].includes(extension)) throw new AppError('Only .xlsx and .csv files are supported', 'VALIDATION_ERROR', 400);
    const workbook = new ExcelJS.Workbook();
    if (extension === 'csv') await workbook.csv.load(file.buffer); else await workbook.xlsx.load(file.buffer);
    const sheet = workbook.worksheets[0];
    if (!sheet) throw new AppError('The uploaded file has no worksheet', 'VALIDATION_ERROR', 400);
    const headers = sheet.getRow(1).values.slice(1).map((value) => String(value || '').trim().toLowerCase().replace(/\s+/g, '_'));
    const required = ['register_number', 'name', 'date_of_birth'];
    if (!required.every((header) => headers.includes(header))) throw new AppError(`File must contain columns: ${required.join(', ')}`, 'VALIDATION_ERROR', 400);
    return sheet.getRows(2, Math.max(sheet.rowCount - 1, 0)).map((row, index) => {
        const values = row.values.slice(1);
        const item = Object.fromEntries(headers.map((header, column) => [header, values[column] ?? '']));
        return { ...item, row_number: index + 2 };
    });
};

const validateImportRows = async (rows, classId) => {
    const classRecord = await getClass(classId);
    if (!classRecord) throw new AppError('Class not found', 'NOT_FOUND', 404);
    const seen = new Set();
    const existing = await pool.query('SELECT register_number FROM students WHERE register_number = ANY($1::text[])', [rows.map((row) => String(row.register_number || '').trim()).filter(Boolean)]);
    const existingNumbers = new Set(existing.rows.map((row) => row.register_number));
    const validated = rows.map((row) => {
        const registerNumber = String(row.register_number || '').trim();
        const name = String(row.name || '').trim();
        const dob = row.date_of_birth instanceof Date ? row.date_of_birth.toISOString().slice(0, 10) : String(row.date_of_birth || '').slice(0, 10);
        const errors = [];
        if (!registerNumber) errors.push('missing register_number');
        if (!name) errors.push('missing name');
        if (!/^\d{4}-\d{2}-\d{2}$/.test(dob) || Number.isNaN(Date.parse(dob))) errors.push('invalid date_of_birth');
        if (seen.has(registerNumber)) errors.push('duplicate in file');
        if (existingNumbers.has(registerNumber)) errors.push('register_number already exists');
        seen.add(registerNumber);
        return { register_number: registerNumber, name, date_of_birth: dob, row_number: row.row_number, errors };
    });
    return { class: classRecord, rows: validated, summary: { total: validated.length, valid: validated.filter((row) => !row.errors.length).length, duplicates: validated.filter((row) => row.errors.some((error) => error.includes('duplicate') || error.includes('already exists'))).length, invalid: validated.filter((row) => row.errors.length && !row.errors.some((error) => error.includes('duplicate') || error.includes('already exists'))).length } };
};

router.post('/import', verifyToken, requireManagementRole(...managementRoles), upload.single('file'), async (req, res, next) => {
    const client = await pool.connect();
    try {
        if (!req.body.class_id) throw new AppError('class_id is required before uploading', 'VALIDATION_ERROR', 400);
        await assertClassAccess(req, req.body.class_id);
        let rows;
        if (req.body.confirm === 'true') rows = JSON.parse(req.body.rows || '[]');
        else rows = await parseImportRows(req.file);
        const validation = await validateImportRows(rows, req.body.class_id);
        if (req.body.confirm !== 'true') return res.json({ preview: true, ...validation });
        if (validation.summary.valid !== validation.summary.total) throw new AppError('Import contains invalid or duplicate rows; correct the preview before confirming', 'VALIDATION_ERROR', 400);
        await client.query('BEGIN');
        for (const row of validation.rows) {
            const inserted = await client.query(
                `INSERT INTO students (register_number, name, department, year, section, date_of_birth, class_id, academic_year_id, status)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'ACTIVE') RETURNING student_id`,
                [row.register_number, row.name, validation.class.department, validation.class.year_of_study, validation.class.section, row.date_of_birth, validation.class.id, validation.class.academic_year_id]
            );
            await client.query(`INSERT INTO users (username, role, student_id, password_hash) VALUES ($1, 'student', $2, $3)`, [row.register_number, inserted.rows[0].student_id, await bcrypt.hash(row.date_of_birth, 12)]);
        }
        await AuditEvent.record({ actorUserId: req.user.user_id, action: 'bulk_import', targetEntity: 'class', targetId: req.body.class_id, newData: validation.summary, client });
        await client.query('COMMIT');
        res.status(201).json({ imported: validation.summary.valid, class_id: req.body.class_id });
    } catch (err) { await client.query('ROLLBACK'); next(err); } finally { client.release(); }
});

export default router;
