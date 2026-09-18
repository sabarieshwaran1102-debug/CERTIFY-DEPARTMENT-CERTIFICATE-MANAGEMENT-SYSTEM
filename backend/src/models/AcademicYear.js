import pool from '../config/database.js';

class AcademicYear {
    static async getById(id) {
        const result = await pool.query('SELECT * FROM academic_years WHERE id = $1', [id]);
        return result.rows[0] || null;
    }

    static async getAll(activeOnly = false) {
        const result = await pool.query(
            `SELECT * FROM academic_years ${activeOnly ? 'WHERE active = TRUE' : ''} ORDER BY start_date DESC NULLS LAST, name DESC`
        );
        return result.rows;
    }

    static async create({ name, start_date = null, end_date = null, active = true }) {
        const result = await pool.query(
            `INSERT INTO academic_years (name, start_date, end_date, active)
             VALUES ($1, $2, $3, $4) RETURNING *`,
            [name, start_date, end_date, active]
        );
        return result.rows[0];
    }
}

export default AcademicYear;