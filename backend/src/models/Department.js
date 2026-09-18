import pool from '../config/database.js';

class Department {
    static async getById(id) {
        const result = await pool.query('SELECT * FROM departments WHERE id = $1', [id]);
        return result.rows[0] || null;
    }

    static async getAll(activeOnly = false) {
        const result = await pool.query(
            `SELECT * FROM departments ${activeOnly ? 'WHERE active = TRUE' : ''} ORDER BY name`
        );
        return result.rows;
    }

    static async create({ name, code, active = true }) {
        const result = await pool.query(
            `INSERT INTO departments (name, code, active)
             VALUES ($1, $2, $3) RETURNING *`,
            [name, code, active]
        );
        return result.rows[0];
    }

    static async update(id, updates) {
        const fields = [];
        const values = [];
        let parameter = 1;
        for (const field of ['name', 'code', 'active']) {
            if (updates[field] !== undefined) {
                fields.push(`${field} = $${parameter++}`);
                values.push(updates[field]);
            }
        }
        if (!fields.length) return null;
        fields.push('updated_at = NOW()');
        values.push(id);
        const result = await pool.query(
            `UPDATE departments SET ${fields.join(', ')} WHERE id = $${parameter} RETURNING *`,
            values
        );
        return result.rows[0] || null;
    }
}

export default Department;