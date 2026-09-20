import pool from '../config/database.js';

/**
 * Generate the next OD number inside an existing transaction client.
 * Format: OD-YYYY-NNNNNN  (e.g. OD-2026-000001)
 * Uses a PostgreSQL sequence — concurrent requests never collide.
 */
export async function generateOdNumber(client) {
    const seq = await client.query("SELECT nextval('od_number_seq') AS n");
    const year = new Date().getFullYear();
    const n = String(seq.rows[0].n).padStart(6, '0');
    return `OD-${year}-${n}`;
}

/**
 * Full OD query with JOIN — returns all display fields in one row per OD.
 * od_participants are returned as a JSON array via json_agg.
 */
const OD_SELECT = `
    SELECT
        o.id,
        o.od_number,
        o.event_name,
        o.event_type,
        o.event_date,
        o.od_start_date,
        o.od_end_date,
        o.purpose,
        o.venue,
        o.status,
        o.created_at,
        o.updated_at,
        o.cancelled_at,
        o.cancellation_reason,
        o.department_id,
        d.name   AS department_name,
        d.code   AS department_code,
        o.academic_year_id,
        ay.name  AS academic_year_name,
        o.class_id,
        c.display_name AS class_name,
        c.year_of_study,
        c.section,
        o.created_by,
        u.username AS created_by_username,
        COALESCE(
            json_agg(
                json_build_object(
                    'id',              p.id,
                    'student_id',      p.student_id,
                    'register_number', s.register_number,
                    'name',            s.name,
                    'status',          s.status
                ) ORDER BY s.register_number
            ) FILTER (WHERE p.id IS NOT NULL),
            '[]'
        ) AS participants
    FROM ods o
    JOIN departments   d   ON d.id   = o.department_id
    JOIN academic_years ay ON ay.id  = o.academic_year_id
    JOIN classes        c  ON c.id   = o.class_id
    JOIN users          u  ON u.user_id = o.created_by
    LEFT JOIN od_participants p ON p.od_id = o.id
    LEFT JOIN students  s  ON s.student_id = p.student_id
`;

class OD {
    /**
     * Create one OD (individual or team) atomically.
     * @param {object} data - validated OD fields
     * @param {number[]} studentIds - array of participant student_ids (≥1)
     * @param {number} actorUserId - user creating the OD
     * @param {object} pgClient - caller-supplied pool client (transaction managed by caller)
     */
    static async create(data, studentIds, actorUserId, pgClient) {
        const odNumber = await generateOdNumber(pgClient);

        const odResult = await pgClient.query(
            `INSERT INTO ods
                (od_number, department_id, academic_year_id, class_id,
                 event_name, event_type, event_date, od_start_date, od_end_date,
                 purpose, venue, created_by)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
             RETURNING id, od_number`,
            [
                odNumber,
                data.department_id,
                data.academic_year_id,
                data.class_id,
                data.event_name.trim(),
                data.event_type.trim(),
                data.event_date,
                data.od_start_date,
                data.od_end_date,
                data.purpose.trim(),
                data.venue.trim(),
                actorUserId,
            ]
        );

        const odId = odResult.rows[0].id;

        for (const studentId of studentIds) {
            await pgClient.query(
                'INSERT INTO od_participants (od_id, student_id) VALUES ($1, $2)',
                [odId, studentId]
            );
        }

        return odResult.rows[0];
    }

    /**
     * Fetch a single OD by id with participants.
     */
    static async getById(odId) {
        const result = await pool.query(
            OD_SELECT + ' WHERE o.id = $1 GROUP BY o.id,d.id,ay.id,c.id,u.user_id',
            [odId]
        );
        return result.rows[0] || null;
    }

    /**
     * Fetch a single OD by od_number.
     */
    static async getByOdNumber(odNumber) {
        const result = await pool.query(
            OD_SELECT + ' WHERE o.od_number = $1 GROUP BY o.id,d.id,ay.id,c.id,u.user_id',
            [odNumber]
        );
        return result.rows[0] || null;
    }

    /**
     * Paginated list with role-based scoping.
     * @param {object} filters
     * @param {number} limit
     * @param {number} offset
     * @param {object|null} scope  - { type: 'class', classId } | { type: 'student', studentId } | null (global)
     */
    static async getAll(filters = {}, limit = 25, offset = 0, scope = null) {
        const conditions = [];
        const values = [];

        const push = (expr, val) => {
            values.push(val);
            conditions.push(expr.replace('?', '$' + values.length));
        };

        if (scope) {
            if (scope.type === 'class') {
                push('o.class_id = ?', scope.classId);
            } else if (scope.type === 'student') {
                // Student sees only ODs where they are a participant
                push('EXISTS (SELECT 1 FROM od_participants pp WHERE pp.od_id = o.id AND pp.student_id = ?)', scope.studentId);
            }
        }

        if (filters.class_id) push('o.class_id = ?', filters.class_id);
        if (filters.department_id) push('o.department_id = ?', filters.department_id);
        if (filters.academic_year_id) push('o.academic_year_id = ?', filters.academic_year_id);
        if (filters.status) push('o.status = ?', filters.status);
        if (filters.event_type) push('o.event_type = ?', filters.event_type);
        if (filters.from_date) push('o.od_start_date >= ?', filters.from_date);
        if (filters.to_date) push('o.od_end_date <= ?', filters.to_date);

        const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';

        // Count query
        const countResult = await pool.query(
            `SELECT COUNT(DISTINCT o.id) AS total
             FROM ods o
             LEFT JOIN od_participants p ON p.od_id = o.id
             ${where}`,
            values
        );
        const total = parseInt(countResult.rows[0].total, 10);

        // Data query — push limit/offset after all other values
        values.push(limit, offset);
        const limitParam = '$' + (values.length - 1);
        const offsetParam = '$' + values.length;

        const dataResult = await pool.query(
            OD_SELECT +
            `${where}
             GROUP BY o.id, d.id, ay.id, c.id, u.user_id
             ORDER BY o.created_at DESC, o.id DESC
             LIMIT ${limitParam} OFFSET ${offsetParam}`,
            values
        );

        return { rows: dataResult.rows, total, limit, offset };
    }
}

export default OD;
