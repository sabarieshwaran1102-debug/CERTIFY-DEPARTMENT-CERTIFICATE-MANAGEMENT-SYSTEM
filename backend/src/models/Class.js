import pool from '../config/database.js';

class ClassModel {
    static async getById(id) {
        const result = await pool.query(
            `SELECT c.*, d.name AS department_name, d.code AS department_code, ay.name AS academic_year_name
             FROM classes c
             JOIN departments d ON d.id = c.department_id
             JOIN academic_years ay ON ay.id = c.academic_year_id
             WHERE c.id = $1`,
            [id]
        );
        return result.rows[0] || null;
    }

    static async getAll(filters = {}) {
        const values = [];
        const conditions = [];
        if (filters.department_id) {
            values.push(filters.department_id);
            conditions.push(`c.department_id = $${values.length}`);
        }
        if (filters.academic_year_id) {
            values.push(filters.academic_year_id);
            conditions.push(`c.academic_year_id = $${values.length}`);
        }
        // Default: return only active classes unless caller explicitly passes active_only=false
        if (filters.active_only !== 'false') {
            conditions.push(`c.active = TRUE`);
        }
        const result = await pool.query(
            `SELECT c.*, d.name AS department_name, d.code AS department_code, ay.name AS academic_year_name
             FROM classes c
             JOIN departments d ON d.id = c.department_id
             JOIN academic_years ay ON ay.id = c.academic_year_id
             ${conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''}
             ORDER BY d.name, ay.name DESC, c.year_of_study, c.section`,
            values
        );
        return result.rows;
    }

    static async create({ department_id, academic_year_id, year_of_study, section, display_name, active = true }) {
        const result = await pool.query(
            `INSERT INTO classes (department_id, academic_year_id, year_of_study, section, display_name, active)
             VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
            [department_id, academic_year_id, year_of_study, section, display_name, active]
        );
        return result.rows[0];
    }
}

export default ClassModel;