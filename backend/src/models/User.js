import pool from '../config/database.js';

class User {
  /**
   * Get a user by user_id
   */
  static async getById(userId) {
    const result = await pool.query(
      'SELECT * FROM users WHERE user_id = $1',
      [userId]
    );
    return result.rows[0] || null;
  }

  /**
   * Get a user by username
   */
  static async getByUsername(username) {
    const result = await pool.query(
      'SELECT * FROM users WHERE username = $1',
      [username]
    );
    return result.rows[0] || null;
  }

  static async getForLogin(username) {
    const result = await pool.query(
      `SELECT u.user_id, u.username, u.role, u.student_id, u.is_active,
              u.password_hash, u.assigned_faculty_id,
              s.register_number, s.name, s.department, s.year, s.section,
              s.class_id, s.academic_year_id, s.status
       FROM users u
       LEFT JOIN students s ON s.student_id = u.student_id
       WHERE (u.role = 'student' AND s.register_number = $1)
         OR (u.role <> 'student' AND u.username = $1)`,
      [username]
    );
    return result.rows[0] || null;
  }

  /**
   * Get a user with their student information
   */
  static async getUserWithStudent(userId) {
    const result = await pool.query(
      `SELECT u.user_id, u.username, u.role, u.is_active, u.student_id,
              s.student_id, s.register_number, s.name, s.department, s.year, s.section,
              u.assigned_faculty_id,
                s.class_id, s.academic_year_id, s.status
       FROM users u
       LEFT JOIN students s ON u.student_id = s.student_id
       WHERE u.user_id = $1`,
      [userId]
    );
    return result.rows[0] || null;
  }

  /**
   * Create a new user
   * Note: Authentication method is pending department confirmation
   * This is a placeholder for future implementation
   */
  static async create(userData) {
    const { username, role, student_id, password_hash, assigned_faculty_id } = userData;
    const result = await pool.query(
      `INSERT INTO users (username, role, student_id, password_hash, assigned_faculty_id)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING user_id, username, role, student_id, is_active, assigned_faculty_id`,
      [username, role, student_id || null, password_hash || null, assigned_faculty_id || null]
    );
    return result.rows[0];
  }

  /**
   * Update a user
   */
  static async update(userId, updates) {
    const fields = [];
    const values = [];
    let paramCount = 1;

    if (updates.username !== undefined) {
      fields.push(`username = $${paramCount++}`);
      values.push(updates.username);
    }
    if (updates.role !== undefined) {
      fields.push(`role = $${paramCount++}`);
      values.push(updates.role);
    }
    if (updates.is_active !== undefined) {
      fields.push(`is_active = $${paramCount++}`);
      values.push(updates.is_active);
    }
    if (updates.student_id !== undefined) {
      fields.push(`student_id = $${paramCount++}`);
      values.push(updates.student_id);
    }
    if (updates.password_hash !== undefined) {
      fields.push(`password_hash = $${paramCount++}`);
      values.push(updates.password_hash);
    }
    if (updates.assigned_faculty_id !== undefined) {
      fields.push(`assigned_faculty_id = $${paramCount++}`);
      values.push(updates.assigned_faculty_id);
    }

    if (fields.length === 0) return null;

    fields.push(`updated_at = NOW()`);
    values.push(userId);

    const result = await pool.query(
      `UPDATE users SET ${fields.join(', ')} WHERE user_id = $${paramCount} RETURNING *`,
      values
    );
    return result.rows[0] || null;
  }

  /**
   * Check if a user is active
   */
  static async isActive(userId) {
    const result = await pool.query(
      'SELECT is_active FROM users WHERE user_id = $1',
      [userId]
    );
    if (!result.rows[0]) return false;
    return result.rows[0].is_active;
  }

  /**
   * Get user count
   */
  static async count() {
    const result = await pool.query('SELECT COUNT(*) FROM users');
    return parseInt(result.rows[0].count, 10);
  }

  static async getCoordinatingFaculty() {
    const result = await pool.query(
      `SELECT user_id, username, role, is_active, created_at
       FROM users WHERE role = 'coordinating_faculty' ORDER BY username`
    );
    return result.rows;
  }

  static async getRepresentatives(facultyId) {
    const result = await pool.query(
      `SELECT user_id, username, role, is_active, assigned_faculty_id, created_at
       FROM users
       WHERE role = 'student_representative' AND assigned_faculty_id = $1
       ORDER BY username`,
      [facultyId]
    );
    return result.rows;
  }
}

export default User;
