import pool from '../config/database.js';

class Student {
  /**
   * Get a student by student_id
   */
  static async getById(studentId) {
    const result = await pool.query(
      'SELECT * FROM students WHERE student_id = $1',
      [studentId]
    );
    return result.rows[0] || null;
  }

  /**
   * Get a student by register_number
   */
  static async getByRegisterNumber(registerNumber) {
    const result = await pool.query(
      'SELECT * FROM students WHERE register_number = $1',
      [registerNumber]
    );
    return result.rows[0] || null;
  }

  /**
   * Search students by name, register_number, or other fields
   * Used by Student Representative to find students for OD registration
   */
  static async search(query, limit = 20, offset = 0) {
    const searchTerm = `%${query}%`;
    const result = await pool.query(
      `SELECT student_id, register_number, name, department, year, section,
            class_id, academic_year_id, status, created_at
       FROM students
       WHERE register_number ILIKE $1 
          OR name ILIKE $1
          OR department ILIKE $1
       ORDER BY register_number ASC
       LIMIT $2 OFFSET $3`,
      [searchTerm, limit, offset]
    );
    return result.rows;
  }

  /**
   * Get all students (with pagination)
   */
  static async getAll(limit = 50, offset = 0) {
    const result = await pool.query(
      'SELECT * FROM students ORDER BY register_number ASC LIMIT $1 OFFSET $2',
      [limit, offset]
    );
    return result.rows;
  }

  static async getByClassId(classId, limit = 100, offset = 0) {
    const result = await pool.query(
      `SELECT * FROM students
       WHERE class_id = $1
       ORDER BY register_number ASC
       LIMIT $2 OFFSET $3`,
      [classId, limit, offset]
    );
    return result.rows;
  }

  /**
   * Create a new student (for testing/seeding only)
   */
  static async create(studentData) {
    const {
      register_number,
      name,
      department,
      year,
      section,
      date_of_birth,
      class_id,
      academic_year_id,
      status = 'ACTIVE',
    } = studentData;
    const result = await pool.query(
      `WITH target_class AS (
         SELECT c.id, c.academic_year_id
         FROM classes c
         JOIN departments d ON d.id = c.department_id
         JOIN academic_years ay ON ay.id = c.academic_year_id
         WHERE ($7::bigint IS NOT NULL AND c.id = $7)
            OR ($7::bigint IS NULL
                AND d.name = $3
                AND c.year_of_study = COALESCE(NULLIF($4, ''), 'Unknown')
                AND c.section = COALESCE(NULLIF($5, ''), 'UNASSIGNED')
                AND ($8::bigint IS NULL OR ay.id = $8))
         ORDER BY CASE WHEN ay.name = 'Legacy' THEN 0 ELSE 1 END
         LIMIT 1
       )
       INSERT INTO students (register_number, name, department, year, section, date_of_birth,
                             class_id, academic_year_id, status)
       SELECT $1, $2, $3, $4, $5, $6, target_class.id,
              COALESCE($8::bigint, target_class.academic_year_id), $9
       FROM target_class
       RETURNING *`,
      [register_number, name, department, year, section, date_of_birth || null, class_id || null, academic_year_id || null, status]
    );
    return result.rows[0];
  }

  /**
   * Get student count
   */
  static async count() {
    const result = await pool.query('SELECT COUNT(*) FROM students');
    return parseInt(result.rows[0].count, 10);
  }
}

export default Student;
