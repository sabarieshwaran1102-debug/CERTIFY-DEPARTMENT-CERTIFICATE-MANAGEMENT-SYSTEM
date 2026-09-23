import pool from '../config/database.js';

const SAH_SELECT = `
    SELECT
        sah.id,
        sah.student_id,
        sah.academic_year_id,
        sah.class_id,
        sah.status,
        sah.notes,
        sah.enrolled_at,
        sah.exited_at,
        sah.created_at,
        sah.updated_at,
        ay.name        AS academic_year_name,
        ay.start_date  AS academic_year_start,
        ay.end_date    AS academic_year_end,
        c.display_name AS class_name,
        c.year_of_study,
        c.section,
        d.name         AS department_name,
        d.code         AS department_code
    FROM student_academic_history sah
    JOIN academic_years ay ON ay.id = sah.academic_year_id
    JOIN classes        c  ON c.id  = sah.class_id
    JOIN departments    d  ON d.id  = c.department_id
`;

class StudentAcademicHistory {
    static async getByStudent(studentId) {
        const r = await pool.query(
            SAH_SELECT + ' WHERE sah.student_id = $1 ORDER BY ay.start_date DESC NULLS LAST, sah.enrolled_at DESC',
            [studentId]
        );
        return r.rows;
    }

    static async getByAcademicYear(academicYearId) {
        const r = await pool.query(
            SAH_SELECT + ' WHERE sah.academic_year_id = $1 ORDER BY d.name, c.display_name, sah.student_id',
            [academicYearId]
        );
        return r.rows;
    }

    static async get(studentId, academicYearId) {
        const r = await pool.query(
            SAH_SELECT + ' WHERE sah.student_id = $1 AND sah.academic_year_id = $2',
            [studentId, academicYearId]
        );
        return r.rows[0] || null;
    }

    /**
     * Insert or update a history record for a student's enrollment in an academic year.
     * Safe to call multiple times — upserts on the unique constraint.
     */
    static async enroll({ studentId, academicYearId, classId, status = 'active', notes = null }, pgClient = pool) {
        const r = await pgClient.query(
            `INSERT INTO student_academic_history
               (student_id, academic_year_id, class_id, status, notes)
             VALUES ($1, $2, $3, $4, $5)
             ON CONFLICT (student_id, academic_year_id)
               DO UPDATE SET
                 class_id   = EXCLUDED.class_id,
                 status     = EXCLUDED.status,
                 notes      = COALESCE(EXCLUDED.notes, student_academic_history.notes),
                 updated_at = NOW()
             RETURNING *`,
            [studentId, academicYearId, classId, status, notes]
        );
        return r.rows[0];
    }

    /**
     * Mark a student's enrollment in a given academic year as exited.
     * Preserves the record — sets status and exited_at only.
     */
    static async exit({ studentId, academicYearId, exitStatus, notes = null }, pgClient = pool) {
        const r = await pgClient.query(
            `UPDATE student_academic_history
             SET status     = $3,
                 exited_at  = NOW(),
                 notes      = COALESCE($4, notes),
                 updated_at = NOW()
             WHERE student_id = $1 AND academic_year_id = $2
             RETURNING *`,
            [studentId, academicYearId, exitStatus, notes]
        );
        return r.rows[0] || null;
    }
}

export default StudentAcademicHistory;
