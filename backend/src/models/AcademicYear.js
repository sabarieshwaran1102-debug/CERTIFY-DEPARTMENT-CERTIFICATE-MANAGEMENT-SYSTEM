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

    /**
     * Activate an academic year.
     * Does NOT deactivate others — the system supports multiple active years
     * (admin may manage several simultaneously). Use deactivate to close one.
     */
    static async activate(id) {
        const result = await pool.query(
            `UPDATE academic_years SET active = TRUE, updated_at = NOW() WHERE id = $1 RETURNING *`,
            [id]
        );
        return result.rows[0] || null;
    }

    /**
     * Deactivate an academic year.
     * Preserves all historical OD and certificate records.
     * Does NOT delete or modify classes, students, ODs, or certificates.
     */
    static async deactivate(id) {
        const result = await pool.query(
            `UPDATE academic_years SET active = FALSE, end_date = COALESCE(end_date, CURRENT_DATE), updated_at = NOW() WHERE id = $1 RETURNING *`,
            [id]
        );
        return result.rows[0] || null;
    }
}

export default AcademicYear;
