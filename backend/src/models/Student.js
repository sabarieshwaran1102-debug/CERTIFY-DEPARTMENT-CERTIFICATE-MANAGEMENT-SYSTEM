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
      `SELECT student_id, register_number, name, department, year, section, created_at
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

  /**
   * Create a new student (for testing/seeding only)
   */
  static async create(studentData) {
    const { register_number, name, department, year, section } = studentData;
    const result = await pool.query(
      `INSERT INTO students (register_number, name, department, year, section)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [register_number, name, department, year, section]
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
