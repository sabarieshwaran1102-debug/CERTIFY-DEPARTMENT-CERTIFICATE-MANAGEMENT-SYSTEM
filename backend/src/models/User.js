import pool from '../config/database.js';

class User {
    static async getById(userId) {
        const result = await pool.query('SELECT * FROM users WHERE user_id = $1', [userId]);
        return result.rows[0] || null;
    }

    static async getByUsername(username) {
        const result = await pool.query('SELECT * FROM users WHERE username = $1', [username]);
        return result.rows[0] || null;
    }

    static async getForLogin(username, role) {
        // For student and class_representative: match by register_number with role constraint
        // For staff roles: match by username
        let result;
        if (role === 'student') {
            result = await pool.query(
                `SELECT u.user_id, u.username, u.role, u.student_id, u.is_active,
                        u.password_hash, u.assigned_faculty_id, u.class_id,
                        s.register_number, s.name, s.department, s.year, s.section,
                        s.class_id AS student_class_id, s.academic_year_id, s.status
                 FROM users u
                 JOIN students s ON s.student_id = u.student_id
                 WHERE u.role = 'student' AND s.register_number = $1`,
                [username]
            );
        } else if (role === 'class_representative') {
            result = await pool.query(
                `SELECT u.user_id, u.username, u.role, u.student_id, u.is_active,
                        u.password_hash, u.assigned_faculty_id, u.class_id,
                        s.register_number, s.name
                 FROM users u
                 JOIN students s ON s.student_id = u.student_id
                 WHERE u.role = 'class_representative' AND s.register_number = $1`,
                [username]
            );
        } else {
            result = await pool.query(
                `SELECT u.user_id, u.username, u.role, u.student_id, u.is_active,
                        u.password_hash, u.assigned_faculty_id, u.class_id,
                        s.register_number, s.name, s.department, s.year, s.section,
                        s.class_id AS student_class_id, s.academic_year_id, s.status
                 FROM users u
                 LEFT JOIN students s ON s.student_id = u.student_id
                 WHERE u.role != 'student' AND u.role != 'class_representative' AND u.username = $1`,
                [username]
            );
        }
        return result.rows[0] || null;
    }

    static async getUserWithStudent(userId) {
        const result = await pool.query(
            `SELECT u.user_id, u.username, u.role, u.is_active, u.student_id,
                    u.assigned_faculty_id, u.class_id,
                    s.student_id AS s_student_id, s.register_number, s.name,
                    s.department, s.year, s.section,
                    s.class_id AS student_class_id, s.academic_year_id, s.status
             FROM users u
             LEFT JOIN students s ON u.student_id = s.student_id
             WHERE u.user_id = $1`,
            [userId]
        );
        return result.rows[0] || null;
    }

    static async create(userData) {
        const { username, role, student_id, password_hash, assigned_faculty_id, class_id } = userData;
        const result = await pool.query(
            `INSERT INTO users (username, role, student_id, password_hash, assigned_faculty_id, class_id)
             VALUES ($1, $2, $3, $4, $5, $6)
             RETURNING user_id, username, role, student_id, is_active, assigned_faculty_id, class_id`,
            [username, role, student_id || null, password_hash || null,
             assigned_faculty_id || null, class_id || null]
        );
        return result.rows[0];
    }

    static async update(userId, updates) {
        const fields = [];
        const values = [];
        let paramCount = 1;
        const allowed = ['username', 'role', 'is_active', 'student_id',
                          'password_hash', 'assigned_faculty_id', 'class_id'];
        for (const key of allowed) {
            if (updates[key] !== undefined) {
                fields.push(`${key} = $${paramCount++}`);
                values.push(updates[key]);
            }
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

    static async isActive(userId) {
        const result = await pool.query('SELECT is_active FROM users WHERE user_id = $1', [userId]);
        if (!result.rows[0]) return false;
        return result.rows[0].is_active;
    }

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

    static async getClassAdvisors() {
        const result = await pool.query(
            `SELECT u.user_id, u.username, u.role, u.is_active, u.created_at,
                    h.class_id AS assigned_class_id
             FROM users u
             LEFT JOIN class_advisor_history h ON h.user_id = u.user_id AND h.unassigned_at IS NULL
             WHERE u.role IN ('class_advisor', 'coordinating_faculty') AND u.is_active = TRUE
             ORDER BY u.username`
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