import pool from '../config/database.js';

class AuditEvent {
    static async record({ actorUserId, action, targetEntity, targetId, oldData = null, newData = null, details = null, client = pool }) {
        await client.query(
            `INSERT INTO audit_events (actor_user_id, action, target_entity, target_id, old_data, new_data, details)
             VALUES ($1, $2, $3, $4, $5::jsonb, $6::jsonb, $7)`,
            [actorUserId || null, action, targetEntity, targetId ? String(targetId) : null,
             JSON.stringify(oldData), JSON.stringify(newData), details || null]
        );
    }

    static async getForTarget(targetEntity, targetId) {
        const result = await pool.query(
            `SELECT ae.*, u.username AS actor_username
             FROM audit_events ae
             LEFT JOIN users u ON u.user_id = ae.actor_user_id
             WHERE ae.target_entity = $1 AND ae.target_id = $2
             ORDER BY ae.created_at DESC, ae.id DESC`,
            [targetEntity, String(targetId)]
        );
        return result.rows;
    }
}

export default AuditEvent;