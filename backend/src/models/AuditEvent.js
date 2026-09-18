import pool from '../config/database.js';

class AuditEvent {
    static async record({ actorUserId, action, targetEntity, targetId, oldData = null, newData = null, client = pool }) {
        await client.query(
            `INSERT INTO audit_events (actor_user_id, action, target_entity, target_id, old_data, new_data)
             VALUES ($1, $2, $3, $4, $5::jsonb, $6::jsonb)`,
            [actorUserId || null, action, targetEntity, targetId ? String(targetId) : null, JSON.stringify(oldData), JSON.stringify(newData)]
        );
    }

    static async getForTarget(targetEntity, targetId) {
        const result = await pool.query(
            `SELECT * FROM audit_events
             WHERE target_entity = $1 AND target_id = $2
             ORDER BY created_at DESC, id DESC`,
            [targetEntity, String(targetId)]
        );
        return result.rows;
    }
}

export default AuditEvent;