import request from 'supertest';
import app from '../src/app.js';
import pool from '../src/config/database.js';

const login = async (username, password, role) => {
  const response = await request(app)
    .post('/api/auth/login')
    .send({ username, password, role });
  if (response.status !== 200) throw new Error(`Login failed for ${role}: ${response.status}`);
  return response.body.token;
};

const run = async () => {
  const runId = Date.now();
  const facultyUsername = `uat.faculty.${runId}@university.edu`;
  const representativeUsername = `uat.rep.${runId}@university.edu`;
  const adminToken = await login('admin@university.edu', process.env.SEED_TEST_PASSWORD, 'admin');
  const facultyResponse = await request(app)
    .post('/api/users/coordinating-faculty')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ username: facultyUsername, password: 'UAT-Faculty-2026!' });
  if (facultyResponse.status !== 201) throw new Error(`Admin faculty creation failed: ${facultyResponse.status}`);

  const facultyToken = await login(facultyUsername, 'UAT-Faculty-2026!', 'coordinating_faculty');
  const representativeResponse = await request(app)
    .post('/api/users/student-representatives')
    .set('Authorization', `Bearer ${facultyToken}`)
    .send({ username: representativeUsername, password: 'UAT-Rep-2026!' });
  if (representativeResponse.status !== 201) throw new Error(`Faculty representative creation failed: ${representativeResponse.status}`);

  const representativeToken = await login(representativeUsername, 'UAT-Rep-2026!', 'student_representative');
  const studentToken = await login('22AD001', '2004-06-15', 'student');
  const otherStudentToken = await login('22AD002', '2004-08-21', 'student');
  const studentSearch = await request(app).get('/api/students?q=22AD001').set('Authorization', `Bearer ${representativeToken}`);
  const studentId = studentSearch.body.data[0].student_id;

  const odResponse = await request(app)
    .post('/api/od-records')
    .set('Authorization', `Bearer ${representativeToken}`)
    .send({ student_id: studentId, event_details: 'Department Industry Symposium' });
  if (odResponse.status !== 201 || !/^OD-\d{4}$/.test(odResponse.body.registration_number)) throw new Error('OD registration failed');
  const odRecord = odResponse.body;

  const ownOd = await request(app).get(`/api/od-records/${odRecord.od_id}`).set('Authorization', `Bearer ${studentToken}`);
  const otherOd = await request(app).get(`/api/od-records/${odRecord.od_id}`).set('Authorization', `Bearer ${otherStudentToken}`);
  if (ownOd.status !== 200 || otherOd.status !== 403) throw new Error('OD ownership validation failed');

  const certificateResponse = await request(app)
    .post('/api/certificates')
    .set('Authorization', `Bearer ${studentToken}`)
    .field('registration_number', odRecord.registration_number)
    .attach('file', Buffer.from('%PDF-1.4 UAT certificate'), { filename: 'department-symposium.pdf', contentType: 'application/pdf' });
  if (certificateResponse.status !== 201) throw new Error('Certificate submission failed');

  const certificate = certificateResponse.body;
  const otherCertificate = await request(app).get(`/api/certificates/${certificate.certificate_id}/download`).set('Authorization', `Bearer ${otherStudentToken}`);
  const facultyCertificates = await request(app).get('/api/certificates').set('Authorization', `Bearer ${facultyToken}`);
  const month = new Date().toISOString().slice(0, 7);
  const summary = await request(app).get(`/api/reports/monthly-summary?month=${month}`).set('Authorization', `Bearer ${facultyToken}`);
  const excel = await request(app).post('/api/reports/excel').set('Authorization', `Bearer ${facultyToken}`).send({ month });
  const zip = await request(app).post('/api/reports/certificates-zip').set('Authorization', `Bearer ${facultyToken}`).send({ month });
  const studentOdCreation = await request(app).post('/api/od-records').set('Authorization', `Bearer ${studentToken}`).send({ student_id: studentId, event_details: 'Not allowed' });
  const representativeReport = await request(app).get(`/api/reports/monthly-summary?month=${month}`).set('Authorization', `Bearer ${representativeToken}`);

  if (otherCertificate.status !== 403 || facultyCertificates.status !== 200 || summary.status !== 200 || excel.status !== 200 || zip.status !== 200 || studentOdCreation.status !== 403 || representativeReport.status !== 403) {
    throw new Error('Role, certificate, or reporting validation failed');
  }

  console.log('UAT workflow passed: hierarchy, DOB login, OD, ownership, certificate, reports, Excel, ZIP, and role restrictions.');
  await pool.end();
};

run().catch(async (error) => {
  console.error(error);
  await pool.end();
  process.exit(1);
});
