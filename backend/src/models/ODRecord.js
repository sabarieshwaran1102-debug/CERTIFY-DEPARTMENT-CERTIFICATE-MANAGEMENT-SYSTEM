import pool from '../config/database.js';

class ODRecord {
  /**
   * Get an OD record by od_id
   */
  static async getById(odId) {
    const result = await pool.query(
      'SELECT * FROM od_records WHERE od_id = $1',
      [odId]
    );
    return result.rows[0] || null;
  }

  /**
   * Get an OD record by registration_number
   */
  static async getByRegistrationNumber(registrationNumber) {
    const result = await pool.query(
      'SELECT * FROM od_records WHERE registration_number = $1',
      [registrationNumber]
    );
    return result.rows[0] || null;
  }

  /**
   * Get all OD records for a specific student
   */
  static async getByStudentId(studentId, limit = 50, offset = 0) {
    const result = await pool.query(
      `SELECT * FROM od_records
       WHERE student_id = $1
       ORDER BY created_at DESC
       LIMIT $2 OFFSET $3`,
      [studentId, limit, offset]
    );
    return result.rows;
  }

  /**
   * Get all OD records (for Student Rep and Faculty)
   */
  static async getAll(filters = {}, limit = 50, offset = 0) {
    let query = 'SELECT * FROM od_records WHERE 1=1';
    const values = [];
    let paramCount = 1;

    if (filters.student_id) {
      query += ` AND student_id = $${paramCount++}`;
      values.push(filters.student_id);
    }
    if (filters.status) {
      query += ` AND od_status = $${paramCount++}`;
      values.push(filters.status);
    }
    if (filters.department) {
      query += ` AND od_records.student_id IN (
        SELECT student_id FROM students WHERE department = $${paramCount++}
      )`;
      values.push(filters.department);
    }

    query += ` ORDER BY created_at DESC LIMIT $${paramCount++} OFFSET $${paramCount++}`;
    values.push(limit, offset);

    const result = await pool.query(query, values);
    return result.rows;
  }

  /**
   * Create a new OD record with auto-generated registration_number
   * Registration number is generated from the sequence in atomic, concurrency-safe way
   */
  static async create(studentId, eventDetails, createdBy) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Get next sequence value atomically
      const seqResult = await client.query(
        'SELECT nextval(\'registration_number_seq\'::regclass) as seq_value'
      );
      const seqValue = seqResult.rows[0].seq_value;

      // Format as OD-XXXX
      const registrationNumber = `OD-${String(seqValue).padStart(4, '0')}`;

      // Insert OD record
      const result = await client.query(
        `INSERT INTO od_records (student_id, registration_number, event_details, created_by, od_status)
         VALUES ($1, $2, $3, $4, 'active')
         RETURNING *`,
        [studentId, registrationNumber, eventDetails, createdBy]
      );

      await client.query('COMMIT');
      return result.rows[0];
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  /**
   * Update an OD record status or details
   */
  static async update(odId, updates) {
    const fields = [];
    const values = [];
    let paramCount = 1;

    if (updates.event_details !== undefined) {
      fields.push(`event_details = $${paramCount++}`);
      values.push(updates.event_details);
    }
    if (updates.od_status !== undefined) {
      fields.push(`od_status = $${paramCount++}`);
      values.push(updates.od_status);
    }

    if (fields.length === 0) return null;

    fields.push('updated_at = NOW()');
    values.push(odId);

    const result = await pool.query(
      `UPDATE od_records SET ${fields.join(', ')} WHERE od_id = $${paramCount} RETURNING *`,
      values
    );
    return result.rows[0] || null;
  }

  /**
   * Get count of OD records for a student
   */
  static async countByStudentId(studentId) {
    const result = await pool.query(
      'SELECT COUNT(*) FROM od_records WHERE student_id = $1',
      [studentId]
    );
    return parseInt(result.rows[0].count, 10);
  }

  /**
   * Get next sequence value (for reference/testing)
   */
  static async getNextSequenceValue() {
    const result = await pool.query(
      'SELECT nextval(\'registration_number_seq\'::regclass) as seq_value'
    );
    return result.rows[0].seq_value;
  }

  /**
   * Get current sequence value (for reference/testing)
   */
  static async getCurrentSequenceValue() {
    const result = await pool.query(
      'SELECT last_value FROM registration_number_seq'
    );
    return result.rows[0].last_value;
  }
}

export default ODRecord;
