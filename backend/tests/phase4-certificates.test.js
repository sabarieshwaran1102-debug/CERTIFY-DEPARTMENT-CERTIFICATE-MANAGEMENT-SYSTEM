/**
 * Phase 4 Certificate Management Integration Tests
 * Real HTTP + DB via Supertest.
 */
import request from 'supertest';
import app from '../src/app.js';
import pool from '../src/config/database.js';
import bcrypt from 'bcrypt';
import { computeDeadline, isLateSubmission } from '../src/models/OdCertificate.js';

// ── Unique run prefix ─────────────────────────────────────────────────────────
const RUN = Date.now().toString(36).slice(-6).toUpperCase();
let seq = 0;
const uid = (label) => ('C' + RUN + label.slice(0,3) + String(++seq).padStart(3,'0')).slice(0,20);

// ── Dynamic date helpers ──────────────────────────────────────────────────────
// Produces a YYYY-MM-DD string offset by `monthOffset` whole months from today.
// dayOfMonth is clamped to the actual month length to prevent overflow.
const isoDate = (monthOffset = 0, dayOfMonth = 10) => {
  const d = new Date();
  d.setDate(1); // prevent day-overflow when changing month
  d.setMonth(d.getMonth() + monthOffset);
  const maxDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  d.setDate(Math.min(dayOfMonth, maxDay));
  return d.toISOString().slice(0, 10);
};

// ① Normal OD  — event NEXT calendar month; deadline = last day of that month (always future)
const OD_DATE_NORMAL  = isoDate(+1, 10);
// ② Late OD    — event 6 months ago; deadline = last day of that month (always past)
const OD_DATE_LATE    = isoDate(-6, 15);
// ③ Late OD-2  — 2 years ago (student-cannot-approve-own test)
const OD_DATE_LATE2   = isoDate(-24, 1);
// ④ Late OD-3  — 3 years ago (reject-late test)
const OD_DATE_LATE3   = isoDate(-36, 1);
// ⑤ Reject OD  — 2 months future; deadline safely future
const OD_DATE_REJECT  = isoDate(+2, 1);
// ⑥ Access OD  — 1 month future; deadline safely future
const OD_DATE_ACCESS  = isoDate(+1, 20);
// ⑦ Overdue OD — 3 years ago; deadline definitely in the past
const OD_DATE_OVERDUE = isoDate(-36, 1);
// Last day of the month 3 years ago — used as the explicit past deadline in the overdue INSERT
const OD_DEADLINE_OVERDUE = (() => {
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() - 36);
  return new Date(d.getFullYear(), d.getMonth() + 1, 0).toISOString().slice(0, 10);
})();

// ── Shared state ──────────────────────────────────────────────────────────────
let adminToken, advisorToken, superAdminToken, studentToken, crToken;
let adminUserId, advisorUserId, superAdminUserId, studentUserId;
let testClassId, testDeptId, testYearId;
let testOdId, participantStudentId, participantStudentReg;
let nonParticipantStudentId;
let crStudentId, crUserId;

// ── Helpers ───────────────────────────────────────────────────────────────────
const api = (token) => ({
  get:   (url, p) => request(app).get(url).set('Authorization','Bearer '+token).query(p||{}),
  post:  (url, b) => request(app).post(url).set('Authorization','Bearer '+token).send(b||{}),
  patch: (url, b) => request(app).patch(url).set('Authorization','Bearer '+token).send(b||{}),
});

const login = async (u, p, r) => {
  const res = await request(app).post('/api/auth/login').send({username:u, password:p, role:r});
  if (res.status!==200) throw new Error('Login failed for '+u+': '+JSON.stringify(res.body));
  return res.body;
};

// Minimal PDF-like buffer for file uploads
const fakePdf = () => Buffer.from('%PDF-1.4 fake test certificate content', 'utf8');

const uploadCert = (token, odId, opts={}) =>
  request(app)
    .post('/api/od-certificates')
    .set('Authorization','Bearer '+token)
    .field('od_id', String(odId))
    .field('student_id', String(opts.studentId || ''))
    .field('late_reason', opts.lateReason || '')
    .attach('file', fakePdf(), { filename: opts.filename||'cert.pdf', contentType:'application/pdf' });

// ── Setup / Teardown ──────────────────────────────────────────────────────────
beforeAll(async () => {
  const pw  = await bcrypt.hash('TestPass123!', 12);
  const saw = await bcrypt.hash('SAPass123!',   12);

  const sa = await pool.query('INSERT INTO users (username,role,password_hash) VALUES ($1,$2,$3) RETURNING user_id',
    ['csa_'+RUN+'@t.com','super_admin',saw]);
  superAdminUserId = sa.rows[0].user_id;
  superAdminToken = (await login('csa_'+RUN+'@t.com','SAPass123!','super_admin')).token;

  const ad = await pool.query('INSERT INTO users (username,role,password_hash) VALUES ($1,$2,$3) RETURNING user_id',
    ['cadm_'+RUN+'@t.com','admin',pw]);
  adminUserId = ad.rows[0].user_id;
  adminToken = (await login('cadm_'+RUN+'@t.com','TestPass123!','admin')).token;

  // Dept / Year / Class
  const dp = await pool.query('INSERT INTO departments (name,code) VALUES ($1,$2) ON CONFLICT (code) DO UPDATE SET name=EXCLUDED.name RETURNING id',
    ['CertDept_'+RUN,'CD'+RUN.slice(0,4)]);
  testDeptId = dp.rows[0].id;

  const yr = await pool.query('INSERT INTO academic_years (name) VALUES ($1) ON CONFLICT (name) DO UPDATE SET name=EXCLUDED.name RETURNING id',
    ['CY_'+RUN]);
  testYearId = yr.rows[0].id;

  const cls = await pool.query(
    'INSERT INTO classes (department_id,academic_year_id,year_of_study,section,display_name) VALUES ($1,$2,$3,$4,$5) ON CONFLICT (department_id,academic_year_id,year_of_study,section) DO UPDATE SET display_name=EXCLUDED.display_name RETURNING id',
    [testDeptId,testYearId,'1st Year','A','CertCls_'+RUN]);
  testClassId = cls.rows[0].id;

  // Class advisor
  const adv = await pool.query('INSERT INTO users (username,role,password_hash) VALUES ($1,$2,$3) RETURNING user_id',
    ['cadv_'+RUN+'@t.com','class_advisor',pw]);
  advisorUserId = adv.rows[0].user_id;
  await pool.query('INSERT INTO class_advisor_history (class_id,user_id,changed_by) VALUES ($1,$2,$3)',
    [testClassId, advisorUserId, adminUserId]);
  advisorToken = (await login('cadv_'+RUN+'@t.com','TestPass123!','class_advisor')).token;

  // Participant student
  const stuReg = uid('PST');
  const stu = await pool.query(
    'INSERT INTO students (register_number,name,department,year,section,date_of_birth,class_id,academic_year_id) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING student_id',
    [stuReg,'Cert Stu','CertDept','1st Year','A','2003-03-15',testClassId,testYearId]);
  participantStudentId = stu.rows[0].student_id;
  participantStudentReg = stuReg;
  await pool.query('INSERT INTO users (username,role,student_id,password_hash) VALUES ($1,$2,$3,$4)',
    [stuReg,'student',participantStudentId,await bcrypt.hash('2003-03-15',12)]);
  const stuLogin = await login(stuReg,'2003-03-15','student');
  studentToken  = stuLogin.token;
  studentUserId = stuLogin.user.user_id;

  // Non-participant student (different class)
  const npReg = uid('NPS');
  const np = await pool.query(
    'INSERT INTO students (register_number,name,department,year,section,date_of_birth,class_id,academic_year_id) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING student_id',
    [npReg,'Non Part Stu','CertDept','1st Year','A','2003-04-01',testClassId,testYearId]);
  nonParticipantStudentId = np.rows[0].student_id;
  await pool.query('INSERT INTO users (username,role,student_id,password_hash) VALUES ($1,$2,$3,$4)',
    [npReg,'student',nonParticipantStudentId,await bcrypt.hash('2003-04-01',12)]);

  // CR student
  const crReg = uid('CRS');
  const crs = await pool.query(
    'INSERT INTO students (register_number,name,department,year,section,date_of_birth,class_id,academic_year_id) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING student_id',
    [crReg,'CR Student','CertDept','1st Year','A','2003-05-01',testClassId,testYearId]);
  crStudentId = crs.rows[0].student_id;
  await pool.query('INSERT INTO class_representatives (class_id,student_id,assigned_by) VALUES ($1,$2,$3)',
    [testClassId, crStudentId, adminUserId]);
  const crUser = await pool.query(
    'INSERT INTO users (username,role,student_id,password_hash,class_id) VALUES ($1,$2,$3,$4,$5) RETURNING user_id',
    [crReg,'class_representative',crStudentId,await bcrypt.hash('2003-05-01',12),testClassId]);
  crUserId = crUser.rows[0].user_id;
  crToken = (await login(crReg,'2003-05-01','class_representative')).token;

  // Create the main OD — event_date is NEXT month so deadline is always in the future.
  // This ensures on-time certificate submissions are not treated as late.
  const odRes = await api(adminToken).post('/api/ods', {
    class_id: testClassId,
    event_name: 'CertTest Event '+RUN,
    event_type: 'conference',
    event_date: OD_DATE_NORMAL,
    od_start_date: OD_DATE_NORMAL,
    od_end_date: OD_DATE_NORMAL,
    purpose: 'Phase 4 cert test',
    venue: 'Test Venue',
    student_ids: [participantStudentId, crStudentId],
  });
  if (odRes.status!==201) throw new Error('OD creation failed: '+JSON.stringify(odRes.body));
  testOdId = odRes.body.id;
}, 60000);

afterAll(async () => {
  try {
    await pool.query('DELETE FROM certificate_versions WHERE od_certificate_id IN (SELECT id FROM od_certificates WHERE od_id=$1)',[testOdId]);
    await pool.query('DELETE FROM od_certificates WHERE od_id=$1',[testOdId]);
    await pool.query('DELETE FROM od_participants WHERE od_id=$1',[testOdId]);
    await pool.query('DELETE FROM ods WHERE id=$1',[testOdId]);
    await pool.query('DELETE FROM class_representatives WHERE class_id=$1',[testClassId]);
    await pool.query('DELETE FROM class_advisor_history WHERE class_id=$1',[testClassId]);
    await pool.query('DELETE FROM users WHERE student_id IN ($1,$2,$3)',[participantStudentId,nonParticipantStudentId,crStudentId]);
    await pool.query('DELETE FROM students WHERE class_id=$1',[testClassId]);
    await pool.query('DELETE FROM classes WHERE id=$1',[testClassId]);
    await pool.query('DELETE FROM departments WHERE id=$1',[testDeptId]);
    await pool.query('DELETE FROM academic_years WHERE id=$1',[testYearId]);
    if (crUserId) await pool.query('DELETE FROM users WHERE user_id=$1',[crUserId]);
    for (const id of [adminUserId,advisorUserId,superAdminUserId].filter(Boolean)) {
      await pool.query('DELETE FROM audit_events WHERE actor_user_id=$1',[id]);
      await pool.query('DELETE FROM users WHERE user_id=$1',[id]);
    }
  } catch { /* best-effort */ }
  await pool.end();
}, 30000);

// =============================================================================
// 1. DEADLINE LOGIC UNIT TESTS
// =============================================================================
describe('Deadline calculation', () => {
  // These tests exercise the computeDeadline() function directly with fixed inputs.
  // They are NOT database scenarios and must NOT use dynamic dates.
  test('deadline is last day of the OD end-date month', () => {
    expect(computeDeadline('2026-09-10')).toBe('2026-09-30');
    expect(computeDeadline('2026-02-15')).toBe('2026-02-28');
    expect(computeDeadline('2024-02-01')).toBe('2024-02-29'); // leap year
    expect(computeDeadline('2026-12-25')).toBe('2026-12-31');
  });

  test('isLateSubmission returns false when deadline is in the future', () => {
    const future = new Date();
    future.setDate(future.getDate() + 30);
    const ds = future.toISOString().slice(0,10);
    expect(isLateSubmission(ds)).toBe(false);
  });

  test('isLateSubmission returns true when deadline is in the past', () => {
    expect(isLateSubmission('2020-01-01')).toBe(true);
  });
});

// =============================================================================
// 2. CERTIFICATE SUBMISSION
// =============================================================================
describe('Certificate submission', () => {
  let certId;

  test('Participant student submits certificate', async () => {
    const res = await uploadCert(studentToken, testOdId);
    expect(res.status).toBe(201);
    expect(res.body.od_id).toBe(testOdId);
    expect(res.body.status).toBe('submitted');
    expect(res.body.student_id).toBe(participantStudentId);
    expect(res.body.version).toBe(1);
    certId = res.body.id;
  });

  test('Certificate response includes OD and student metadata', async () => {
    expect(certId).toBeDefined();
    const cert = (await api(adminToken).get('/api/od-certificates/'+certId)).body;
    expect(cert.od_number).toMatch(/^OD-\d{4}-\d{6}$/);
    expect(cert.register_number).toBe(participantStudentReg);
    expect(cert.deadline).toBeTruthy();
  });

  test('Non-participant student cannot submit for this OD', async () => {
    const npLogin = await login(
      (await pool.query('SELECT register_number FROM students WHERE student_id=$1',[nonParticipantStudentId])).rows[0].register_number,
      '2003-04-01','student'
    );
    const res = await request(app).post('/api/od-certificates')
      .set('Authorization','Bearer '+npLogin.token)
      .field('od_id', String(testOdId))
      .attach('file', fakePdf(), {filename:'c.pdf',contentType:'application/pdf'});
    expect(res.status).toBe(403);
  });

  test('Student without auth returns 401', async () => {
    const res = await request(app).post('/api/od-certificates')
      .field('od_id', String(testOdId))
      .attach('file', fakePdf(), {filename:'c.pdf',contentType:'application/pdf'});
    expect(res.status).toBe(401);
  });

  test('Missing od_id returns 400', async () => {
    const res = await request(app).post('/api/od-certificates')
      .set('Authorization','Bearer '+studentToken)
      .attach('file', fakePdf(), {filename:'c.pdf',contentType:'application/pdf'});
    expect(res.status).toBe(400);
  });

  test('Missing file returns 400', async () => {
    const res = await api(studentToken).post('/api/od-certificates', { od_id: testOdId });
    expect(res.status).toBe(400);
  });

  test('Invalid file type rejected', async () => {
    const res = await request(app).post('/api/od-certificates')
      .set('Authorization','Bearer '+studentToken)
      .field('od_id', String(testOdId))
      .attach('file', Buffer.from('fake'), {filename:'bad.exe',contentType:'application/octet-stream'});
    expect(res.status).toBe(400);
  });

  test('Admin cannot submit certificate (wrong role)', async () => {
    const res = await uploadCert(adminToken, testOdId);
    expect(res.status).toBe(403);
  });

  test('Audit event created on submission', async () => {
    expect(certId).toBeDefined();
    const r = await api(superAdminToken).get('/api/audit/od_certificate/'+certId);
    expect(r.status).toBe(200);
    expect(r.body.data.map(e=>e.action)).toContain('CERTIFICATE_SUBMITTED');
  });
});

// =============================================================================
// 3. CERTIFICATE REPLACEMENT (versioning)
// =============================================================================
describe('Certificate replacement', () => {
  let certIdForReplace;

  beforeAll(async () => {
    // Use crStudent's participant slot — same main OD whose deadline is in the future.
    const firstUpload = await request(app).post('/api/od-certificates')
      .set('Authorization','Bearer '+crToken)
      .field('od_id', String(testOdId))
      .field('student_id', String(crStudentId))
      .attach('file', fakePdf(), {filename:'v1.pdf',contentType:'application/pdf'});
    if (firstUpload.status !== 201) throw new Error('Initial CR cert upload failed: '+JSON.stringify(firstUpload.body));
    certIdForReplace = firstUpload.body.id;
  }, 15000);

  test('CR replaces own certificate — version increments', async () => {
    const res = await request(app).post('/api/od-certificates')
      .set('Authorization','Bearer '+crToken)
      .field('od_id', String(testOdId))
      .field('student_id', String(crStudentId))
      .attach('file', fakePdf(), {filename:'v2.pdf',contentType:'application/pdf'});
    expect(res.status).toBe(200);
    expect(res.body.version).toBe(2);
    expect(res.body.status).toBe('submitted');
    certIdForReplace = res.body.id;
  });

  test('Version history has previous version', async () => {
    const r = await api(adminToken).get('/api/od-certificates/'+certIdForReplace+'/versions');
    expect(r.status).toBe(200);
    expect(r.body.data.length).toBeGreaterThanOrEqual(1);
    expect(r.body.data[0].version).toBe(1);
    expect(r.body.current_version).toBe(2);
  });

  test('Replace audit event recorded', async () => {
    const r = await api(superAdminToken).get('/api/audit/od_certificate/'+certIdForReplace);
    expect(r.status).toBe(200);
    const actions = r.body.data.map(e=>e.action);
    expect(actions).toContain('CERTIFICATE_REPLACED');
  });
});

// =============================================================================
// 4. LATE SUBMISSION
// =============================================================================
describe('Late submission', () => {
  let lateOdId, lateCertId;

  beforeAll(async () => {
    // Create a separate OD 6 months in the past so its deadline has definitely passed.
    const odRes = await api(adminToken).post('/api/ods', {
      class_id: testClassId,
      event_name: 'Late Test OD '+RUN,
      event_type: 'workshop',
      event_date: OD_DATE_LATE,
      od_start_date: OD_DATE_LATE,
      od_end_date: OD_DATE_LATE,
      purpose: 'late cert test',
      venue: 'Venue',
      student_ids: [participantStudentId],
    });
    if (odRes.status!==201) throw new Error('Late OD creation failed: '+JSON.stringify(odRes.body));
    lateOdId = odRes.body.id;
  }, 15000);

  afterAll(async () => {
    if (lateOdId) {
      await pool.query('DELETE FROM certificate_versions WHERE od_certificate_id IN (SELECT id FROM od_certificates WHERE od_id=$1)',[lateOdId]);
      await pool.query('DELETE FROM od_certificates WHERE od_id=$1',[lateOdId]);
      await pool.query('DELETE FROM od_participants WHERE od_id=$1',[lateOdId]);
      await pool.query('DELETE FROM ods WHERE id=$1',[lateOdId]);
    }
  });

  test('Late submission without reason returns 400', async () => {
    const res = await uploadCert(studentToken, lateOdId);
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/late_reason/i);
  });

  test('Late submission with reason succeeds', async () => {
    const res = await request(app).post('/api/od-certificates')
      .set('Authorization','Bearer '+studentToken)
      .field('od_id', String(lateOdId))
      .field('late_reason', 'Medical emergency — hospital admission')
      .attach('file', fakePdf(), {filename:'late.pdf',contentType:'application/pdf'});
    expect(res.status).toBe(201);
    expect(res.body.status).toBe('late_submitted');
    expect(res.body.is_late).toBe(true);
    lateCertId = res.body.id;
  });

  test('Advisor can approve late submission', async () => {
    expect(lateCertId).toBeDefined();
    const r = await api(advisorToken).patch('/api/od-certificates/'+lateCertId+'/approve-late');
    expect(r.status).toBe(200);
    expect(r.body.status).toBe('submitted');
    expect(r.body.late_approved_by).toBeTruthy();
  });

  test('Approve-late audit event recorded', async () => {
    const r = await api(superAdminToken).get('/api/audit/od_certificate/'+lateCertId);
    expect(r.status).toBe(200);
    expect(r.body.data.map(e=>e.action)).toContain('CERTIFICATE_LATE_APPROVED');
  });

  test('Student cannot approve their own late submission', async () => {
    // OD 2 years in the past — deadline is definitely expired
    const odRes2 = await api(adminToken).post('/api/ods', {
      class_id: testClassId, event_name: 'Late2 '+RUN, event_type: 'symposium',
      event_date: OD_DATE_LATE2, od_start_date: OD_DATE_LATE2, od_end_date: OD_DATE_LATE2,
      purpose: 'test', venue: 'V', student_ids: [participantStudentId],
    });
    const od2Id = odRes2.body.id;
    const upload2 = await request(app).post('/api/od-certificates')
      .set('Authorization','Bearer '+studentToken)
      .field('od_id', String(od2Id))
      .field('late_reason', 'Personal reason')
      .attach('file', fakePdf(), {filename:'late2.pdf',contentType:'application/pdf'});
    const cid = upload2.body.id;

    const reject = await api(studentToken).patch('/api/od-certificates/'+cid+'/approve-late');
    expect(reject.status).toBe(403);

    await pool.query('DELETE FROM certificate_versions WHERE od_certificate_id=$1',[cid]);
    await pool.query('DELETE FROM od_certificates WHERE id=$1',[cid]);
    await pool.query('DELETE FROM od_participants WHERE od_id=$1',[od2Id]);
    await pool.query('DELETE FROM ods WHERE id=$1',[od2Id]);
  });

  test('Reject-late requires reason', async () => {
    // OD 3 years in the past — deadline definitely expired
    const odRes3 = await api(adminToken).post('/api/ods', {
      class_id: testClassId, event_name: 'Late3 '+RUN, event_type: 'other',
      event_date: OD_DATE_LATE3, od_start_date: OD_DATE_LATE3, od_end_date: OD_DATE_LATE3,
      purpose: 'test', venue: 'V', student_ids: [participantStudentId],
    });
    const od3Id = odRes3.body.id;
    const upload3 = await request(app).post('/api/od-certificates')
      .set('Authorization','Bearer '+studentToken)
      .field('od_id', String(od3Id)).field('late_reason','Sick')
      .attach('file', fakePdf(), {filename:'l3.pdf',contentType:'application/pdf'});
    const cid3 = upload3.body.id;

    const r = await api(advisorToken).patch('/api/od-certificates/'+cid3+'/reject-late', {});
    expect(r.status).toBe(400);

    const r2 = await api(advisorToken).patch('/api/od-certificates/'+cid3+'/reject-late', { reason: 'Insufficient evidence' });
    expect(r2.status).toBe(200);
    expect(r2.body.status).toBe('rejected');

    await pool.query('DELETE FROM certificate_versions WHERE od_certificate_id=$1',[cid3]);
    await pool.query('DELETE FROM od_certificates WHERE id=$1',[cid3]);
    await pool.query('DELETE FROM od_participants WHERE od_id=$1',[od3Id]);
    await pool.query('DELETE FROM ods WHERE id=$1',[od3Id]);
  });
});

// =============================================================================
// 5. VERIFY / REJECT
// =============================================================================
describe('Certificate verify and reject', () => {
  let verifyCertId, rejectCertId;

  beforeAll(async () => {
    // Use the cert already submitted by student in section 2
    const certs = await api(adminToken).get('/api/od-certificates', { od_id: testOdId });
    const certForStudent = certs.body.data.find(c => Number(c.student_id) === Number(participantStudentId));
    if (!certForStudent) throw new Error('Cert for participant not found');
    verifyCertId = certForStudent.id;
    rejectCertId = certForStudent.id;
  });

  test('Admin can verify a submitted certificate', async () => {
    const r = await api(adminToken).patch('/api/od-certificates/'+verifyCertId+'/verify');
    expect(r.status).toBe(200);
    expect(r.body.status).toBe('verified');
    expect(r.body.verified_by).toBeTruthy();
  });

  test('Verified certificate cannot be replaced', async () => {
    const res = await uploadCert(studentToken, testOdId);
    expect(res.status).toBe(409);
  });

  test('Cannot verify already-verified certificate', async () => {
    const r = await api(adminToken).patch('/api/od-certificates/'+verifyCertId+'/verify');
    expect(r.status).toBe(409);
  });

  test('Student cannot verify certificate', async () => {
    const r = await api(studentToken).patch('/api/od-certificates/'+verifyCertId+'/verify');
    expect(r.status).toBe(403);
  });

  test('Verify audit event recorded', async () => {
    const r = await api(superAdminToken).get('/api/audit/od_certificate/'+verifyCertId);
    expect(r.status).toBe(200);
    expect(r.body.data.map(e=>e.action)).toContain('CERTIFICATE_VERIFIED');
  });

  test('Reject requires a reason', async () => {
    // Fresh OD 2 months in the future — deadline is safely in the future for on-time submission
    const odRes = await api(adminToken).post('/api/ods', {
      class_id: testClassId, event_name: 'RejectTest '+RUN, event_type: 'conference',
      event_date: OD_DATE_REJECT, od_start_date: OD_DATE_REJECT, od_end_date: OD_DATE_REJECT,
      purpose: 'reject test', venue: 'V', student_ids: [participantStudentId],
    });
    const rOdId = odRes.body.id;
    const up = await uploadCert(studentToken, rOdId);
    const rCertId = up.body.id;

    const r1 = await api(adminToken).patch('/api/od-certificates/'+rCertId+'/reject', {});
    expect(r1.status).toBe(400);

    const r2 = await api(adminToken).patch('/api/od-certificates/'+rCertId+'/reject', { reason: 'Wrong event certificate' });
    expect(r2.status).toBe(200);
    expect(r2.body.status).toBe('rejected');
    expect(r2.body.rejection_reason).toBe('Wrong event certificate');

    await pool.query('DELETE FROM certificate_versions WHERE od_certificate_id=$1',[rCertId]);
    await pool.query('DELETE FROM od_certificates WHERE id=$1',[rCertId]);
    await pool.query('DELETE FROM od_participants WHERE od_id=$1',[rOdId]);
    await pool.query('DELETE FROM ods WHERE id=$1',[rOdId]);
  });
});

// =============================================================================
// 6. ACCESS CONTROL
// =============================================================================
describe('Access control', () => {
  test('Student can only see own certificates', async () => {
    const r = await api(studentToken).get('/api/od-certificates');
    expect(r.status).toBe(200);
    r.body.data.forEach(c => expect(Number(c.student_id)).toBe(Number(participantStudentId)));
  });

  test('Class advisor sees only own class certificates', async () => {
    const r = await api(advisorToken).get('/api/od-certificates');
    expect(r.status).toBe(200);
    r.body.data.forEach(c => expect(String(c.class_id)).toBe(String(testClassId)));
  });

  test('Admin sees all certificates (global)', async () => {
    const r = await api(adminToken).get('/api/od-certificates');
    expect(r.status).toBe(200);
    expect(r.body.pagination).toBeDefined();
  });

  test('Unauthenticated request returns 401', async () => {
    expect((await request(app).get('/api/od-certificates')).status).toBe(401);
    expect((await request(app).get('/api/od-certificates/1')).status).toBe(401);
  });

  test('Student cannot access another student cert by ID', async () => {
    const certs = await api(adminToken).get('/api/od-certificates', { od_id: testOdId });
    const crCert = certs.body.data.find(c => Number(c.student_id) === Number(crStudentId));
    if (!crCert) return;
    const r = await api(studentToken).get('/api/od-certificates/'+crCert.id);
    expect(r.status).toBe(403);
  });

  test('GET /api/od-certificates/ods/:odId returns certs for an OD', async () => {
    const r = await api(adminToken).get('/api/od-certificates/ods/'+testOdId);
    expect(r.status).toBe(200);
    expect(Array.isArray(r.body.data)).toBe(true);
  });

  test('Student accessing OD certs must be participant', async () => {
    // OD 1 month in the future — not this student's OD
    const od2Res = await api(adminToken).post('/api/ods', {
      class_id: testClassId, event_name: 'NoAccess '+RUN, event_type: 'other',
      event_date: OD_DATE_ACCESS, od_start_date: OD_DATE_ACCESS, od_end_date: OD_DATE_ACCESS,
      purpose: 'test', venue: 'V', student_ids: [crStudentId],
    });
    const od2Id = od2Res.body.id;
    const r = await api(studentToken).get('/api/od-certificates/ods/'+od2Id);
    expect(r.status).toBe(403);

    await pool.query('DELETE FROM od_participants WHERE od_id=$1',[od2Id]);
    await pool.query('DELETE FROM ods WHERE id=$1',[od2Id]);
  });
});

// =============================================================================
// 7. PAGINATION AND FILTERS
// =============================================================================
describe('Pagination and filters', () => {
  test('Pagination metadata returned', async () => {
    const r = await api(adminToken).get('/api/od-certificates', { limit: 2, offset: 0 });
    expect(r.status).toBe(200);
    expect(r.body.pagination).toBeDefined();
    expect(r.body.pagination.limit).toBe(2);
    expect(typeof r.body.pagination.total).toBe('number');
  });

  test('Filter by status', async () => {
    const r = await api(adminToken).get('/api/od-certificates', { status: 'verified' });
    expect(r.status).toBe(200);
    r.body.data.forEach(c => expect(c.status).toBe('verified'));
  });

  test('Filter by od_id', async () => {
    const r = await api(adminToken).get('/api/od-certificates', { od_id: testOdId });
    expect(r.status).toBe(200);
    r.body.data.forEach(c => expect(c.od_id).toBe(testOdId));
  });

  test('GET /pending returns submitted and late_submitted certs', async () => {
    const r = await api(advisorToken).get('/api/od-certificates/pending');
    expect(r.status).toBe(200);
    expect(Array.isArray(r.body.data)).toBe(true);
  });

  test('Student cannot access /pending', async () => {
    const r = await api(studentToken).get('/api/od-certificates/pending');
    expect(r.status).toBe(403);
  });
});

// =============================================================================
// 8. OVERDUE MARKING
// =============================================================================
describe('Overdue marking', () => {
  test('Pending certs with past deadlines are marked overdue on list request', async () => {
    // OD 3 years in the past — deadline is definitely expired
    const odRes = await api(adminToken).post('/api/ods', {
      class_id: testClassId, event_name: 'OverdueTest '+RUN, event_type: 'internship',
      event_date: OD_DATE_OVERDUE, od_start_date: OD_DATE_OVERDUE, od_end_date: OD_DATE_OVERDUE,
      purpose: 'overdue test', venue: 'V', student_ids: [participantStudentId],
    });
    const ovOdId = odRes.body.id;

    // Manually insert a pending cert with a past deadline (last day of the month 3 years ago)
    await pool.query(
      `INSERT INTO od_certificates (od_id,student_id,file_name,file_path,file_size,file_type,status,deadline,is_late,submitted_by,version)
       VALUES ($1,$2,'test.pdf','/tmp/test.pdf',100,'application/pdf','pending',$3,false,$4,1)`,
      [ovOdId, participantStudentId, OD_DEADLINE_OVERDUE, studentUserId]
    );

    // Trigger GET /ods/:odId which calls markOverdue
    const r = await api(adminToken).get('/api/od-certificates/ods/'+ovOdId);
    expect(r.status).toBe(200);
    const cert = r.body.data[0];
    expect(cert.status).toBe('overdue');

    await pool.query('DELETE FROM od_certificates WHERE od_id=$1',[ovOdId]);
    await pool.query('DELETE FROM od_participants WHERE od_id=$1',[ovOdId]);
    await pool.query('DELETE FROM ods WHERE id=$1',[ovOdId]);
  });
});
