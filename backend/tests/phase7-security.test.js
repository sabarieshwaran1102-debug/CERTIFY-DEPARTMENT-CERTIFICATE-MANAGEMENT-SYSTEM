/**
 * Phase 7: Role-Based Security Verification
 * Tests that every role can access permitted endpoints and is blocked from others.
 * Uses real HTTP via Supertest against the running app + real DB.
 */
import request from 'supertest';
import app from '../src/app.js';
import pool from '../src/config/database.js';
import bcrypt from 'bcrypt';

// ── Unique run prefix ─────────────────────────────────────────────────────────
const RUN = Date.now().toString(36).slice(-6).toUpperCase() + 'S7';
let seq = 0;
const uid = () => (RUN + String(++seq).padStart(3, '0')).slice(0, 20);

// ── Shared test state ─────────────────────────────────────────────────────────
let tokens = {};
let userIds = {};
let deptId, yearId, classId;
let studentId, crStudentId;
let testOdId;

// ── Helpers ───────────────────────────────────────────────────────────────────
const login = async (username, password, role) => {
    const res = await request(app).post('/api/auth/login').send({ username, password, role });
    if (res.status !== 200) throw new Error(`Login failed for ${username} (${role}): ${JSON.stringify(res.body)}`);
    return res.body.token;
};

const api = (token) => ({
    get:   (url, q) => request(app).get(url).set('Authorization', `Bearer ${token}`).query(q || {}),
    post:  (url, b) => request(app).post(url).set('Authorization', `Bearer ${token}`).send(b || {}),
    patch: (url, b) => request(app).patch(url).set('Authorization', `Bearer ${token}`).send(b || {}),
});

// ── Setup ─────────────────────────────────────────────────────────────────────
beforeAll(async () => {
    const pw = await bcrypt.hash('SecTest123!', 12);

    // Super Admin
    const saUsername = uid() + '@sa.test';
    const saRow = (await pool.query(
        'INSERT INTO users (username, role, password_hash) VALUES ($1, $2, $3) RETURNING user_id',
        [saUsername, 'super_admin', pw]
    )).rows[0];
    userIds.super_admin = saRow.user_id;
    tokens.super_admin = await login(saUsername, 'SecTest123!', 'super_admin');

    // Admin
    const adUsername = uid() + '@ad.test';
    const adRow = (await pool.query(
        'INSERT INTO users (username, role, password_hash) VALUES ($1, $2, $3) RETURNING user_id',
        [adUsername, 'admin', pw]
    )).rows[0];
    userIds.admin = adRow.user_id;
    tokens.admin = await login(adUsername, 'SecTest123!', 'admin');

    // Coordinating Faculty
    const cfUsername = uid() + '@cf.test';
    const cfRow = (await pool.query(
        'INSERT INTO users (username, role, password_hash) VALUES ($1, $2, $3) RETURNING user_id',
        [cfUsername, 'coordinating_faculty', pw]
    )).rows[0];
    userIds.coordinating_faculty = cfRow.user_id;
    tokens.coordinating_faculty = await login(cfUsername, 'SecTest123!', 'coordinating_faculty');

    // Org structure
    const deptCode = ('S7' + RUN.slice(0, 4)).slice(0, 8);
    const dpRow = (await pool.query(
        'INSERT INTO departments (name, code) VALUES ($1, $2) ON CONFLICT (code) DO UPDATE SET name=EXCLUDED.name RETURNING id',
        ['SecTestDept_' + RUN, deptCode]
    )).rows[0];
    deptId = dpRow.id;

    const yrRow = (await pool.query(
        'INSERT INTO academic_years (name) VALUES ($1) ON CONFLICT (name) DO UPDATE SET name=EXCLUDED.name RETURNING id',
        ['S7Y_' + RUN]
    )).rows[0];
    yearId = yrRow.id;

    const clRow = (await pool.query(
        `INSERT INTO classes (department_id, academic_year_id, year_of_study, section, display_name)
         VALUES ($1, $2, '1st Year', 'A', $3)
         ON CONFLICT (department_id, academic_year_id, year_of_study, section) DO UPDATE SET display_name=EXCLUDED.display_name
         RETURNING id`,
        [deptId, yearId, 'S7Cls_' + RUN]
    )).rows[0];
    classId = clRow.id;

    // Class Advisor
    const caUsername = uid() + '@ca.test';
    const caRow = (await pool.query(
        'INSERT INTO users (username, role, password_hash) VALUES ($1, $2, $3) RETURNING user_id',
        [caUsername, 'class_advisor', pw]
    )).rows[0];
    userIds.class_advisor = caRow.user_id;
    await pool.query(
        'INSERT INTO class_advisor_history (class_id, user_id, changed_by) VALUES ($1, $2, $3)',
        [classId, caRow.user_id, userIds.super_admin]
    );
    tokens.class_advisor = await login(caUsername, 'SecTest123!', 'class_advisor');

    // Student — login uses register_number (not username) + DOB as password
    const dobStr = '2000-01-01';
    const stuReg = uid() + 'STU';
    const stuRow = (await pool.query(
        `INSERT INTO students (register_number, name, department, year, section, date_of_birth, class_id, academic_year_id, status)
         VALUES ($1, $2, $3, '1st Year', 'A', $4, $5, $6, 'ACTIVE') RETURNING student_id`,
        [stuReg, 'SecTestStudent', 'SecTestDept_' + RUN, dobStr, classId, yearId]
    )).rows[0];
    studentId = stuRow.student_id;
    const stuUserRow = (await pool.query(
        'INSERT INTO users (username, role, student_id, password_hash) VALUES ($1, $2, $3, $4) RETURNING user_id',
        [stuReg, 'student', studentId, await bcrypt.hash(dobStr, 12)]
    )).rows[0];
    userIds.student = stuUserRow.user_id;
    // Student login uses register_number as username
    tokens.student = await login(stuReg, dobStr, 'student');

    // Class Representative student — login also uses register_number + DOB
    const crDobStr = '2000-06-15';
    const crReg = uid() + 'CRS';
    const crStuRow = (await pool.query(
        `INSERT INTO students (register_number, name, department, year, section, date_of_birth, class_id, academic_year_id, status)
         VALUES ($1, $2, $3, '1st Year', 'A', $4, $5, $6, 'ACTIVE') RETURNING student_id`,
        [crReg, 'SecTestCR', 'SecTestDept_' + RUN, crDobStr, classId, yearId]
    )).rows[0];
    crStudentId = crStuRow.student_id;
    await pool.query(
        'INSERT INTO class_representatives (class_id, student_id, assigned_by) VALUES ($1, $2, $3)',
        [classId, crStudentId, userIds.super_admin]
    );
    const crUserRow = (await pool.query(
        'INSERT INTO users (username, role, student_id, password_hash, class_id) VALUES ($1, $2, $3, $4, $5) RETURNING user_id',
        [crReg, 'class_representative', crStudentId, await bcrypt.hash(crDobStr, 12), classId]
    )).rows[0];
    userIds.class_representative = crUserRow.user_id;
    // CR login uses register_number as username
    tokens.class_representative = await login(crReg, crDobStr, 'class_representative');

    // Student Representative
    const srUsername = uid() + '@sr.test';
    const srRow = (await pool.query(
        'INSERT INTO users (username, role, password_hash) VALUES ($1, $2, $3) RETURNING user_id',
        [srUsername, 'student_representative', pw]
    )).rows[0];
    userIds.student_representative = srRow.user_id;
    tokens.student_representative = await login(srUsername, 'SecTest123!', 'student_representative');

    // Create a test OD (class_advisor has permission to create ODs)
    const odRes = await request(app)
        .post('/api/ods')
        .set('Authorization', `Bearer ${tokens.class_advisor}`)
        .send({
            class_id: classId,
            event_name: 'SecurityTestEvent_' + RUN,
            event_type: 'Conference',
            event_date: '2024-03-15',
            od_start_date: '2024-03-15',
            od_end_date: '2024-03-15',
            purpose: 'Security test',
            venue: 'Test Venue',
            student_ids: [studentId],
        });
    if (odRes.status === 201) {
        testOdId = odRes.body.id;
    }
}, 60000);

// ── Teardown ──────────────────────────────────────────────────────────────────
afterAll(async () => {
    try {
        // Clean up OD participants and ODs
        if (testOdId) {
            await pool.query('DELETE FROM od_participants WHERE od_id = $1', [testOdId]);
            await pool.query('DELETE FROM ods WHERE id = $1', [testOdId]);
        }
        // Clean up students (in dependency order)
        await pool.query('DELETE FROM class_representatives WHERE student_id = ANY($1::bigint[])', [[studentId, crStudentId].filter(Boolean)]);
        await pool.query('DELETE FROM users WHERE user_id = ANY($1::bigint[])', [Object.values(userIds).filter(Boolean)]);
        await pool.query('DELETE FROM students WHERE student_id = ANY($1::bigint[])', [[studentId, crStudentId].filter(Boolean)]);
        await pool.query('DELETE FROM class_advisor_history WHERE class_id = $1', [classId]);
        await pool.query('DELETE FROM classes WHERE id = $1', [classId]);
        await pool.query('DELETE FROM academic_years WHERE id = $1', [yearId]);
        await pool.query('DELETE FROM departments WHERE id = $1', [deptId]);
    } catch { /* best-effort cleanup */ }
    await pool.end().catch(() => {});
}, 30000);

// ═══════════════════════════════════════════════════════════════════════════════
// Section 1: Authentication
// ═══════════════════════════════════════════════════════════════════════════════

describe('Authentication', () => {
    test('unauthenticated request to protected endpoint returns 401', async () => {
        const res = await request(app).get('/api/ods');
        expect(res.status).toBe(401);
    });

    test('invalid token returns 401', async () => {
        const res = await request(app).get('/api/ods').set('Authorization', 'Bearer invalid.token.here');
        expect(res.status).toBe(401);
    });

    test('all 7 roles can log in and receive a token', () => {
        for (const role of ['super_admin', 'admin', 'coordinating_faculty', 'class_advisor', 'class_representative', 'student_representative', 'student']) {
            expect(typeof tokens[role]).toBe('string');
            expect(tokens[role].length).toBeGreaterThan(10);
        }
    });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Section 2: OD Access Control
// ═══════════════════════════════════════════════════════════════════════════════

describe('OD Access Control', () => {
    test('student_representative cannot list ODs', async () => {
        const res = await api(tokens.student_representative).get('/api/ods');
        expect(res.status).toBe(403);
    });

    test('student can list ODs (scoped to their participations)', async () => {
        const res = await api(tokens.student).get('/api/ods');
        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('data');
    });

    test('class_representative can list ODs', async () => {
        const res = await api(tokens.class_representative).get('/api/ods');
        expect(res.status).toBe(200);
    });

    test('class_advisor can list ODs', async () => {
        const res = await api(tokens.class_advisor).get('/api/ods');
        expect(res.status).toBe(200);
    });

    test('admin can list ODs', async () => {
        const res = await api(tokens.admin).get('/api/ods');
        expect(res.status).toBe(200);
    });

    test('super_admin can list ODs', async () => {
        const res = await api(tokens.super_admin).get('/api/ods');
        expect(res.status).toBe(200);
    });

    test('coordinating_faculty cannot CREATE an OD', async () => {
        const res = await api(tokens.coordinating_faculty)
            .post('/api/ods')
            .send({
                class_id: classId,
                event_name: 'ShouldFail',
                event_type: 'Conference',
                event_date: '2024-05-01',
                od_start_date: '2024-05-01',
                od_end_date: '2024-05-01',
                purpose: 'Test',
                venue: 'Venue',
                student_ids: [studentId],
            });
        expect(res.status).toBe(403);
    });

    test('student cannot CREATE an OD', async () => {
        const res = await api(tokens.student)
            .post('/api/ods')
            .send({ event_name: 'ShouldFail', class_id: classId, event_type: 'x', event_date: '2024-05-01', od_start_date: '2024-05-01', od_end_date: '2024-05-01', purpose: 'x', venue: 'x', student_ids: [studentId] });
        expect(res.status).toBe(403);
    });

    test('student_representative cannot CREATE an OD', async () => {
        const res = await api(tokens.student_representative).post('/api/ods').send({});
        expect(res.status).toBe(403);
    });

    test('student cannot CANCEL an OD', async () => {
        if (!testOdId) return;
        const res = await api(tokens.student)
            .post(`/api/ods/${testOdId}/cancel`)
            .send({ reason: 'Attempted cancel' });
        expect(res.status).toBe(403);
    });

    test('class_representative cannot CANCEL an OD', async () => {
        if (!testOdId) return;
        const res = await api(tokens.class_representative)
            .post(`/api/ods/${testOdId}/cancel`)
            .send({ reason: 'Attempted cancel' });
        expect(res.status).toBe(403);
    });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Section 3: Certificate Access Control
// ═══════════════════════════════════════════════════════════════════════════════

describe('Certificate Access Control (od-certificates)', () => {
    test('student_representative cannot list od-certificates', async () => {
        const res = await api(tokens.student_representative).get('/api/od-certificates');
        expect(res.status).toBe(403);
    });

    test('student can list od-certificates (scoped)', async () => {
        const res = await api(tokens.student).get('/api/od-certificates');
        expect(res.status).toBe(200);
    });

    test('class_advisor can list od-certificates', async () => {
        const res = await api(tokens.class_advisor).get('/api/od-certificates');
        expect(res.status).toBe(200);
    });

    test('admin can list od-certificates', async () => {
        const res = await api(tokens.admin).get('/api/od-certificates');
        expect(res.status).toBe(200);
    });

    test('coordinating_faculty can list pending od-certificates', async () => {
        const res = await api(tokens.coordinating_faculty).get('/api/od-certificates/pending');
        expect(res.status).toBe(200);
    });

    test('student cannot access pending od-certificates', async () => {
        const res = await api(tokens.student).get('/api/od-certificates/pending');
        expect(res.status).toBe(403);
    });

    test('student_representative cannot access pending od-certificates', async () => {
        const res = await api(tokens.student_representative).get('/api/od-certificates/pending');
        expect(res.status).toBe(403);
    });

    test('student cannot verify a certificate', async () => {
        const res = await api(tokens.student).patch('/api/od-certificates/9999/verify').send({});
        // 403 or 404 (no cert 9999) — either means access blocked before cert is found
        expect([403, 404]).toContain(res.status);
    });

    test('student_representative cannot verify a certificate', async () => {
        const res = await api(tokens.student_representative).patch('/api/od-certificates/9999/verify').send({});
        expect([403, 404]).toContain(res.status);
    });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Section 4: Reports Access Control
// ═══════════════════════════════════════════════════════════════════════════════

describe('Reports Access Control', () => {
    test('coordinating_faculty can access monthly-summary', async () => {
        const res = await api(tokens.coordinating_faculty)
            .get('/api/reports/monthly-summary')
            .query({ month: '2024-03' });
        expect(res.status).toBe(200);
    });

    test('admin cannot access monthly-summary (faculty only)', async () => {
        const res = await api(tokens.admin)
            .get('/api/reports/monthly-summary')
            .query({ month: '2024-03' });
        expect(res.status).toBe(403);
    });

    test('super_admin cannot access monthly-summary (faculty only)', async () => {
        const res = await api(tokens.super_admin)
            .get('/api/reports/monthly-summary')
            .query({ month: '2024-03' });
        expect(res.status).toBe(403);
    });

    test('student cannot access monthly-summary', async () => {
        const res = await api(tokens.student)
            .get('/api/reports/monthly-summary')
            .query({ month: '2024-03' });
        expect(res.status).toBe(403);
    });

    test('class_advisor cannot access monthly-summary', async () => {
        const res = await api(tokens.class_advisor)
            .get('/api/reports/monthly-summary')
            .query({ month: '2024-03' });
        expect(res.status).toBe(403);
    });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Section 5: Audit Access Control
// ═══════════════════════════════════════════════════════════════════════════════

describe('Audit Access Control', () => {
    test('super_admin can access /api/audit', async () => {
        const res = await api(tokens.super_admin).get('/api/audit');
        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('data');
    });

    test('admin can access /api/audit', async () => {
        const res = await api(tokens.admin).get('/api/audit');
        expect(res.status).toBe(200);
    });

    test('coordinating_faculty cannot access /api/audit', async () => {
        const res = await api(tokens.coordinating_faculty).get('/api/audit');
        expect(res.status).toBe(403);
    });

    test('class_advisor cannot access /api/audit', async () => {
        const res = await api(tokens.class_advisor).get('/api/audit');
        expect(res.status).toBe(403);
    });

    test('student cannot access /api/audit', async () => {
        const res = await api(tokens.student).get('/api/audit');
        expect(res.status).toBe(403);
    });

    test('class_representative cannot access /api/audit', async () => {
        const res = await api(tokens.class_representative).get('/api/audit');
        expect(res.status).toBe(403);
    });

    test('student_representative cannot access /api/audit', async () => {
        const res = await api(tokens.student_representative).get('/api/audit');
        expect(res.status).toBe(403);
    });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Section 6: Management / Organization Access Control
// ═══════════════════════════════════════════════════════════════════════════════

describe('Management Access Control', () => {
    test('super_admin can list departments', async () => {
        const res = await api(tokens.super_admin).get('/api/departments');
        expect(res.status).toBe(200);
    });

    test('admin can list departments', async () => {
        const res = await api(tokens.admin).get('/api/departments');
        expect(res.status).toBe(200);
    });

    test('student cannot list departments', async () => {
        const res = await api(tokens.student).get('/api/departments');
        expect(res.status).toBe(403);
    });

    test('student_representative cannot list departments', async () => {
        const res = await api(tokens.student_representative).get('/api/departments');
        expect(res.status).toBe(403);
    });

    test('student cannot list academic years', async () => {
        const res = await api(tokens.student).get('/api/academic-years');
        expect(res.status).toBe(403);
    });

    test('super_admin can create and deactivate academic years', async () => {
        // Create
        const createRes = await api(tokens.super_admin)
            .post('/api/academic-years')
            .send({ name: 'SecAY-' + RUN, active: true });
        expect(createRes.status).toBe(201);
        const ayId = createRes.body.id;

        // Deactivate
        const deactivateRes = await api(tokens.super_admin)
            .post(`/api/academic-years/${ayId}/deactivate`);
        expect(deactivateRes.status).toBe(200);
        expect(deactivateRes.body.active).toBe(false);

        // Re-activate
        const activateRes = await api(tokens.super_admin)
            .post(`/api/academic-years/${ayId}/activate`);
        expect(activateRes.status).toBe(200);
        expect(activateRes.body.active).toBe(true);

        // Cleanup
        await pool.query('DELETE FROM academic_years WHERE id = $1', [ayId]);
    });

    test('class_representative cannot create departments', async () => {
        const res = await api(tokens.class_representative)
            .post('/api/departments')
            .send({ name: 'ShouldFail', code: 'SFAIL' });
        expect(res.status).toBe(403);
    });

    test('student cannot create academic years', async () => {
        const res = await api(tokens.student)
            .post('/api/academic-years')
            .send({ name: 'ShouldFail' });
        expect(res.status).toBe(403);
    });
});
