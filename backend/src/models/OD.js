import pool from '../config/database.js';
import AuditEvent from './AuditEvent.js';

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
 * Full OD query with JOINs — returns all display fields in one row per OD.
 * od_participants are returned as a JSON array via json_agg.
 * Includes cancelled_by_username when present.
 */
const OD_SELECT = `
    SELECT
        o.id,
        o.od_number,
        o.event_name,
        o.event_type,
        o.event_date::text      AS event_date,
        o.od_start_date::text  AS od_start_date,
        o.od_end_date::text    AS od_end_date,
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
        o.cancelled_by,
        cu.username AS cancelled_by_username,
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
    JOIN departments    d   ON d.id   = o.department_id
    JOIN academic_years ay  ON ay.id  = o.academic_year_id
    JOIN classes        c   ON c.id   = o.class_id
    JOIN users          u   ON u.user_id = o.created_by
    LEFT JOIN users     cu  ON cu.user_id = o.cancelled_by
    LEFT JOIN od_participants p ON p.od_id = o.id
    LEFT JOIN students  s   ON s.student_id = p.student_id
`;

class OD {
    /**
     * Create one OD (individual or team) atomically.
     * Records an OD_CREATED audit event inside the same transaction.
     *
     * @param {object} data         - validated OD fields
     * @param {number[]} studentIds - array of participant student_ids (≥1)
     * @param {number} actorUserId  - user creating the OD
     * @param {object} pgClient     - caller-supplied pool client (transaction managed by caller)
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

        const odId   = odResult.rows[0].id;
        const odNum  = odResult.rows[0].od_number;

        for (const studentId of studentIds) {
            await pgClient.query(
                'INSERT INTO od_participants (od_id, student_id) VALUES ($1, $2)',
                [odId, studentId]
            );
        }

        // Audit: OD_CREATED
        await AuditEvent.record({
            actorUserId,
            action:       'OD_CREATED',
            targetEntity: 'od',
            targetId:     String(odId),
            newData: {
                od_number:        odNum,
                event_name:       data.event_name,
                class_id:         data.class_id,
                participant_count: studentIds.length,
            },
            client: pgClient,
        });

        return odResult.rows[0];
    }

    /**
     * Cancel an OD.
     * Sets status='cancelled', cancelled_by, cancelled_at, cancellation_reason.
     * Records an OD_CANCELLED audit event inside the same transaction.
     *
     * @param {number|string} odId         - OD to cancel
     * @param {string}        reason       - non-empty cancellation reason
     * @param {number}        actorUserId  - user performing the cancellation
     * @param {object}        pgClient     - caller-supplied pool client (inside BEGIN/COMMIT)
     * @returns {object} updated OD row (from ods table, not full join)
     */
    static async cancel(odId, reason, actorUserId, pgClient) {
        const result = await pgClient.query(
            `UPDATE ods
             SET status              = 'cancelled',
                 cancelled_by        = $1,
                 cancelled_at        = NOW(),
                 cancellation_reason = $2,
                 updated_at          = NOW()
             WHERE id = $3
             RETURNING id, od_number, event_name, class_id, status, cancelled_at`,
            [actorUserId, reason, odId]
        );

        const updated = result.rows[0];

        // Audit: OD_CANCELLED
        await AuditEvent.record({
            actorUserId,
            action:       'OD_CANCELLED',
            targetEntity: 'od',
            targetId:     String(odId),
            newData: {
                od_number:           updated.od_number,
                event_name:          updated.event_name,
                class_id:            updated.class_id,
                cancellation_reason: reason,
            },
            details: reason,
            client:  pgClient,
        });

        return updated;
    }

    /**
     * Fetch a single OD by id with participants.
     */
    static async getById(odId) {
        const result = await pool.query(
            OD_SELECT + ' WHERE o.id = $1 GROUP BY o.id,d.id,ay.id,c.id,u.user_id,cu.user_id',
            [odId]
        );
        return result.rows[0] || null;
    }

    /**
     * Fetch a single OD by od_number.
     */
    static async getByOdNumber(odNumber) {
        const result = await pool.query(
            OD_SELECT + ' WHERE o.od_number = $1 GROUP BY o.id,d.id,ay.id,c.id,u.user_id,cu.user_id',
            [odNumber]
        );
        return result.rows[0] || null;
    }

    /**
     * Paginated list with role-based scoping and rich filtering.
     *
     * Supported filters (all optional, all parameterised):
     *   od_number, event_name (ILIKE), event_type, status,
     *   class_id, department_id, academic_year_id,
     *   event_date (exact), event_date_from, event_date_to,
     *   student_register (ILIKE on participant register_number),
     *   student_name    (ILIKE on participant name),
     *   from_date (od_start_date >=), to_date (od_end_date <=)
     *
     * Scope always takes precedence over any class/student filter the caller
     * supplies — scoped users cannot escape their class boundary.
     *
     * @param {object}      filters
     * @param {number}      limit
     * @param {number}      offset
     * @param {object|null} scope  - { type:'class', classId } | { type:'student', studentId } | null
     */
    static async getAll(filters = {}, limit = 25, offset = 0, scope = null) {
        const conditions = [];
        const values     = [];

        // Helper: append a condition and bind a value
        const push = (expr, val) => {
            values.push(val);
            // Replace the first bare '?' with the next positional parameter
            conditions.push(expr.replace('?', '$' + values.length));
        };

        // ── Scope (authoritative — evaluated first, cannot be overridden) ──
        if (scope) {
            if (scope.type === 'class') {
                push('o.class_id = ?', scope.classId);
            } else if (scope.type === 'student') {
                push(
                    'EXISTS (SELECT 1 FROM od_participants pp WHERE pp.od_id = o.id AND pp.student_id = ?)',
                    scope.studentId
                );
            }
        }

        // ── Org filters (only honoured for global managers; route layer strips
        //    these for scoped users before calling getAll) ──────────────────
        if (filters.class_id)         push('o.class_id = ?',          filters.class_id);
        if (filters.department_id)    push('o.department_id = ?',      filters.department_id);
        if (filters.academic_year_id) push('o.academic_year_id = ?',   filters.academic_year_id);

        // ── Text / categorical filters ────────────────────────────────────
        if (filters.od_number)   push('o.od_number = ?',                    filters.od_number);
        if (filters.event_name)  push('o.event_name ILIKE ?',               '%' + filters.event_name + '%');
        if (filters.event_type)  push('o.event_type = ?',                   filters.event_type);
        if (filters.status)      push('o.status = ?',                       filters.status);

        // ── Date filters ──────────────────────────────────────────────────
        if (filters.event_date)      push('o.event_date = ?',               filters.event_date);
        if (filters.event_date_from) push('o.event_date >= ?',              filters.event_date_from);
        if (filters.event_date_to)   push('o.event_date <= ?',              filters.event_date_to);
        if (filters.from_date)       push('o.od_start_date >= ?',           filters.from_date);
        if (filters.to_date)         push('o.od_end_date <= ?',             filters.to_date);

        // ── Participant student filters (require a JOIN to students) ──────
        // These are handled via a correlated sub-query so they work with the
        // GROUP BY without inflating the row count.
        if (filters.student_register) {
            push(
                'EXISTS (SELECT 1 FROM od_participants pp2 JOIN students ss2 ON ss2.student_id = pp2.student_id WHERE pp2.od_id = o.id AND ss2.register_number ILIKE ?)',
                '%' + filters.student_register + '%'
            );
        }
        if (filters.student_name) {
            push(
                'EXISTS (SELECT 1 FROM od_participants pp3 JOIN students ss3 ON ss3.student_id = pp3.student_id WHERE pp3.od_id = o.id AND ss3.name ILIKE ?)',
                '%' + filters.student_name + '%'
            );
        }

        const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';

        // ── Count query (uses a lighter join to avoid GROUP BY overhead) ──
        const countResult = await pool.query(
            `SELECT COUNT(DISTINCT o.id) AS total
             FROM ods o
             LEFT JOIN od_participants p ON p.od_id = o.id
             ${where}`,
            values
        );
        const total = parseInt(countResult.rows[0].total, 10);

        // ── Data query — push limit/offset after all filter values ────────
        values.push(limit, offset);
        const limitParam  = '$' + (values.length - 1);
        const offsetParam = '$' + values.length;

        const dataResult = await pool.query(
            OD_SELECT +
            `${where}
             GROUP BY o.id, d.id, ay.id, c.id, u.user_id, cu.user_id
             ORDER BY o.created_at DESC, o.id DESC
             LIMIT ${limitParam} OFFSET ${offsetParam}`,
            values
        );

        return { rows: dataResult.rows, total, limit, offset };
    }
}

export default OD;
