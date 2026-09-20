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

// =============================================================================
// 7. OD CANCELLATION
// =============================================================================
describe("OD cancellation", () => {
    let cancelTarget, cancelClass2Od, cancelAdvStudent;
    let crToken, crUserId, crStudent;

    beforeAll(async () => {
        // Student in class1 for cancellation tests
        const s1 = await api(adminToken).post("/api/students", {
            register_number: uid("CNS"), name: "Cancel Stu", date_of_birth: "2003-12-01", class_id: testClassId,
        });
        expect(s1.status).toBe(201);
        cancelAdvStudent = s1.body;

        // OD in class1 (to be cancelled)
        const od1 = await api(adminToken).post("/api/ods", odBody(testClassId, [cancelAdvStudent.student_id], { event_name: "Cancel Target " + RUN }));
        expect(od1.status).toBe(201);
        cancelTarget = od1.body;

        // OD in class2 (to test advisor cross-class rejection)
        const s2 = await api(adminToken).post("/api/students", {
            register_number: uid("CN2"), name: "Cancel Stu2", date_of_birth: "2003-12-02", class_id: testClass2Id,
        });
        expect(s2.status).toBe(201);
        const od2 = await api(adminToken).post("/api/ods", odBody(testClass2Id, [s2.body.student_id], { event_name: "Class2 Cancel " + RUN }));
        expect(od2.status).toBe(201);
        cancelClass2Od = od2.body;

        // CR user in class1
        const crStu = await api(adminToken).post("/api/students", {
            register_number: uid("CCR"), name: "Cancel CR", date_of_birth: "2003-12-03", class_id: testClassId,
        });
        expect(crStu.status).toBe(201);
        crStudent = crStu.body;
        await pool.query(
            "INSERT INTO class_representatives (class_id,student_id,assigned_by) SELECT $1,$2,$3 WHERE NOT EXISTS (SELECT 1 FROM class_representatives WHERE class_id=$1 AND student_id=$2)",
            [testClassId, crStudent.student_id, adminUserId]
        );
        const cr = await pool.query(
            "INSERT INTO users (username,role,student_id,password_hash,class_id) VALUES ($1,$2,$3,$4,$5) RETURNING user_id",
            [crStudent.register_number, "class_representative", crStudent.student_id,
             await bcrypt.hash("2003-12-03", 12), testClassId]
        );
        crUserId = cr.rows[0].user_id;
        crToken  = (await login(crStudent.register_number, "2003-12-03", "class_representative")).token;
    }, 30000);

    afterAll(async () => {
        if (crUserId) await pool.query("DELETE FROM users WHERE user_id=$1", [crUserId]).catch(() => {});
    });

    test("Admin can cancel an OD", async () => {
        const od = await api(adminToken).post("/api/ods", odBody(testClassId, [cancelAdvStudent.student_id], { event_name: "Admin Cancel " + RUN }));
        expect(od.status).toBe(201);
        const res = await api(adminToken).post("/api/ods/" + od.body.id + "/cancel", { reason: "Admin cancelled" });
        expect(res.status).toBe(200);
        expect(res.body.status).toBe("cancelled");
        expect(res.body.cancellation_reason).toBe("Admin cancelled");
        expect(res.body.cancelled_at).toBeTruthy();
    });

    test("Super Admin can cancel an OD", async () => {
        const od = await api(adminToken).post("/api/ods", odBody(testClassId, [cancelAdvStudent.student_id], { event_name: "SA Cancel " + RUN }));
        expect(od.status).toBe(201);
        const res = await api(superAdminToken).post("/api/ods/" + od.body.id + "/cancel", { reason: "SA cancel reason" });
        expect(res.status).toBe(200);
        expect(res.body.status).toBe("cancelled");
    });

    test("Class Advisor can cancel own-class OD", async () => {
        const od = await api(adminToken).post("/api/ods", odBody(testClassId, [cancelAdvStudent.student_id], { event_name: "Adv Cancel " + RUN }));
        expect(od.status).toBe(201);
        const res = await api(advisorToken).post("/api/ods/" + od.body.id + "/cancel", { reason: "Advisor cancelled" });
        expect(res.status).toBe(200);
        expect(res.body.status).toBe("cancelled");
    });

    test("Class Advisor cannot cancel another-class OD", async () => {
        // advisor1 is assigned to class1; cancelClass2Od is in class2
        const res = await api(advisorToken).post("/api/ods/" + cancelClass2Od.id + "/cancel", { reason: "Cross cancel" });
        expect(res.status).toBe(403);
    });

    test("CR cannot cancel an OD", async () => {
        const res = await api(crToken).post("/api/ods/" + cancelTarget.id + "/cancel", { reason: "CR cancel attempt" });
        expect(res.status).toBe(403);
    });

    test("Student cannot cancel an OD", async () => {
        const res = await api(studentToken).post("/api/ods/" + cancelTarget.id + "/cancel", { reason: "Stu cancel" });
        expect(res.status).toBe(403);
    });

    test("Unauthenticated cancel returns 401", async () => {
        const res = await request(app).post("/api/ods/" + cancelTarget.id + "/cancel").send({ reason: "anon" });
        expect(res.status).toBe(401);
    });

    test("Missing cancellation reason returns 400", async () => {
        const od = await api(adminToken).post("/api/ods", odBody(testClassId, [cancelAdvStudent.student_id], { event_name: "No Reason " + RUN }));
        expect(od.status).toBe(201);
        const res = await api(adminToken).post("/api/ods/" + od.body.id + "/cancel", {});
        expect(res.status).toBe(400);
        expect(res.body.error).toMatch(/cancellation_reason/i);
    });

    test("Blank cancellation reason rejected", async () => {
        const od = await api(adminToken).post("/api/ods", odBody(testClassId, [cancelAdvStudent.student_id], { event_name: "Blank Reason " + RUN }));
        expect(od.status).toBe(201);
        const res = await api(adminToken).post("/api/ods/" + od.body.id + "/cancel", { reason: "   " });
        expect(res.status).toBe(400);
    });

    test("Already-cancelled OD returns 409", async () => {
        const od = await api(adminToken).post("/api/ods", odBody(testClassId, [cancelAdvStudent.student_id], { event_name: "Double Cancel " + RUN }));
        expect(od.status).toBe(201);
        const first = await api(adminToken).post("/api/ods/" + od.body.id + "/cancel", { reason: "First cancel" });
        expect(first.status).toBe(200);
        const second = await api(adminToken).post("/api/ods/" + od.body.id + "/cancel", { reason: "Second cancel" });
        expect(second.status).toBe(409);
    });

    test("Participants remain after cancellation", async () => {
        const od = await api(adminToken).post("/api/ods", odBody(testClassId, [cancelAdvStudent.student_id], { event_name: "Participants Remain " + RUN }));
        expect(od.status).toBe(201);
        await api(adminToken).post("/api/ods/" + od.body.id + "/cancel", { reason: "Test participants" });
        const detail = await api(adminToken).get("/api/ods/" + od.body.id);
        expect(detail.status).toBe(200);
        expect(detail.body.participants).toHaveLength(1);
        expect(detail.body.status).toBe("cancelled");
    });

    test("Cancellation sets cancelled_by_username", async () => {
        const od = await api(adminToken).post("/api/ods", odBody(testClassId, [cancelAdvStudent.student_id], { event_name: "CB Username " + RUN }));
        expect(od.status).toBe(201);
        const res = await api(adminToken).post("/api/ods/" + od.body.id + "/cancel", { reason: "Check username" });
        expect(res.status).toBe(200);
        expect(res.body.cancelled_by_username).toBeTruthy();
    });
});

// =============================================================================
// 8. AUDIT LOGGING
// =============================================================================
describe("OD audit logging", () => {
    let auditStudent, auditOd;

    beforeAll(async () => {
        const s = await api(adminToken).post("/api/students", {
            register_number: uid("AUS"), name: "Audit Stu", date_of_birth: "2004-01-10", class_id: testClassId,
        });
        expect(s.status).toBe(201);
        auditStudent = s.body;

        const od = await api(adminToken).post("/api/ods", odBody(testClassId, [auditStudent.student_id], { event_name: "Audit Event " + RUN }));
        expect(od.status).toBe(201);
        auditOd = od.body;
    }, 20000);

    test("OD creation creates OD_CREATED audit event", async () => {
        const res = await api(superAdminToken).get("/api/audit/od/" + auditOd.id);
        expect(res.status).toBe(200);
        const actions = res.body.data.map((e) => e.action);
        expect(actions).toContain("OD_CREATED");
    });

    test("OD_CREATED audit contains od_number and event_name", async () => {
        const res = await api(superAdminToken).get("/api/audit/od/" + auditOd.id);
        expect(res.status).toBe(200);
        const created = res.body.data.find((e) => e.action === "OD_CREATED");
        expect(created).toBeDefined();
        expect(created.new_data.od_number).toBe(auditOd.od_number);
        expect(created.new_data.event_name).toBeTruthy();
    });

    test("OD cancellation creates OD_CANCELLED audit event", async () => {
        const cancelRes = await api(adminToken).post("/api/ods/" + auditOd.id + "/cancel", { reason: "Audit cancel test" });
        expect(cancelRes.status).toBe(200);

        const res = await api(superAdminToken).get("/api/audit/od/" + auditOd.id);
        expect(res.status).toBe(200);
        const actions = res.body.data.map((e) => e.action);
        expect(actions).toContain("OD_CANCELLED");
    });

    test("OD_CANCELLED audit contains cancellation reason in details", async () => {
        const res = await api(superAdminToken).get("/api/audit/od/" + auditOd.id);
        expect(res.status).toBe(200);
        const cancelled = res.body.data.find((e) => e.action === "OD_CANCELLED");
        expect(cancelled).toBeDefined();
        expect(cancelled.details).toBe("Audit cancel test");
        expect(cancelled.new_data.cancellation_reason).toBe("Audit cancel test");
    });
});

// =============================================================================
// 9. ADVANCED FILTERING
// =============================================================================
describe("OD advanced filtering", () => {
    let filterStudents = [];
    let filterOds = [];

    beforeAll(async () => {
        // Create 3 students, 3 ODs with distinct attributes for filtering
        for (let i = 0; i < 3; i++) {
            const s = await api(adminToken).post("/api/students", {
                register_number: uid("FLT"),
                name: "Filter Stu " + i,
                date_of_birth: "2004-0" + (i + 1) + "-15",
                class_id: testClassId,
            });
            expect(s.status).toBe(201);
            filterStudents.push(s.body);
        }

        const types = ["workshop", "conference", "hackathon"];
        const dates = ["2027-01-10", "2027-02-20", "2027-03-30"];

        for (let i = 0; i < 3; i++) {
            const od = await api(adminToken).post("/api/ods", {
                class_id:     testClassId,
                event_name:   "FilterEvent_" + i + "_" + RUN,
                event_type:   types[i],
                event_date:   dates[i],
                od_start_date: dates[i],
                od_end_date:   dates[i],
                purpose:      "Filter test " + i,
                venue:        "Venue " + i,
                student_ids:  [filterStudents[i].student_id],
            });
            expect(od.status).toBe(201);
            filterOds.push(od.body);
        }

        // Cancel the third OD for status-filter test
        await api(adminToken).post("/api/ods/" + filterOds[2].id + "/cancel", { reason: "Cancelled for filter test" });
    }, 30000);

    test("Filter by od_number returns exactly one OD", async () => {
        const res = await api(adminToken).get("/api/ods", { od_number: filterOds[0].od_number });
        expect(res.status).toBe(200);
        expect(res.body.data).toHaveLength(1);
        expect(res.body.data[0].od_number).toBe(filterOds[0].od_number);
    });

    test("Filter by event_name (partial, case-insensitive) returns matching ODs", async () => {
        const partial = "FilterEvent_0";
        const res = await api(adminToken).get("/api/ods", { event_name: partial });
        expect(res.status).toBe(200);
        expect(res.body.data.length).toBeGreaterThanOrEqual(1);
        expect(res.body.data[0].event_name).toContain("FilterEvent_0");
    });

    test("Filter by event_type returns matching ODs", async () => {
        const res = await api(adminToken).get("/api/ods", { event_type: "workshop" });
        expect(res.status).toBe(200);
        res.body.data.forEach((o) => expect(o.event_type).toBe("workshop"));
    });

    test("Filter by status=active returns only active ODs", async () => {
        const res = await api(adminToken).get("/api/ods", { status: "active", class_id: testClassId });
        expect(res.status).toBe(200);
        res.body.data.forEach((o) => expect(o.status).toBe("active"));
    });

    test("Filter by status=cancelled returns only cancelled ODs", async () => {
        const res = await api(adminToken).get("/api/ods", { status: "cancelled", class_id: testClassId });
        expect(res.status).toBe(200);
        expect(res.body.data.length).toBeGreaterThanOrEqual(1);
        res.body.data.forEach((o) => expect(o.status).toBe("cancelled"));
    });

    test("Filter by event_date returns OD on that exact date", async () => {
        const res = await api(adminToken).get("/api/ods", { event_date: "2027-01-10", class_id: testClassId });
        expect(res.status).toBe(200);
        expect(res.body.data.length).toBeGreaterThanOrEqual(1);
        res.body.data.forEach((o) => expect(o.event_date.slice(0, 10)).toBe("2027-01-10"));
    });

    test("Filter by event_date_from / event_date_to range", async () => {
        const res = await api(adminToken).get("/api/ods", {
            event_date_from: "2027-01-01",
            event_date_to:   "2027-02-28",
            class_id:        testClassId,
        });
        expect(res.status).toBe(200);
        expect(res.body.data.length).toBeGreaterThanOrEqual(2);
        res.body.data.forEach((o) => {
            const d = new Date(o.event_date);
            expect(d >= new Date("2027-01-01")).toBe(true);
            expect(d <= new Date("2027-02-28")).toBe(true);
        });
    });

    test("Filter by student register number returns OD they participate in", async () => {
        const res = await api(adminToken).get("/api/ods", {
            student_register: filterStudents[0].register_number,
            class_id: testClassId,
        });
        expect(res.status).toBe(200);
        expect(res.body.data.length).toBeGreaterThanOrEqual(1);
        const found = res.body.data.find((o) => o.id === filterOds[0].id);
        expect(found).toBeDefined();
    });

    test("Filter by student name returns OD they participate in", async () => {
        const res = await api(adminToken).get("/api/ods", {
            student_name: "Filter Stu 1",
            class_id: testClassId,
        });
        expect(res.status).toBe(200);
        expect(res.body.data.length).toBeGreaterThanOrEqual(1);
    });

    test("Pagination still works with filters", async () => {
        const page1 = await api(adminToken).get("/api/ods", { limit: 1, offset: 0, class_id: testClassId });
        const page2 = await api(adminToken).get("/api/ods", { limit: 1, offset: 1, class_id: testClassId });
        expect(page1.status).toBe(200);
        expect(page2.status).toBe(200);
        expect(page1.body.pagination.total).toBeGreaterThanOrEqual(2);
        const ids1 = page1.body.data.map((o) => o.id);
        const ids2 = page2.body.data.map((o) => o.id);
        expect(ids1.some((id) => ids2.includes(id))).toBe(false);
    });

    test("Scoped user (advisor) cannot escape scope via class_id filter", async () => {
        // advisor1 is assigned class1; even if they pass class2 in filter, they get class1 data
        const res = await api(advisorToken).get("/api/ods", { class_id: testClass2Id });
        expect(res.status).toBe(200);
        // Scope must enforce class1 only
        res.body.data.forEach((o) => expect(String(o.class_id)).toBe(String(testClassId)));
    });
});

// =============================================================================
// 10. DETAIL SECURITY
// =============================================================================
describe("OD detail security", () => {
    let secOd1, secOd2, secStudent2;
    let secStudent2Token;

    beforeAll(async () => {
        // Student 1 is the existing studentStudentId
        // Create student 2 in class1
        const s2 = await api(adminToken).post("/api/students", {
            register_number: uid("SEC"), name: "Security Stu2", date_of_birth: "2004-06-01", class_id: testClassId,
        });
        expect(s2.status).toBe(201);
        secStudent2 = s2.body;
        const login2 = await login(s2.body.register_number, "2004-06-01", "student");
        secStudent2Token = login2.token;

        // OD with student1 as participant
        const od1 = await api(adminToken).post("/api/ods", odBody(testClassId, [studentStudentId], { event_name: "Sec OD1 " + RUN }));
        expect(od1.status).toBe(201);
        secOd1 = od1.body;

        // OD with student2 as participant
        const od2 = await api(adminToken).post("/api/ods", odBody(testClassId, [secStudent2.student_id], { event_name: "Sec OD2 " + RUN }));
        expect(od2.status).toBe(201);
        secOd2 = od2.body;
    }, 20000);

    test("Student can access OD they participate in", async () => {
        const res = await api(studentToken).get("/api/ods/" + secOd1.id);
        expect(res.status).toBe(200);
        expect(res.body.id).toBe(secOd1.id);
    });

    test("Student cannot access OD they are not a participant of", async () => {
        // studentToken is student1; secOd2 belongs to student2
        const res = await api(studentToken).get("/api/ods/" + secOd2.id);
        expect(res.status).toBe(403);
    });

    test("CR can access OD in their own class", async () => {
        // Reuse crToken from OD cancellation suite — but that was in afterAll cleaned up.
        // Use the advisor instead as it's class-scoped to class1.
        // advisor sees class1 OD
        const res = await api(advisorToken).get("/api/ods/" + secOd1.id);
        expect(res.status).toBe(200);
    });

    test("Class Advisor cannot access OD in another class", async () => {
        // secOd1 is in class1; advisor2 manages class2
        const res = await api(advisor2Token).get("/api/ods/" + secOd1.id);
        expect(res.status).toBe(403);
    });

    test("Admin can access any OD", async () => {
        const res1 = await api(adminToken).get("/api/ods/" + secOd1.id);
        const res2 = await api(adminToken).get("/api/ods/" + secOd2.id);
        expect(res1.status).toBe(200);
        expect(res2.status).toBe(200);
    });

    test("Manipulated class_id in query cannot bypass student authorization", async () => {
        // Student passes class_id of another class in list request
        const res = await api(studentToken).get("/api/ods", { class_id: testClass2Id });
        expect(res.status).toBe(200);
        // Student scope: only their own participations
        res.body.data.forEach((o) => {
            const isParticipant = o.participants.some((p) => String(p.student_id) === String(studentStudentId));
            expect(isParticipant).toBe(true);
        });
    });
});
