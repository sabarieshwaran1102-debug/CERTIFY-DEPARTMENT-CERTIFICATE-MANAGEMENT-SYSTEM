/**
 * Phase 3A-1 OD Integration Tests — real HTTP + DB via Supertest
 */
import request from "supertest";
import app from "../src/app.js";
import pool from "../src/config/database.js";
import bcrypt from "bcrypt";

const RUN = Date.now().toString(36).slice(-6).toUpperCase();
let seq = 0;
const uid = (label) => ("T" + RUN + label.slice(0, 3) + String(++seq).padStart(3, "0")).slice(0, 20);

// ── shared fixtures ────────────────────────────────────────────────────────────
let adminToken, advisorToken, advisor2Token, superAdminToken;
let adminUserId, advisorUserId, advisor2UserId, superAdminUserId;
let studentToken, studentUserId, studentStudentId;
let testClassId, testClass2Id, testDeptId, testYearId;

// helpers
const api = (token) => ({
    get:    (url, p) => request(app).get(url).set("Authorization", "Bearer " + token).query(p || {}),
    post:   (url, b) => request(app).post(url).set("Authorization", "Bearer " + token).send(b || {}),
    patch:  (url, b) => request(app).patch(url).set("Authorization", "Bearer " + token).send(b || {}),
    delete: (url, b) => request(app).delete(url).set("Authorization", "Bearer " + token).send(b || {}),
});

const login = async (u, p, r) => {
    const res = await request(app).post("/api/auth/login").send({ username: u, password: p, role: r });
    if (res.status !== 200) throw new Error("Login failed for " + u + ": " + res.status + " " + JSON.stringify(res.body));
    return res.body;
};

const mkStudent = async (token, classId, label) => {
    const rn = uid(label || "S");
    return api(token).post("/api/students", {
        register_number: rn, name: "Stu " + label, date_of_birth: "2003-05-15", class_id: classId,
    });
};

/** Build a minimal valid OD body */
const odBody = (classId, studentIds, overrides = {}) => ({
    class_id: classId,
    event_name: "Tech Symposium " + RUN,
    event_type: "conference",
    event_date: "2026-09-15",
    od_start_date: "2026-09-15",
    od_end_date: "2026-09-15",
    purpose: "Industry exposure",
    venue: "Convention Centre",
    student_ids: studentIds,
    ...overrides,
});

// ── setup ──────────────────────────────────────────────────────────────────────
beforeAll(async () => {
    const pw  = await bcrypt.hash("TestPass123!", 12);
    const saw = await bcrypt.hash("SAPass123!", 12);

    const sa = await pool.query("INSERT INTO users (username,role,password_hash) VALUES ($1,$2,$3) RETURNING user_id",
        ["sa3_" + RUN + "@t.com", "super_admin", saw]);
    superAdminUserId = sa.rows[0].user_id;
    superAdminToken  = (await login("sa3_" + RUN + "@t.com", "SAPass123!", "super_admin")).token;

    const ad = await pool.query("INSERT INTO users (username,role,password_hash) VALUES ($1,$2,$3) RETURNING user_id",
        ["adm3_" + RUN + "@t.com", "admin", pw]);
    adminUserId = ad.rows[0].user_id;
    adminToken  = (await login("adm3_" + RUN + "@t.com", "TestPass123!", "admin")).token;

    const dp = await pool.query(
        "INSERT INTO departments (name,code) VALUES ($1,$2) ON CONFLICT (code) DO UPDATE SET name=EXCLUDED.name RETURNING id",
        ["ODDept_" + RUN, "OD" + RUN.slice(0, 4)]);
    testDeptId = dp.rows[0].id;

    const yr = await pool.query(
        "INSERT INTO academic_years (name) VALUES ($1) ON CONFLICT (name) DO UPDATE SET name=EXCLUDED.name RETURNING id",
        ["ODY_" + RUN]);
    testYearId = yr.rows[0].id;

    const c1 = await pool.query(
        "INSERT INTO classes (department_id,academic_year_id,year_of_study,section,display_name) VALUES ($1,$2,$3,$4,$5) ON CONFLICT (department_id,academic_year_id,year_of_study,section) DO UPDATE SET display_name=EXCLUDED.display_name RETURNING id",
        [testDeptId, testYearId, "2nd Year", "P", "ODC_" + RUN + "_P"]);
    testClassId = c1.rows[0].id;

    const c2 = await pool.query(
        "INSERT INTO classes (department_id,academic_year_id,year_of_study,section,display_name) VALUES ($1,$2,$3,$4,$5) ON CONFLICT (department_id,academic_year_id,year_of_study,section) DO UPDATE SET display_name=EXCLUDED.display_name RETURNING id",
        [testDeptId, testYearId, "2nd Year", "Q", "ODC_" + RUN + "_Q"]);
    testClass2Id = c2.rows[0].id;

    const a1 = await pool.query("INSERT INTO users (username,role,password_hash) VALUES ($1,$2,$3) RETURNING user_id",
        ["oadv1_" + RUN + "@t.com", "class_advisor", pw]);
    advisorUserId = a1.rows[0].user_id;
    const a2 = await pool.query("INSERT INTO users (username,role,password_hash) VALUES ($1,$2,$3) RETURNING user_id",
        ["oadv2_" + RUN + "@t.com", "class_advisor", pw]);
    advisor2UserId = a2.rows[0].user_id;

    await pool.query("INSERT INTO class_advisor_history (class_id,user_id,changed_by) VALUES ($1,$2,$3)",
        [testClassId,  advisorUserId,  adminUserId]);
    await pool.query("INSERT INTO class_advisor_history (class_id,user_id,changed_by) VALUES ($1,$2,$3)",
        [testClass2Id, advisor2UserId, adminUserId]);

    advisorToken  = (await login("oadv1_" + RUN + "@t.com", "TestPass123!", "class_advisor")).token;
    advisor2Token = (await login("oadv2_" + RUN + "@t.com", "TestPass123!", "class_advisor")).token;

    // Create a student user for student-visibility tests
    const stuRes = await api(adminToken).post("/api/students", {
        register_number: uid("STU"),
        name: "OD Test Student",
        date_of_birth: "2003-07-20",
        class_id: testClassId,
    });
    if (stuRes.status !== 201) throw new Error("Student creation failed: " + JSON.stringify(stuRes.body));
    studentStudentId = stuRes.body.student_id;
    const stuLogin = await login(stuRes.body.register_number, "2003-07-20", "student");
    studentToken   = stuLogin.token;
    studentUserId  = stuLogin.user.user_id;
}, 40000);

afterAll(async () => {
    try {
        if (testClassId) {
            await pool.query("DELETE FROM od_participants WHERE od_id IN (SELECT id FROM ods WHERE class_id IN ($1,$2))", [testClassId, testClass2Id]);
            await pool.query("DELETE FROM ods WHERE class_id IN ($1,$2)", [testClassId, testClass2Id]);
            await pool.query("DELETE FROM class_representatives WHERE class_id IN ($1,$2)", [testClassId, testClass2Id]);
            await pool.query("DELETE FROM class_advisor_history WHERE class_id IN ($1,$2)", [testClassId, testClass2Id]);
            await pool.query("DELETE FROM import_sessions WHERE class_id IN ($1,$2)", [testClassId, testClass2Id]);
            await pool.query("DELETE FROM od_records WHERE class_id IN ($1,$2)", [testClassId, testClass2Id]);
            await pool.query("DELETE FROM users WHERE student_id IN (SELECT student_id FROM students WHERE class_id IN ($1,$2))", [testClassId, testClass2Id]);
            await pool.query("DELETE FROM students WHERE class_id IN ($1,$2)", [testClassId, testClass2Id]);
            await pool.query("DELETE FROM classes WHERE id IN ($1,$2)", [testClassId, testClass2Id]);
        }
        if (testDeptId) await pool.query("DELETE FROM departments WHERE id=$1", [testDeptId]);
        if (testYearId) await pool.query("DELETE FROM academic_years WHERE id=$1", [testYearId]);
        for (const id of [adminUserId, advisorUserId, advisor2UserId, superAdminUserId].filter(Boolean)) {
            await pool.query("DELETE FROM audit_events WHERE actor_user_id=$1", [id]);
            await pool.query("DELETE FROM users WHERE user_id=$1", [id]);
        }
    } catch { /* best-effort */ }
    await pool.end();
}, 30000);

// =============================================================================
// 1. OD CREATION — individual
// =============================================================================
describe("Individual OD creation", () => {
    let createdOd;

    test("Admin creates individual OD", async () => {
        const res = await api(adminToken).post("/api/ods", odBody(testClassId, [studentStudentId]));
        expect(res.status).toBe(201);
        expect(res.body.od_number).toMatch(/^OD-\d{4}-\d{6}$/);
        expect(res.body.participants).toHaveLength(1);
        expect(res.body.class_id).toBe(testClassId);
        createdOd = res.body;
    });

    test("Created OD has correct OD number format", () => {
        expect(createdOd.od_number).toMatch(/^OD-\d{4}-\d{6}$/);
    });

    test("Created OD contains all required fields", () => {
        expect(createdOd.event_name).toBeTruthy();
        expect(createdOd.event_type).toBeTruthy();
        expect(createdOd.event_date).toBeTruthy();
        expect(createdOd.od_start_date).toBeTruthy();
        expect(createdOd.od_end_date).toBeTruthy();
        expect(createdOd.purpose).toBeTruthy();
        expect(createdOd.venue).toBeTruthy();
        expect(createdOd.department_name).toBeTruthy();
        expect(createdOd.academic_year_name).toBeTruthy();
        expect(createdOd.class_name).toBeTruthy();
        expect(createdOd.created_by_username).toBeTruthy();
        expect(createdOd.status).toBe("active");
    });

    test("GET /api/ods/:id returns the created OD", async () => {
        const res = await api(adminToken).get("/api/ods/" + createdOd.id);
        expect(res.status).toBe(200);
        expect(res.body.od_number).toBe(createdOd.od_number);
        expect(res.body.participants).toHaveLength(1);
    });
});

// =============================================================================
// 2. OD CREATION — team
// =============================================================================
describe("Team OD creation", () => {
    let teamStudent1, teamStudent2, teamStudent3;
    let teamOd;

    beforeAll(async () => {
        const s1 = await api(adminToken).post("/api/students", { register_number: uid("TM1"), name: "Team One", date_of_birth: "2003-01-10", class_id: testClassId });
        const s2 = await api(adminToken).post("/api/students", { register_number: uid("TM2"), name: "Team Two", date_of_birth: "2003-02-10", class_id: testClassId });
        const s3 = await api(adminToken).post("/api/students", { register_number: uid("TM3"), name: "Team Three", date_of_birth: "2003-03-10", class_id: testClassId });
        expect(s1.status).toBe(201);
        expect(s2.status).toBe(201);
        expect(s3.status).toBe(201);
        teamStudent1 = s1.body;
        teamStudent2 = s2.body;
        teamStudent3 = s3.body;
    }, 20000);

    test("Admin creates team OD with 3 participants", async () => {
        const res = await api(adminToken).post("/api/ods", odBody(testClassId, [
            teamStudent1.student_id,
            teamStudent2.student_id,
            teamStudent3.student_id,
        ]));
        expect(res.status).toBe(201);
        expect(res.body.participants).toHaveLength(3);
        teamOd = res.body;
    });

    test("Team OD has exactly ONE od_number for all participants", () => {
        expect(teamOd.od_number).toMatch(/^OD-\d{4}-\d{6}$/);
        // Participants share the same od_id — verified by having 3 participants under one OD
        // PostgreSQL json_build_object returns bigint as JSON integer;
        // the students API returns bigint as JSON string — normalise to Number.
        const participantIds = teamOd.participants.map((p) => Number(p.student_id));
        expect(participantIds).toEqual(
            expect.arrayContaining([
                Number(teamStudent1.student_id),
                Number(teamStudent2.student_id),
                Number(teamStudent3.student_id),
            ])
        );
    });

    test("OD numbers are unique across ODs", async () => {
        const res = await api(adminToken).post("/api/ods", odBody(testClassId, [teamStudent1.student_id], { event_name: "Second Event " + RUN }));
        expect(res.status).toBe(201);
        expect(res.body.od_number).not.toBe(teamOd.od_number);
    });
});

// =============================================================================
// 3. VALIDATION
// =============================================================================
describe("OD creation validation", () => {
    let activeStudent, inactiveStudent, otherClassStudent;

    beforeAll(async () => {
        const s1 = await api(adminToken).post("/api/students", { register_number: uid("VAL"), name: "Val Stu", date_of_birth: "2003-06-01", class_id: testClassId });
        expect(s1.status).toBe(201);
        activeStudent = s1.body;

        const s2 = await api(adminToken).post("/api/students", { register_number: uid("INV"), name: "Inactive Stu", date_of_birth: "2003-06-02", class_id: testClassId });
        expect(s2.status).toBe(201);
        // Deactivate
        const deact = await api(adminToken).patch("/api/students/" + s2.body.student_id + "/deactivate");
        expect(deact.status).toBe(200);
        inactiveStudent = s2.body;

        const s3 = await api(adminToken).post("/api/students", { register_number: uid("OCS"), name: "Other Class", date_of_birth: "2003-06-03", class_id: testClass2Id });
        expect(s3.status).toBe(201);
        otherClassStudent = s3.body;
    }, 20000);

    test("Duplicate participant IDs rejected", async () => {
        const res = await api(adminToken).post("/api/ods", odBody(testClassId, [activeStudent.student_id, activeStudent.student_id]));
        expect(res.status).toBe(400);
        expect(res.body.error).toMatch(/[Dd]uplicate/);
    });

    test("Non-existent student rejected", async () => {
        const res = await api(adminToken).post("/api/ods", odBody(testClassId, [999999999]));
        expect(res.status).toBe(404);
    });

    test("Inactive student rejected", async () => {
        const res = await api(adminToken).post("/api/ods", odBody(testClassId, [inactiveStudent.student_id]));
        expect(res.status).toBe(400);
        expect(res.body.error).toMatch(/not active/i);
    });

    test("Student from different class rejected", async () => {
        const res = await api(adminToken).post("/api/ods", odBody(testClassId, [otherClassStudent.student_id]));
        expect(res.status).toBe(400);
        expect(res.body.error).toMatch(/does not belong/i);
    });

    test("Empty participant list rejected", async () => {
        const res = await api(adminToken).post("/api/ods", odBody(testClassId, []));
        expect(res.status).toBe(400);
        expect(res.body.error).toMatch(/participant/i);
    });

    test("Missing student_ids field rejected", async () => {
        const body = { ...odBody(testClassId, [activeStudent.student_id]) };
        delete body.student_ids;
        const res = await api(adminToken).post("/api/ods", body);
        expect(res.status).toBe(400);
    });

    test("End date before start date rejected", async () => {
        const res = await api(adminToken).post("/api/ods", odBody(testClassId, [activeStudent.student_id], {
            od_start_date: "2026-09-20",
            od_end_date:   "2026-09-19",
        }));
        expect(res.status).toBe(400);
        expect(res.body.error).toMatch(/od_end_date/i);
    });

    test("Invalid date format rejected", async () => {
        const res = await api(adminToken).post("/api/ods", odBody(testClassId, [activeStudent.student_id], {
            event_date: "not-a-date",
        }));
        expect(res.status).toBe(400);
    });

    test("Missing required field rejected", async () => {
        const body = odBody(testClassId, [activeStudent.student_id]);
        delete body.event_name;
        const res = await api(adminToken).post("/api/ods", body);
        expect(res.status).toBe(400);
        expect(res.body.error).toMatch(/event_name/);
    });
});

// =============================================================================
// 4. AUTHORIZATION
// =============================================================================
describe("OD authorization", () => {
    let classStudent;
    let crToken, crUserId;

    beforeAll(async () => {
        const s = await api(adminToken).post("/api/students", {
            register_number: uid("CRS"), name: "CR Stu", date_of_birth: "2003-08-01", class_id: testClassId,
        });
        expect(s.status).toBe(201);
        classStudent = s.body;

        // Create CR user
        await pool.query(
            "INSERT INTO class_representatives (class_id,student_id,assigned_by) SELECT $1,$2,$3 WHERE NOT EXISTS (SELECT 1 FROM class_representatives WHERE class_id=$1 AND student_id=$2)",
            [testClassId, classStudent.student_id, adminUserId]
        );
        const cr = await pool.query(
            "INSERT INTO users (username,role,student_id,password_hash,class_id) VALUES ($1,$2,$3,$4,$5) RETURNING user_id",
            [classStudent.register_number, "class_representative", classStudent.student_id,
             await bcrypt.hash("2003-08-01", 12), testClassId]
        );
        crUserId  = cr.rows[0].user_id;
        crToken   = (await login(classStudent.register_number, "2003-08-01", "class_representative")).token;
    }, 20000);

    test("Class Advisor creates OD for own class", async () => {
        const s = await api(advisorToken).post("/api/students", { register_number: uid("AST"), name: "Adv Stu", date_of_birth: "2003-09-01", class_id: testClassId });
        expect(s.status).toBe(201);
        const res = await api(advisorToken).post("/api/ods", odBody(testClassId, [s.body.student_id]));
        expect(res.status).toBe(201);
    });

    test("Class Advisor cannot create OD for another class", async () => {
        // Create a student in class2
        const s = await api(adminToken).post("/api/students", { register_number: uid("XST"), name: "Cross Stu", date_of_birth: "2003-09-02", class_id: testClass2Id });
        expect(s.status).toBe(201);
        const res = await api(advisorToken).post("/api/ods", odBody(testClass2Id, [s.body.student_id]));
        expect(res.status).toBe(403);
    });

    test("CR creates OD for own class", async () => {
        const res = await api(crToken).post("/api/ods", odBody(testClassId, [classStudent.student_id]));
        expect(res.status).toBe(201);
    });

    test("CR cannot create OD for another class", async () => {
        const s = await api(adminToken).post("/api/students", { register_number: uid("XCR"), name: "CR Cross", date_of_birth: "2003-09-03", class_id: testClass2Id });
        expect(s.status).toBe(201);
        const res = await api(crToken).post("/api/ods", odBody(testClass2Id, [s.body.student_id]));
        expect(res.status).toBe(403);
    });

    test("Student cannot create OD", async () => {
        const res = await api(studentToken).post("/api/ods", odBody(testClassId, [studentStudentId]));
        expect(res.status).toBe(403);
    });

    test("Unauthenticated request returns 401", async () => {
        const res = await request(app).post("/api/ods").send(odBody(testClassId, [studentStudentId]));
        expect(res.status).toBe(401);
    });

    afterAll(async () => {
        if (crUserId) await pool.query("DELETE FROM users WHERE user_id=$1", [crUserId]).catch(() => {});
    });
});

// =============================================================================
// 5. OD READ — role-based access
// =============================================================================
describe("OD read — role-based access", () => {
    let publicOd, class2Od, class2Student;

    beforeAll(async () => {
        // Create an OD in class1
        const s = await api(adminToken).post("/api/students", {
            register_number: uid("RDS"), name: "Read Stu", date_of_birth: "2003-10-01", class_id: testClassId,
        });
        expect(s.status).toBe(201);
        const od = await api(adminToken).post("/api/ods", odBody(testClassId, [s.body.student_id], { event_name: "Read Test " + RUN }));
        expect(od.status).toBe(201);
        publicOd = od.body;

        // Create an OD in class2
        const s2 = await api(adminToken).post("/api/students", {
            register_number: uid("RS2"), name: "Read Stu2", date_of_birth: "2003-10-02", class_id: testClass2Id,
        });
        expect(s2.status).toBe(201);
        class2Student = s2.body;
        const od2 = await api(adminToken).post("/api/ods", odBody(testClass2Id, [s2.body.student_id], { event_name: "Class2 OD " + RUN }));
        expect(od2.status).toBe(201);
        class2Od = od2.body;
    }, 20000);

    test("Admin sees ODs globally", async () => {
        const res = await api(adminToken).get("/api/ods");
        expect(res.status).toBe(200);
        expect(res.body.pagination).toBeDefined();
        const ids = res.body.data.map((o) => o.id);
        expect(ids).toContain(publicOd.id);
        expect(ids).toContain(class2Od.id);
    });

    test("Class Advisor sees only own class ODs", async () => {
        const res = await api(advisorToken).get("/api/ods");
        expect(res.status).toBe(200);
        res.body.data.forEach((o) => expect(String(o.class_id)).toBe(String(testClassId)));
        // Must not see class2 OD
        expect(res.body.data.map((o) => o.id)).not.toContain(class2Od.id);
    });

    test("Student sees only ODs they participate in", async () => {
        const res = await api(studentToken).get("/api/ods");
        expect(res.status).toBe(200);
        // studentStudentId is participant only in ODs we explicitly added them to
        res.body.data.forEach((o) => {
            const isParticipant = o.participants.some((p) => String(p.student_id) === String(studentStudentId));
            expect(isParticipant).toBe(true);
        });
    });

    test("Admin retrieves OD detail by ID", async () => {
        const res = await api(adminToken).get("/api/ods/" + publicOd.id);
        expect(res.status).toBe(200);
        expect(res.body.id).toBe(publicOd.id);
        expect(Array.isArray(res.body.participants)).toBe(true);
    });

    test("Class Advisor cannot access another class OD by ID", async () => {
        // advisor1 manages class1; class2Od belongs to class2
        const res = await api(advisorToken).get("/api/ods/" + class2Od.id);
        expect(res.status).toBe(403);
    });

    test("Student cannot access OD they are not a participant of", async () => {
        // publicOd participants do not include studentStudentId (it was created with a different student)
        const isParticipant = publicOd.participants.some((p) => String(p.student_id) === String(studentStudentId));
        if (!isParticipant) {
            const res = await api(studentToken).get("/api/ods/" + publicOd.id);
            expect(res.status).toBe(403);
        } else {
            // skip if somehow they are a participant
            expect(true).toBe(true);
        }
    });

    test("Non-existent OD returns 404", async () => {
        const res = await api(adminToken).get("/api/ods/999999999");
        expect(res.status).toBe(404);
    });

    test("Unauthenticated GET returns 401", async () => {
        const res = await request(app).get("/api/ods");
        expect(res.status).toBe(401);
    });
});

// =============================================================================
// 6. PAGINATION
// =============================================================================
describe("OD pagination", () => {
    beforeAll(async () => {
        // Create 5 ODs in class1
        const s = await api(adminToken).post("/api/students", {
            register_number: uid("PGS"), name: "Pag Stu", date_of_birth: "2003-11-01", class_id: testClassId,
        });
        expect(s.status).toBe(201);
        for (let i = 0; i < 5; i++) {
            const res = await api(adminToken).post("/api/ods", odBody(testClassId, [s.body.student_id], { event_name: "Pag Event " + i + " " + RUN }));
            expect(res.status).toBe(201);
        }
    }, 30000);

    test("Pagination returns correct total and respects limit", async () => {
        const res = await api(adminToken).get("/api/ods", { limit: 2, offset: 0, class_id: testClassId });
        expect(res.status).toBe(200);
        expect(res.body.pagination).toBeDefined();
        expect(res.body.pagination.total).toBeGreaterThanOrEqual(5);
        expect(res.body.data.length).toBeLessThanOrEqual(2);
        expect(res.body.pagination.limit).toBe(2);
    });

    test("Pagination second page returns different records", async () => {
        const page1 = await api(adminToken).get("/api/ods", { limit: 2, offset: 0, class_id: testClassId });
        const page2 = await api(adminToken).get("/api/ods", { limit: 2, offset: 2, class_id: testClassId });
        expect(page1.status).toBe(200);
        expect(page2.status).toBe(200);
        const ids1 = page1.body.data.map((o) => o.id);
        const ids2 = page2.body.data.map((o) => o.id);
        // No overlap between pages
        expect(ids1.some((id) => ids2.includes(id))).toBe(false);
    });
});
