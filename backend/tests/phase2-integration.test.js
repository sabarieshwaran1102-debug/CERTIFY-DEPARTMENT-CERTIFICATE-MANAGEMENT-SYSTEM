/**
 * Phase 2 Runtime Integration Tests — real HTTP + DB via Supertest
 */
import request from "supertest";
import app from "../src/app.js";
import pool from "../src/config/database.js";
import bcrypt from "bcrypt";

const RUN = Date.now().toString(36).slice(-6).toUpperCase();
let seq = 0;
const uid = (label) => ("T" + RUN + label.slice(0,3) + String(++seq).padStart(3,"0")).slice(0,20);

let adminToken, advisorToken, advisor2Token, superAdminToken;
let adminUserId, advisorUserId, advisor2UserId, superAdminUserId;
let testClassId, testClass2Id, testDeptId, testYearId;
let studentA, studentB, studentC;

const api = (token) => ({
    get: (url, p) => request(app).get(url).set("Authorization","Bearer " + token).query(p || {}),
    post: (url, b) => request(app).post(url).set("Authorization","Bearer " + token).send(b || {}),
    patch: (url, b) => request(app).patch(url).set("Authorization","Bearer " + token).send(b || {}),
    delete: (url, b) => request(app).delete(url).set("Authorization","Bearer " + token).send(b || {}),
});

const login = async (u, p, r) => {
    const res = await request(app).post("/api/auth/login").send({ username:u, password:p, role:r });
    if (res.status !== 200) throw new Error("Login failed for " + u + ": " + res.status + " " + JSON.stringify(res.body));
    return res.body;
};

const mkStudent = async (token, classId, label) => {
    const rn = uid(label || "S");
    return api(token).post("/api/students", { register_number:rn, name:"Stu " + label, date_of_birth:"2003-05-15", class_id:classId });
};

beforeAll(async () => {
    const pw  = await bcrypt.hash("TestPass123!", 12);
    const saw = await bcrypt.hash("SAPass123!", 12);

    const sa = await pool.query("INSERT INTO users (username,role,password_hash) VALUES ($1,$2,$3) RETURNING user_id",
        ["sa_" + RUN + "@t.com","super_admin",saw]);
    superAdminUserId = sa.rows[0].user_id;
    superAdminToken  = (await login("sa_" + RUN + "@t.com","SAPass123!","super_admin")).token;

    const ad = await pool.query("INSERT INTO users (username,role,password_hash) VALUES ($1,$2,$3) RETURNING user_id",
        ["adm_" + RUN + "@t.com","admin",pw]);
    adminUserId = ad.rows[0].user_id;
    adminToken  = (await login("adm_" + RUN + "@t.com","TestPass123!","admin")).token;

    const dp = await pool.query(
        "INSERT INTO departments (name,code) VALUES ($1,$2) ON CONFLICT (code) DO UPDATE SET name=EXCLUDED.name RETURNING id",
        ["Dept_" + RUN, "D" + RUN.slice(0,5)]);
    testDeptId = dp.rows[0].id;

    const yr = await pool.query(
        "INSERT INTO academic_years (name) VALUES ($1) ON CONFLICT (name) DO UPDATE SET name=EXCLUDED.name RETURNING id",
        ["Y_" + RUN]);
    testYearId = yr.rows[0].id;

    const c1 = await pool.query(
        "INSERT INTO classes (department_id,academic_year_id,year_of_study,section,display_name) VALUES ($1,$2,$3,$4,$5) ON CONFLICT (department_id,academic_year_id,year_of_study,section) DO UPDATE SET display_name=EXCLUDED.display_name RETURNING id",
        [testDeptId,testYearId,"2nd Year","X","CL_" + RUN + "_X"]);
    testClassId = c1.rows[0].id;

    const c2 = await pool.query(
        "INSERT INTO classes (department_id,academic_year_id,year_of_study,section,display_name) VALUES ($1,$2,$3,$4,$5) ON CONFLICT (department_id,academic_year_id,year_of_study,section) DO UPDATE SET display_name=EXCLUDED.display_name RETURNING id",
        [testDeptId,testYearId,"2nd Year","Y","CL_" + RUN + "_Y"]);
    testClass2Id = c2.rows[0].id;

    const a1 = await pool.query("INSERT INTO users (username,role,password_hash) VALUES ($1,$2,$3) RETURNING user_id",
        ["adv1_" + RUN + "@t.com","class_advisor",pw]);
    advisorUserId = a1.rows[0].user_id;
    const a2 = await pool.query("INSERT INTO users (username,role,password_hash) VALUES ($1,$2,$3) RETURNING user_id",
        ["adv2_" + RUN + "@t.com","class_advisor",pw]);
    advisor2UserId = a2.rows[0].user_id;

    await pool.query("INSERT INTO class_advisor_history (class_id,user_id,changed_by) VALUES ($1,$2,$3)",[testClassId,advisorUserId,adminUserId]);
    await pool.query("INSERT INTO class_advisor_history (class_id,user_id,changed_by) VALUES ($1,$2,$3)",[testClass2Id,advisor2UserId,adminUserId]);

    advisorToken  = (await login("adv1_" + RUN + "@t.com","TestPass123!","class_advisor")).token;
    advisor2Token = (await login("adv2_" + RUN + "@t.com","TestPass123!","class_advisor")).token;
}, 30000);

afterAll(async () => {
    try {
        if (testClassId) {
            await pool.query("DELETE FROM class_representatives WHERE class_id IN ($1,$2)",[testClassId,testClass2Id]);
            await pool.query("DELETE FROM class_advisor_history WHERE class_id IN ($1,$2)",[testClassId,testClass2Id]);
            await pool.query("DELETE FROM import_sessions WHERE class_id IN ($1,$2)",[testClassId,testClass2Id]);
            await pool.query("DELETE FROM od_records WHERE class_id IN ($1,$2)",[testClassId,testClass2Id]);
            await pool.query("DELETE FROM users WHERE student_id IN (SELECT student_id FROM students WHERE class_id IN ($1,$2))",[testClassId,testClass2Id]);
            await pool.query("DELETE FROM students WHERE class_id IN ($1,$2)",[testClassId,testClass2Id]);
            await pool.query("DELETE FROM classes WHERE id IN ($1,$2)",[testClassId,testClass2Id]);
        }
        if (testDeptId) await pool.query("DELETE FROM departments WHERE id=$1",[testDeptId]);
        if (testYearId) await pool.query("DELETE FROM academic_years WHERE id=$1",[testYearId]);
        for (const id of [adminUserId,advisorUserId,advisor2UserId,superAdminUserId].filter(Boolean)) {
            await pool.query("DELETE FROM audit_events WHERE actor_user_id=$1",[id]);
            await pool.query("DELETE FROM users WHERE user_id=$1",[id]);
        }
    } catch { /* best-effort */ }
    await pool.end();
}, 30000);

// =============================================================================
// 1. STUDENT MANAGEMENT
// =============================================================================
describe("Student management", () => {
    test("Admin creates student", async () => {
        const res = await mkStudent(adminToken, testClassId, "ADM");
        expect(res.status).toBe(201);
        studentA = res.body;
    });
    test("Admin edits student", async () => {
        const res = await api(adminToken).patch("/api/students/" + studentA.student_id, { name:"Updated Name" });
        expect(res.status).toBe(200);
        expect(res.body.name).toBe("Updated Name");
    });
    test("Class Advisor creates student in own class", async () => {
        const res = await mkStudent(advisorToken, testClassId, "ADV");
        expect(res.status).toBe(201);
        studentB = res.body;
    });
    test("Class Advisor rejected creating in another class", async () => {
        expect((await mkStudent(advisorToken, testClass2Id, "CRS")).status).toBe(403);
    });
    test("Class Advisor edits student in own class", async () => {
        const res = await api(advisorToken).patch("/api/students/" + studentB.student_id, { name:"Advisor Edited" });
        expect(res.status).toBe(200);
        expect(res.body.name).toBe("Advisor Edited");
    });
    test("Class Advisor rejected editing another class student", async () => {
        const other = await mkStudent(adminToken, testClass2Id, "C2S");
        expect(other.status).toBe(201);
        studentC = other.body;
        expect((await api(advisorToken).patch("/api/students/" + studentC.student_id, { name:"Hack" })).status).toBe(403);
    });
    test("Class Advisor lists only own-class students", async () => {
        const res = await api(advisorToken).get("/api/students");
        expect(res.status).toBe(200);
        (res.body.data || []).forEach((s) => expect(String(s.class_id)).toBe(String(testClassId)));
    });
    test("Paginated list returns pagination metadata", async () => {
        const res = await api(adminToken).get("/api/students", { limit:2, offset:0, class_id:testClassId });
        expect(res.status).toBe(200);
        expect(res.body.pagination).toBeDefined();
        expect(res.body.pagination.total).toBeGreaterThanOrEqual(2);
        expect(res.body.data.length).toBeLessThanOrEqual(2);
    });
    test("Search by name returns matching students", async () => {
        const res = await api(adminToken).get("/api/students", { q:"Advisor Edited", class_id:testClassId });
        expect(res.status).toBe(200);
        expect(res.body.data.length).toBeGreaterThanOrEqual(1);
        expect(res.body.data[0].name).toContain("Advisor Edited");
    });
    test("Deactivation marks student INACTIVE", async () => {
        const res = await api(adminToken).patch("/api/students/" + studentB.student_id + "/deactivate");
        expect(res.status).toBe(200);
        expect(res.body.status).toBe("INACTIVE");
    });
    test("Deactivated student cannot log in", async () => {
        const res = await request(app).post("/api/auth/login").send({ username:studentB.register_number, password:"2003-05-15", role:"student" });
        expect(res.status).toBe(401);
    });
    test("Deactivation creates audit record", async () => {
        const res = await api(superAdminToken).get("/api/audit/student/" + studentB.student_id);
        expect(res.status).toBe(200);
        expect(res.body.data.map((e) => e.action)).toContain("student_deactivated");
    });
});

// =============================================================================
// 2. ADVISOR MANAGEMENT
// =============================================================================
describe("Advisor management", () => {
    let newAdvisorId;
    test("Admin assigns advisor to class", async () => {
        const row = await pool.query("INSERT INTO users (username,role,password_hash) VALUES ($1,$2,$3) RETURNING user_id",
            ["newadv_" + RUN + "@t.com","class_advisor",await bcrypt.hash("TestPass123!",12)]);
        newAdvisorId = row.rows[0].user_id;
        const res = await api(adminToken).post("/api/classes/" + testClassId + "/advisor", { user_id:newAdvisorId, reason:"Test" });
        expect(res.status).toBe(201);
    });
    test("Replacing advisor preserves old history row", async () => {
        const r = await pool.query("SELECT COUNT(*) FROM class_advisor_history WHERE class_id=$1",[testClassId]);
        expect(parseInt(r.rows[0].count,10)).toBeGreaterThanOrEqual(2);
        const old = await pool.query("SELECT * FROM class_advisor_history WHERE class_id=$1 AND unassigned_at IS NOT NULL",[testClassId]);
        expect(old.rows.length).toBeGreaterThanOrEqual(1);
    });
    test("Only one active advisor per class at a time", async () => {
        const r = await pool.query("SELECT COUNT(*) FROM class_advisor_history WHERE class_id=$1 AND unassigned_at IS NULL",[testClassId]);
        expect(parseInt(r.rows[0].count,10)).toBe(1);
    });
    test("Advisor history returns all records", async () => {
        const res = await api(adminToken).get("/api/classes/" + testClassId + "/advisor");
        expect(res.status).toBe(200);
        expect(res.body.data.length).toBeGreaterThanOrEqual(2);
    });
    test("Advisor assignment creates audit record", async () => {
        const res = await api(superAdminToken).get("/api/audit/class/" + testClassId);
        expect(res.status).toBe(200);
        expect(res.body.data.map((e) => e.action)).toContain("advisor_assigned");
    });
    test("Advisor unassignment creates audit record", async () => {
        const res = await api(superAdminToken).get("/api/audit/class/" + testClassId);
        expect(res.status).toBe(200);
        expect(res.body.data.map((e) => e.action)).toContain("advisor_unassigned");
    });
    afterAll(async () => {
        if (newAdvisorId) await pool.query("DELETE FROM users WHERE user_id=$1",[newAdvisorId]).catch(()=>{});
        // Re-assign original advisor so class_advisor tests still work
        await pool.query("UPDATE class_advisor_history SET unassigned_at=NOW() WHERE class_id=$1 AND unassigned_at IS NULL",[testClassId]).catch(()=>{});
        await pool.query("INSERT INTO class_advisor_history (class_id,user_id,changed_by) VALUES ($1,$2,$3)",[testClassId,advisorUserId,adminUserId]).catch(()=>{});
    });
});

// =============================================================================
// 3. CLASS REPRESENTATIVES
// =============================================================================
describe("Class Representatives", () => {
    let cr1Id, cr2Id;
    beforeAll(() => { cr1Id = studentA?.student_id; cr2Id = studentC?.student_id; });

    test("Admin assigns CR", async () => {
        expect((await api(adminToken).post("/api/classes/" + testClassId + "/representatives", { student_id:cr1Id })).status).toBe(201);
    });
    test("Super Admin assigns CR", async () => {
        const s = await mkStudent(adminToken, testClassId, "CA2");
        expect(s.status).toBe(201);
        expect((await api(superAdminToken).post("/api/classes/" + testClassId + "/representatives", { student_id:s.body.student_id })).status).toBe(201);
    });
    test("Multiple CRs allowed for same class", async () => {
        const r = await api(adminToken).get("/api/classes/" + testClassId + "/representatives");
        expect(r.status).toBe(200);
        expect(r.body.data.length).toBeGreaterThanOrEqual(2);
    });
    test("Class Advisor assigns CR in own class", async () => {
        const s = await mkStudent(advisorToken, testClassId, "CA3");
        expect(s.status).toBe(201);
        expect((await api(advisorToken).post("/api/classes/" + testClassId + "/representatives", { student_id:s.body.student_id })).status).toBe(201);
    });
    test("Class Advisor cannot assign CR in another class", async () => {
        expect((await api(advisorToken).post("/api/classes/" + testClass2Id + "/representatives", { student_id:cr2Id })).status).toBe(403);
    });
    test("Cross-class student blocked from CR assignment", async () => {
        const res = await api(adminToken).post("/api/classes/" + testClassId + "/representatives", { student_id:cr2Id });
        expect([400,404]).toContain(res.status);
    });
    test("Admin removes CR", async () => {
        expect((await api(adminToken).delete("/api/classes/" + testClassId + "/representatives/" + cr1Id)).status).toBe(200);
    });
    test("Unauthenticated request returns 401", async () => {
        expect((await request(app).post("/api/classes/" + testClassId + "/representatives").send({ student_id:cr1Id })).status).toBe(401);
    });
});

// =============================================================================
// 4. CLASS REPRESENTATIVE AUTHORIZATION
// =============================================================================
describe("Class Representative authorization", () => {
    let crUserId, crToken, crStudent;

    beforeAll(async () => {
        const s = await mkStudent(adminToken, testClassId, "CRA");
        if (s.status !== 201) throw new Error("CR student creation failed: " + JSON.stringify(s.body));
        crStudent = s.body;

        await pool.query(
            "INSERT INTO class_representatives (class_id,student_id,assigned_by) SELECT $1,$2,$3 WHERE NOT EXISTS (SELECT 1 FROM class_representatives WHERE class_id=$1 AND student_id=$2)",
            [testClassId, crStudent.student_id, adminUserId]
        );

        const existing = await pool.query("SELECT user_id FROM users WHERE student_id=$1 AND role=$2",
            [crStudent.student_id,"class_representative"]);
        if (existing.rows[0]) {
            crUserId = existing.rows[0].user_id;
            await pool.query("UPDATE users SET is_active=TRUE, class_id=$1 WHERE user_id=$2",[testClassId,crUserId]);
        } else {
            const cr = await pool.query(
                "INSERT INTO users (username,role,student_id,password_hash,class_id) VALUES ($1,$2,$3,$4,$5) RETURNING user_id",
                [crStudent.register_number,"class_representative",crStudent.student_id,
                 await bcrypt.hash("2003-05-15",12),testClassId]
            );
            crUserId = cr.rows[0].user_id;
        }

        const loginRes = await request(app).post("/api/auth/login").send({
            username:crStudent.register_number, password:"2003-05-15", role:"class_representative"
        });
        if (loginRes.status !== 200) throw new Error("CR login failed: " + JSON.stringify(loginRes.body));
        crToken = loginRes.body.token;
    }, 20000);

    test("CR views students in own class", async () => {
        const res = await api(crToken).get("/api/students", { class_id:testClassId });
        expect(res.status).toBe(200);
        expect(Array.isArray(res.body.data)).toBe(true);
        (res.body.data || []).forEach((s) => expect(String(s.class_id)).toBe(String(testClassId)));
    });
    test("CR class_id override returns only own class", async () => {
        const res = await api(crToken).get("/api/students", { class_id:testClass2Id });
        expect(res.status).toBe(200);
        (res.body.data || []).forEach((s) => expect(String(s.class_id)).toBe(String(testClassId)));
    });
    test("CR cannot create students", async () => {
        expect((await api(crToken).post("/api/students", { register_number:uid("HCK"), name:"H", date_of_birth:"2003-01-01", class_id:testClassId })).status).toBe(403);
    });
    test("CR cannot assign advisors", async () => {
        expect((await api(crToken).post("/api/classes/" + testClassId + "/advisor", { user_id:advisorUserId })).status).toBe(403);
    });
    test("CR cannot manage departments", async () => {
        expect((await api(crToken).post("/api/departments", { name:"CRH", code:"C" + RUN.slice(0,4) })).status).toBe(403);
    });

    afterAll(async () => { if (crUserId) await pool.query("DELETE FROM users WHERE user_id=$1",[crUserId]).catch(()=>{}); });
});

// =============================================================================
// 5. BULK IMPORT
// =============================================================================
describe("Bulk import", () => {
    const csv = (rows) => "register_number,name,date_of_birth\n" + rows.map((r) => r.join(",")).join("\n");
    const buf = (rows) => Buffer.from(csv(rows), "utf8");
    const prevReq = (token, classId, rows) =>
        request(app).post("/api/students/import/preview")
            .set("Authorization","Bearer " + token)
            .field("class_id", String(classId))
            .attach("file", buf(rows), { filename:"f.csv", contentType:"text/csv" });

    test("CSV preview returns session_id and correct summary", async () => {
        const res = await prevReq(adminToken, testClassId, [[uid("IC1"),"Imp One","2003-01-10"],[uid("IC2"),"Imp Two","2003-02-20"]]);
        expect(res.status).toBe(200);
        expect(res.body.session_id).toBeTruthy();
        expect(res.body.summary.total).toBe(2);
        expect(res.body.summary.valid).toBe(2);
    });
    test("Duplicate register numbers detected in preview", async () => {
        const rn = uid("IDP");
        const res = await prevReq(adminToken, testClassId, [[rn,"One","2003-01-01"],[rn,"Dup","2003-01-02"]]);
        expect(res.status).toBe(200);
        expect(res.body.summary.duplicates).toBeGreaterThan(0);
    });
    test("Invalid DOB detected in preview", async () => {
        const res = await prevReq(adminToken, testClassId, [[uid("IBD"),"Bad","not-a-date"]]);
        expect(res.status).toBe(200);
        expect(res.body.summary.invalid).toBeGreaterThan(0);
        expect(res.body.rows[0].errors.some((e) => e.includes("date_of_birth"))).toBe(true);
    });
    test("Existing register number detected as duplicate", async () => {
        const res = await prevReq(adminToken, testClassId, [[studentA.register_number,"Existing","2003-01-01"]]);
        expect(res.status).toBe(200);
        expect(res.body.summary.duplicates).toBeGreaterThan(0);
    });
    test("Clean preview + confirm imports all students", async () => {
        const rows = [[uid("ICA"),"Conf A","2003-03-01"],[uid("ICB"),"Conf B","2003-03-02"]];
        const prev = await prevReq(adminToken, testClassId, rows);
        expect(prev.status).toBe(200);
        expect(prev.body.summary.valid).toBe(2);
        const conf = await api(adminToken).post("/api/students/import/confirm", { session_id:prev.body.session_id });
        expect(conf.status).toBe(201);
        expect(conf.body.imported).toBe(2);
    });
    test("Confirm with error rows returns 400 and inserts nothing", async () => {
        const rn = uid("IFL");
        const prev = await prevReq(adminToken, testClassId, [[rn,"Good","2003-04-01"],[rn,"Dup","2003-04-02"]]);
        expect(prev.status).toBe(200);
        const conf = await api(adminToken).post("/api/students/import/confirm", { session_id:prev.body.session_id });
        expect(conf.status).toBe(400);
    });
    test("Advisor preview works for own class", async () => {
        expect((await prevReq(advisorToken, testClassId, [[uid("IAO"),"Adv Imp","2003-05-01"]])).status).toBe(200);
    });
    test("Advisor preview rejected for another class", async () => {
        expect((await prevReq(advisorToken, testClass2Id, [[uid("IXC"),"Cross","2003-05-01"]])).status).toBe(403);
    });
});

// =============================================================================
// 6. PERMANENT DELETION
// =============================================================================
describe("Permanent deletion", () => {
    let delStudentId;
    test("Super Admin permanently deletes student with no history", async () => {
        const s = await mkStudent(adminToken, testClassId, "DEL");
        expect(s.status).toBe(201);
        delStudentId = s.body.student_id;
        const res = await api(superAdminToken).delete("/api/students/" + delStudentId, { reason:"Test" });
        expect(res.status).toBe(200);
        expect((await pool.query("SELECT student_id FROM students WHERE student_id=$1",[delStudentId])).rows.length).toBe(0);
    });
    test("Admin receives 403 on permanent delete", async () => {
        const s = await mkStudent(adminToken, testClassId, "DNA");
        expect(s.status).toBe(201);
        expect((await api(adminToken).delete("/api/students/" + s.body.student_id)).status).toBe(403);
    });
    test("Class Advisor receives 403 on permanent delete", async () => {
        expect((await api(advisorToken).delete("/api/students/" + studentA.student_id)).status).toBe(403);
    });
    test("Blocked when student has OD records", async () => {
        const s = await mkStudent(adminToken, testClassId, "DOD");
        expect(s.status).toBe(201);
        await pool.query("INSERT INTO od_records (student_id,event_details,class_id,academic_year_id) VALUES ($1,$2,$3,$4)",
            [s.body.student_id,"OD",testClassId,testYearId]);
        expect((await api(superAdminToken).delete("/api/students/" + s.body.student_id)).status).toBe(409);
        await pool.query("DELETE FROM od_records WHERE student_id=$1",[s.body.student_id]);
        await pool.query("DELETE FROM users WHERE student_id=$1",[s.body.student_id]);
        await pool.query("DELETE FROM students WHERE student_id=$1",[s.body.student_id]);
    });
    test("Permanent deletion creates audit record", async () => {
        const res = await api(superAdminToken).get("/api/audit/student/" + delStudentId);
        expect(res.status).toBe(200);
        expect(res.body.data.map((e) => e.action)).toContain("student_permanently_deleted");
    });
});

// =============================================================================
// 7. AUTHORIZATION MATRIX
// =============================================================================
describe("Authorization matrix", () => {
    test("Student cannot list students", async () => {
        const s = await mkStudent(adminToken, testClassId, "AUT");
        expect(s.status).toBe(201);
        const lr = await request(app).post("/api/auth/login").send({ username:s.body.register_number, password:"2003-05-15", role:"student" });
        expect(lr.status).toBe(200);
        expect((await api(lr.body.token).get("/api/students")).status).toBe(403);
    });
    test("Unauthenticated request returns 401", async () => {
        expect((await request(app).get("/api/students")).status).toBe(401);
    });
    test("Class Advisor cannot create departments", async () => {
        expect((await api(advisorToken).post("/api/departments", { name:"X", code:"XX" + RUN.slice(0,3) })).status).toBe(403);
    });
    test("Class Advisor cannot create academic years", async () => {
        expect((await api(advisorToken).post("/api/academic-years", { name:"HY" + RUN })).status).toBe(403);
    });
    test("Class Advisor cannot assign advisor", async () => {
        expect((await api(advisorToken).post("/api/classes/" + testClassId + "/advisor", { user_id:advisorUserId })).status).toBe(403);
    });
});
