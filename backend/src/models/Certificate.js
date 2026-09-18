import pool from '../config/database.js';

class Certificate {
  /**
   * Get a certificate by certificate_id
   */
  static async getById(certificateId) {
    const result = await pool.query(
      'SELECT * FROM certificates WHERE certificate_id = $1',
      [certificateId]
    );
    return result.rows[0] || null;
  }

  /**
   * Get certificate by OD record ID
   * Each OD can have 0 or 1 certificate (enforced by UNIQUE constraint)
   */
  static async getByOdId(odId) {
    const result = await pool.query(
      'SELECT * FROM certificates WHERE od_id = $1',
      [odId]
    );
    return result.rows[0] || null;
  }

  /**
   * Get all certificates for a student
   */
  static async getByStudentId(studentId, limit = 50, offset = 0) {
    const result = await pool.query(
      `SELECT * FROM certificates
       WHERE student_id = $1
       ORDER BY submitted_at DESC
       LIMIT $2 OFFSET $3`,
      [studentId, limit, offset]
    );
    return result.rows;
  }

  /**
   * Get all certificates (for reporting)
   */
  static async getAll(filters = {}, limit = 50, offset = 0) {
    let query = `SELECT c.*, s.register_number, od.registration_number
           FROM certificates c
           JOIN students s ON c.student_id = s.student_id
           JOIN od_records od ON c.od_id = od.od_id
           WHERE 1=1`;
    const values = [];
    let paramCount = 1;

    if (filters.student_id) {
      query += ` AND c.student_id = $${paramCount++}`;
      values.push(filters.student_id);
    }
    if (filters.submission_month) {
      query += ` AND c.submission_month = $${paramCount++}`;
      values.push(filters.submission_month);
    }
    if (filters.department) {
      query += ` AND s.department = $${paramCount++}`;
      values.push(filters.department);
    }
    if (filters.year) {
      query += ` AND s.year = $${paramCount++}`;
      values.push(filters.year);
    }
    if (filters.section) {
      query += ` AND s.section = $${paramCount++}`;
      values.push(filters.section);
    }

    query += ` ORDER BY c.submitted_at DESC LIMIT $${paramCount++} OFFSET $${paramCount++}`;
    values.push(limit, offset);

    const result = await pool.query(query, values);
    return result.rows;
  }

  /**
   * Create a new certificate
   */
  static async create(certificateData) {
    const { od_id, student_id, file_name, file_path, file_size, file_type, submission_month } = certificateData;

    const result = await pool.query(
      `INSERT INTO certificates (od_id, student_id, file_name, file_path, file_size, file_type, submission_month)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [od_id, student_id, file_name, file_path, file_size, file_type, submission_month]
    );
    return result.rows[0];
  }

  /**
   * Check if certificate already exists for an OD
   */
  static async existsForOd(odId) {
    const result = await pool.query(
      'SELECT EXISTS(SELECT 1 FROM certificates WHERE od_id = $1) as exists',
      [odId]
    );
    return result.rows[0].exists;
  }

  /**
   * Get certificates for a month (for reporting)
   */
  static async getByMonth(month, filters = {}) {
    let query = `SELECT c.*, s.register_number, od.registration_number
                 FROM certificates c
                 JOIN students s ON c.student_id = s.student_id
                 JOIN od_records od ON c.od_id = od.od_id
                 WHERE c.submission_month = $1`;
    const values = [month];
    let paramCount = 2;

    if (filters.department) {
      query += ` AND s.department = $${paramCount++}`;
      values.push(filters.department);
    }
    if (filters.year) {
      query += ` AND s.year = $${paramCount++}`;
      values.push(filters.year);
    }
    if (filters.section) {
      query += ` AND s.section = $${paramCount++}`;
      values.push(filters.section);
    }

    query += ' ORDER BY c.submitted_at DESC';

    const result = await pool.query(query, values);
    return result.rows;
  }

  /**
   * Get missing certificates for a month
   * (OD records that exist but have no certificate)
   */
  static async getMissingForMonth(month, filters = {}) {
    let query = `SELECT od.*, s.register_number
                 FROM od_records od
                 JOIN students s ON od.student_id = s.student_id
                 WHERE od.created_at >= $1::date
                 AND od.created_at < ($1::date + INTERVAL '1 month')
                 AND NOT EXISTS (SELECT 1 FROM certificates c WHERE c.od_id = od.od_id)`;
    const values = [`${month}-01`];
    let paramCount = 2;

    if (filters.department) {
      query += ` AND s.department = $${paramCount++}`;
      values.push(filters.department);
    }
    if (filters.year) {
      query += ` AND s.year = $${paramCount++}`;
      values.push(filters.year);
    }
    if (filters.section) {
      query += ` AND s.section = $${paramCount++}`;
      values.push(filters.section);
    }

    query += ' ORDER BY od.created_at DESC';

    const result = await pool.query(query, values);
    return result.rows;
  }

  /**
   * Get count of certificates for student
   */
  static async countByStudentId(studentId) {
    const result = await pool.query(
      'SELECT COUNT(*) FROM certificates WHERE student_id = $1',
      [studentId]
    );
    return parseInt(result.rows[0].count, 10);
  }

  /**
   * Delete certificate (for testing only - not part of production workflow)
   */
  static async delete(certificateId) {
    const result = await pool.query(
      'DELETE FROM certificates WHERE certificate_id = $1 RETURNING *',
      [certificateId]
    );
    return result.rows[0] || null;
  }
}

export default Certificate;
