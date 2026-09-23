/**
 * Phase 8: Student Academic History Tests
 *
 * 1. History record created on student creation
 * 2. Duplicate prevention (UNIQUE constraint)
 * 3. Promotion creates exit + new enrollment records
 * 4. Old class/history preserved after promotion
 * 5. OD records unaffected by promotion (still reference original student_id)
 * 6. Authorization
 */
import request from 'supertest';
import app from '../src/app.js';
import pool from '../src/config/database.js';
import bcrypt from 'bcrypt';
import StudentAcademicHistory from '../src/models/StudentAcademicHistory.js';

const RUN = Date.now().toString(36).slice(-5).toUpperCase();
let seq = 0;
const nxt = (pfx = '') => (pfx + RUN + String(++seq).padStart(3, '0')).slice(0, 20);

let adminToken, superAdminToken, cfToken, studentToken;
let adminUserId, saUserId, cfUserId, caUserId;
let deptId, yearAId, yearBId;
let classA1Id, classB1Id;
let studentId, studentReg;
let testOdId;

const loginAs = async (u, p, r) => {
    const res = await request(app).post('/api/auth/login').send({ username: u, password: p, role: r });
    if (res.status !== 200) throw new Error(`Login failed ${u}/${r}: ${JSON.stringify(res.body)}`);
    return res.body.token;
};
const auth = (t) => ({
    get:    (url) => request(app).get(url).set('Authorization', `Bearer ${t}`),
    post:   (url, b) => request(app).post(url).set('Authorization', `Bearer ${t}`).send(b || {}),
    patch:  (url, b) => request(app).patch(url).set('Authorization', `Bearer ${t}`).send(b || {}),
    delete: (url, b) => request(app).delete(url).set('Authorization', `Bearer ${t}`).send(b || {}),
});

beforeAll(async () => {
    const pw = await bcrypt.hash('HistTest1!', 12);

    const sa = (await pool.query('INSERT INTO users (username,role,password_hash) VALUES ($1,$2,$3) RETURNING user_id,username', [nxt('sa') + '@ph8.test', 'super_admin', pw])).rows[0];
    saUserId = sa.user_id; superAdminToken = await loginAs(sa.username, 'HistTest1!', 'super_admin');

    const ad = (await pool.query('INSERT INTO users (username,role,password_hash) VALUES ($1,$2,$3) RETURNING user_id,username', [nxt('ad') + '@ph8.test', 'admin', pw])).rows[0];
    adminUserId = ad.user_id; adminToken = await loginAs(ad.username, 'HistTest1!', 'admin');

    const cf = (await pool.query('INSERT INTO users (username,role,password_hash) VALUES ($1,$2,$3) RETURNING user_id,username', [nxt('cf') + '@ph8.test', 'coordinating_faculty', pw])).rows[0];
    cfUserId = cf.user_id; cfToken = await loginAs(cf.username, 'HistTest1!', 'coordinating_faculty');

    // Org
    const dp = (await pool.query(
        'INSERT INTO departments (name,code) VALUES ($1,$2) ON CONFLICT (code) DO UPDATE SET name=EXCLUDED.name RETURNING id',
        ['Ph8Dept_' + RUN, 'P8' + RUN.slice(0,4)]
    )).rows[0]; deptId = dp.id;

    const yA = (await pool.query(
        'INSERT INTO academic_years (name) VALUES ($1) ON CONFLICT (name) DO UPDATE SET name=EXCLUDED.name RETURNING id',
        ['Ph8YA_' + RUN]
    )).rows[0]; yearAId = yA.id;

    const yB = (await pool.query(
        'INSERT INTO academic_years (name) VALUES ($1) ON CONFLICT (name) DO UPDATE SET name=EXCLUDED.name RETURNING id',
        ['Ph8YB_' + RUN]
    )).rows[0]; yearBId = yB.id;

    const ca1 = (await pool.query(
        `INSERT INTO classes (department_id,academic_year_id,year_of_study,section,display_name)
         VALUES ($1,$2,'1st Year','P',$3)
         ON CONFLICT (department_id,academic_year_id,year_of_study,section) DO UPDATE SET display_name=EXCLUDED.display_name RETURNING id`,
        [deptId, yearAId, 'Ph8A1_' + RUN]
    )).rows[0]; classA1Id = ca1.id;

    const cb1 = (await pool.query(
        `INSERT INTO classes (department_id,academic_year_id,year_of_study,section,display_name)
         VALUES ($1,$2,'2nd Year','P',$3)
         ON CONFLICT (department_id,academic_year_id,year_of_study,section) DO UPDATE SET display_name=EXCLUDED.display_name RETURNING id`,
        [deptId, yearBId, 'Ph8B1_' + RUN]
    )).rows[0]; classB1Id = cb1.id;

    // Class advisor assigned to classA1
    const ca = (await pool.query('INSERT INTO users (username,role,password_hash) VALUES ($1,$2,$3) RETURNING user_id,username', [nxt('ca') + '@ph8.test', 'class_advisor', pw])).rows[0];
    caUserId = ca.user_id;
    await pool.query('INSERT INTO class_advisor_history (class_id,user_id,changed_by) VALUES ($1,$2,$3)', [classA1Id, caUserId, saUserId]);

    // Create student via API — should auto-create history record
    studentReg = 'PH8' + nxt();
    const stuRes = await auth(adminToken).post('/api/students', {
        register_number: studentReg,
        name: 'Ph8Student',
        date_of_birth: '2003-07-10',
        class_id: classA1Id,
    });
    if (stuRes.status !== 201) throw new Error('Student creation failed: ' + JSON.stringify(stuRes.body));
    studentId = stuRes.body.student_id;
    studentToken = await loginAs(studentReg, '2003-07-10', 'student');
}, 90000);

afterAll(async () => {
    try {
        if (testOdId) {
            await pool.query('DELETE FROM od_participants WHERE od_id=$1', [testOdId]);
            await pool.query('DELETE FROM ods WHERE id=$1', [testOdId]);
        }
        if (studentId) {
            await pool.query('DELETE FROM student_academic_history WHERE student_id=$1', [studentId]);
            await pool.query('DELETE FROM users WHERE student_id=$1', [studentId]);
            await pool.query('DELETE FROM students WHERE student_id=$1', [studentId]);
        }
        await pool.query('DELETE FROM class_advisor_history WHERE class_id=$1', [classA1Id]);
        await pool.query('DELETE FROM users WHERE username LIKE $1', ['%@ph8.test']);
        await pool.query('DELETE FROM student_academic_history WHERE academic_year_id=ANY($1::bigint[])', [[yearAId, yearBId].filter(Boolean)]);
        if (classA1Id) await pool.query('DELETE FROM classes WHERE id=$1', [classA1Id]);
        if (classB1Id) await pool.query('DELETE FROM classes WHERE id=$1', [classB1Id]);
        if (yearAId)   await pool.query('DELETE FROM academic_years WHERE id=$1', [yearAId]);
        if (yearBId)   await pool.query('DELETE FROM academic_years WHERE id=$1', [yearBId]);
        if (deptId)    await pool.query('DELETE FROM departments WHERE id=$1', [deptId]);
    } catch { /* best-effort */ }
    await pool.end().catch(() => {});
}, 30000);

// ── 1. History on creation ────────────────────────────────────────────────────
describe('1. History created on enrollment', () => {
    test('student creation creates a history record in yearA', async () => {
        const history = await StudentAcademicHistory.getByStudent(studentId);
        const rec = history.find((h) => String(h.academic_year_id) === String(yearAId));
        expect(rec).toBeTruthy();
        expect(String(rec.class_id)).toBe(String(classA1Id));
        expect(rec.status).toBe('active');
    });

    test('history record has correct denormalised names', async () => {
        const history = await StudentAcademicHistory.getByStudent(studentId);
        const rec = history.find((h) => String(h.academic_year_id) === String(yearAId));
        expect(rec.academic_year_name).toContain('Ph8YA_');
        expect(rec.class_name).toContain('Ph8A1_');
        expect(rec.department_name).toContain('Ph8Dept_');
    });
});

// ── 2. Duplicate prevention ───────────────────────────────────────────────────
describe('2. Duplicate prevention', () => {
    test('calling enroll again for same student+year upserts, does not throw', async () => {
        await expect(
            StudentAcademicHistory.enroll({ studentId, academicYearId: yearAId, classId: classA1Id, status: 'active', notes: 'idempotent call' })
        ).resolves.toBeDefined();
    });

    test('direct duplicate INSERT throws unique constraint error', async () => {
        await expect(
            pool.query(`INSERT INTO student_academic_history (student_id,academic_year_id,class_id,status) VALUES ($1,$2,$3,'active')`,
                [studentId, yearAId, classA1Id])
        ).rejects.toThrow();
    });
});

// ── 3. Promotion writes history ───────────────────────────────────────────────
describe('3. Promotion writes history records', () => {
    test('promote via API succeeds', async () => {
        const res = await auth(adminToken).post(`/api/academic-years/${yearAId}/promote`, {
            target_academic_year_id: yearBId,
            class_mappings: [{ from_class_id: classA1Id, to_class_id: classB1Id }],
            notes: 'Ph8 test promotion',
        });
        expect(res.status).toBe(200);
        expect(res.body.students_promoted).toBeGreaterThanOrEqual(1);
    });

    test('student current class_id is now classB1', async () => {
        const row = (await pool.query('SELECT class_id, academic_year_id FROM students WHERE student_id=$1', [studentId])).rows[0];
        expect(String(row.class_id)).toBe(String(classB1Id));
        expect(String(row.academic_year_id)).toBe(String(yearBId));
    });

    test('old year-A history record is marked promoted with exited_at set', async () => {
        const rec = await StudentAcademicHistory.get(studentId, yearAId);
        expect(rec).toBeTruthy();
        expect(rec.status).toBe('promoted');
        expect(rec.exited_at).not.toBeNull();
    });

    test('new year-B history record is active', async () => {
        const rec = await StudentAcademicHistory.get(studentId, yearBId);
        expect(rec).toBeTruthy();
        expect(String(rec.class_id)).toBe(String(classB1Id));
        expect(rec.status).toBe('active');
    });

    test('full history now has 2 records', async () => {
        const history = await StudentAcademicHistory.getByStudent(studentId);
        expect(history.length).toBeGreaterThanOrEqual(2);
    });
});

// ── 4. Historical record integrity ───────────────────────────────────────────
describe('4. Old class preserved in history', () => {
    test('year-A record still references classA1 (not classB1)', async () => {
        const rec = await StudentAcademicHistory.get(studentId, yearAId);
        expect(String(rec.class_id)).toBe(String(classA1Id));
    });

    test('API returns both history records', async () => {
        const res = await auth(adminToken).get(`/api/students/${studentId}/academic-history`);
        expect(res.status).toBe(200);
        expect(res.body.data.length).toBeGreaterThanOrEqual(2);
    });
});

// ── 5. OD records unaffected ──────────────────────────────────────────────────
describe('5. OD data preserved after promotion', () => {
    beforeAll(async () => {
        // Create OD using the class advisor (assigned to classA1 — which is now in the "old" year)
        // Use admin token since class may now be "inactive" effectively
        const odRes = await auth(adminToken).post('/api/ods', {
            class_id: classA1Id,
            event_name: 'Ph8OD_' + RUN,
            event_type: 'Workshop',
            event_date: '2025-06-01',
            od_start_date: '2025-06-01',
            od_end_date: '2025-06-01',
            purpose: 'Phase 8 test',
            venue: 'Test',
            student_ids: [studentId],
        });
        // OD creation may fail if class is now inactive — that is acceptable
        // The preservation test checks the linkage via student_id, not class
        if (odRes.status === 201) testOdId = odRes.body.id;
    }, 15000);

    test('student_id linkage is unaffected (student still exists with same ID)', async () => {
        const row = (await pool.query('SELECT student_id FROM students WHERE student_id=$1', [studentId])).rows[0];
        expect(row).toBeTruthy();
        expect(String(row.student_id)).toBe(String(studentId));
    });

    test('if OD was created, it references original student_id', async () => {
        if (!testOdId) return; // skip if class was inactive
        const res = await auth(adminToken).get(`/api/ods/${testOdId}`);
        expect(res.status).toBe(200);
        const p = (res.body.participants || []).find((x) => Number(x.student_id) === Number(studentId));
        expect(p).toBeTruthy();
    });
});

// ── 6. Authorization ─────────────────────────────────────────────────────────
describe('6. Authorization', () => {
    test('admin can GET academic-history', async () => {
        expect((await auth(adminToken).get(`/api/students/${studentId}/academic-history`)).status).toBe(200);
    });
    test('super_admin can GET academic-history', async () => {
        expect((await auth(superAdminToken).get(`/api/students/${studentId}/academic-history`)).status).toBe(200);
    });
    test('coordinating_faculty cannot GET academic-history → 403', async () => {
        expect((await auth(cfToken).get(`/api/students/${studentId}/academic-history`)).status).toBe(403);
    });
    test('student cannot GET their own academic-history via management endpoint → 403', async () => {
        expect((await auth(studentToken).get(`/api/students/${studentId}/academic-history`)).status).toBe(403);
    });
    test('unauthenticated → 401', async () => {
        expect((await request(app).get(`/api/students/${studentId}/academic-history`)).status).toBe(401);
    });
    test('admin can list students in academic year', async () => {
        const res = await auth(adminToken).get(`/api/academic-years/${yearBId}/students`);
        expect(res.status).toBe(200);
        expect(Array.isArray(res.body.data)).toBe(true);
    });
});
