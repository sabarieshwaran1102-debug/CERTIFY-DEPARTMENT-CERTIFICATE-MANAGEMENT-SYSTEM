import pool from '../config/database.js';
import AuditEvent from './AuditEvent.js';

/**
 * Compute certificate deadline.
 * Rule: last calendar day of the month containing od_end_date.
 * @param {string} odEndDate  YYYY-MM-DD string
 * @returns {string}          YYYY-MM-DD deadline string
 */
export function computeDeadline(odEndDate) {
    const d = new Date(odEndDate + 'T00:00:00Z');
    // Last day of that month
    const lastDay = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0));
    const y = lastDay.getUTCFullYear();
    const m = String(lastDay.getUTCMonth() + 1).padStart(2, '0');
    const day = String(lastDay.getUTCDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
}

/**
 * Determine if a submission is late.
 * @param {string} deadline  YYYY-MM-DD
 * @returns {boolean}
 */
export function isLateSubmission(deadline) {
    const now = new Date();
    const d = new Date(deadline + 'T23:59:59Z');
    return now > d;
}

const CERT_SELECT = `
    SELECT
        oc.id,
        oc.od_id,
        oc.student_id,
        s.register_number,
        s.name        AS student_name,
        oc.file_name,
        oc.file_size,
        oc.file_type,
        oc.status,
        oc.deadline,
        oc.is_late,
        oc.late_reason,
        oc.late_approved_by,
        late_approver.username AS late_approved_by_username,
        oc.late_approved_at,
        oc.late_rejected_by,
        late_rejecter.username AS late_rejected_by_username,
        oc.late_rejected_at,
        oc.version,
        oc.submitted_by,
        submitter.username    AS submitted_by_username,
        oc.submitted_at,
        oc.verified_by,
        verifier.username     AS verified_by_username,
        oc.verified_at,
        oc.rejected_by,
        rejecter.username     AS rejected_by_username,
        oc.rejected_at,
        oc.rejection_reason,
        oc.created_at,
        oc.updated_at,
        o.od_number,
        o.event_name,
        o.event_date::text   AS event_date,
        o.od_end_date::text  AS od_end_date,
        o.class_id,
        c.display_name       AS class_name
    FROM od_certificates oc
    JOIN students s              ON s.student_id   = oc.student_id
    JOIN ods o                   ON o.id           = oc.od_id
    JOIN classes c               ON c.id           = o.class_id
    JOIN users submitter         ON submitter.user_id = oc.submitted_by
    LEFT JOIN users verifier     ON verifier.user_id  = oc.verified_by
    LEFT JOIN users rejecter     ON rejecter.user_id  = oc.rejected_by
    LEFT JOIN users late_approver ON late_approver.user_id = oc.late_approved_by
    LEFT JOIN users late_rejecter ON late_rejecter.user_id = oc.late_rejected_by
`;

class OdCertificate {
    /**
     * Get a single certificate record by its id.
     */
    static async getById(id) {
        const r = await pool.query(CERT_SELECT + ' WHERE oc.id = $1', [id]);
        return r.rows[0] || null;
    }

    /**
     * Get the current certificate for a given (od_id, student_id) pair.
     */
    static async getByOdAndStudent(odId, studentId) {
        const r = await pool.query(
            CERT_SELECT + ' WHERE oc.od_id = $1 AND oc.student_id = $2',
            [odId, studentId]
        );
        return r.rows[0] || null;
    }

    /**
     * Get all certificates for a given OD (all participants).
     */
    static async getByOdId(odId) {
        const r = await pool.query(
            CERT_SELECT + ' WHERE oc.od_id = $1 ORDER BY s.register_number',
            [odId]
        );
        return r.rows;
    }

    /**
     * Get all certificates submitted by a student (across all their ODs).
     */
    static async getByStudentId(studentId) {
        const r = await pool.query(
            CERT_SELECT + ' WHERE oc.student_id = $1 ORDER BY oc.submitted_at DESC',
            [studentId]
        );
        return r.rows;
    }

    /**
     * Paginated list with optional filters. Scope controls class/student access.
     * @param {object} filters
     * @param {number} limit
     * @param {number} offset
     * @param {object|null} scope  { type:'class', classId } | { type:'student', studentId } | null
     */
    static async getAll(filters = {}, limit = 25, offset = 0, scope = null) {
        const conds = [];
        const vals  = [];
        const push  = (expr, val) => { vals.push(val); conds.push(expr.replace('?', '$' + vals.length)); };

        if (scope?.type === 'class')   push('o.class_id = ?',   scope.classId);
        if (scope?.type === 'student') push('oc.student_id = ?', scope.studentId);

        if (filters.od_id)     push('oc.od_id = ?',     filters.od_id);
        if (filters.status)    push('oc.status = ?',     filters.status);
        if (filters.is_late !== undefined) push('oc.is_late = ?', filters.is_late);
        if (filters.class_id)  push('o.class_id = ?',   filters.class_id);

        const where = conds.length ? 'WHERE ' + conds.join(' AND ') : '';

        const total = parseInt(
            (await pool.query(
                `SELECT COUNT(*) FROM od_certificates oc JOIN ods o ON o.id=oc.od_id ${where}`, vals
            )).rows[0].count, 10
        );

        vals.push(limit, offset);
        const data = await pool.query(
            CERT_SELECT + `${where} ORDER BY oc.submitted_at DESC LIMIT $${vals.length-1} OFFSET $${vals.length}`,
            vals
        );
        return { rows: data.rows, total, limit, offset };
    }

    /**
     * Get version history for a certificate.
     */
    static async getVersions(odCertificateId) {
        const r = await pool.query(
            `SELECT cv.*, u.username AS replaced_by_username
             FROM certificate_versions cv
             JOIN users u ON u.user_id = cv.replaced_by
             WHERE cv.od_certificate_id = $1
             ORDER BY cv.version DESC`,
            [odCertificateId]
        );
        return r.rows;
    }

    /**
     * Submit a certificate for the first time.
     * Inserts the od_certificates row and records an audit event.
     * Must be called inside a transaction (pgClient).
     */
    static async submit({ odId, studentId, fileName, filePath, fileSize, fileType, deadline, isLate, lateReason, submittedBy }, pgClient) {
        const status = isLate ? 'late_submitted' : 'submitted';
        const r = await pgClient.query(
            `INSERT INTO od_certificates
               (od_id, student_id, file_name, file_path, file_size, file_type,
                status, deadline, is_late, late_reason, submitted_by, version)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,1)
             RETURNING id`,
            [odId, studentId, fileName, filePath, fileSize, fileType,
             status, deadline, isLate, lateReason || null, submittedBy]
        );
        const certId = r.rows[0].id;

        await AuditEvent.record({
            actorUserId:  submittedBy,
            action:       'CERTIFICATE_SUBMITTED',
            targetEntity: 'od_certificate',
            targetId:     String(certId),
            newData: { od_id: odId, student_id: studentId, file_name: fileName, status, is_late: isLate },
            details:      isLate ? `Late submission — reason: ${lateReason}` : null,
            client:       pgClient,
        });

        return certId;
    }

    /**
     * Replace an existing certificate (new version).
     * Archives the current file into certificate_versions, updates od_certificates.
     * Must be called inside a transaction (pgClient).
     */
    static async replace({ certId, fileName, filePath, fileSize, fileType, deadline, isLate, lateReason, replacedBy }, pgClient) {
        // Load current record to archive it
        const cur = (await pgClient.query('SELECT * FROM od_certificates WHERE id=$1 FOR UPDATE', [certId])).rows[0];
        if (!cur) throw new Error('Certificate not found for replacement');

        // Archive current version
        await pgClient.query(
            `INSERT INTO certificate_versions
               (od_certificate_id, version, file_name, file_path, file_size, file_type, replaced_at, replaced_by)
             VALUES ($1,$2,$3,$4,$5,$6,NOW(),$7)`,
            [certId, cur.version, cur.file_name, cur.file_path, cur.file_size, cur.file_type, replacedBy]
        );

        const newVersion = cur.version + 1;
        const status = isLate ? 'late_submitted' : 'submitted';

        // Update current record
        await pgClient.query(
            `UPDATE od_certificates
             SET file_name=$1, file_path=$2, file_size=$3, file_type=$4,
                 status=$5, deadline=$6, is_late=$7, late_reason=$8,
                 version=$9, submitted_by=$10, submitted_at=NOW(),
                 verified_by=NULL, verified_at=NULL,
                 rejected_by=NULL, rejected_at=NULL, rejection_reason=NULL,
                 late_approved_by=NULL, late_approved_at=NULL,
                 late_rejected_by=NULL, late_rejected_at=NULL,
                 updated_at=NOW()
             WHERE id=$11`,
            [fileName, filePath, fileSize, fileType,
             status, deadline, isLate, lateReason || null,
             newVersion, replacedBy, certId]
        );

        await AuditEvent.record({
            actorUserId:  replacedBy,
            action:       'CERTIFICATE_REPLACED',
            targetEntity: 'od_certificate',
            targetId:     String(certId),
            newData: { version: newVersion, file_name: fileName, status, is_late: isLate },
            oldData: { version: cur.version, file_name: cur.file_name },
            details:      `Replaced version ${cur.version} → ${newVersion}${isLate ? ` (late: ${lateReason})` : ''}`,
            client:       pgClient,
        });
    }

    /**
     * Verify a certificate (admin / class_advisor / coordinating_faculty).
     */
    static async verify(certId, verifiedBy, pgClient) {
        await pgClient.query(
            `UPDATE od_certificates
             SET status='verified', verified_by=$1, verified_at=NOW(), updated_at=NOW()
             WHERE id=$2`,
            [verifiedBy, certId]
        );
        await AuditEvent.record({
            actorUserId:  verifiedBy,
            action:       'CERTIFICATE_VERIFIED',
            targetEntity: 'od_certificate',
            targetId:     String(certId),
            client:       pgClient,
        });
    }

    /**
     * Reject a certificate (admin / class_advisor / coordinating_faculty).
     */
    static async reject(certId, rejectedBy, reason, pgClient) {
        await pgClient.query(
            `UPDATE od_certificates
             SET status='rejected', rejected_by=$1, rejected_at=NOW(),
                 rejection_reason=$2, updated_at=NOW()
             WHERE id=$3`,
            [rejectedBy, reason, certId]
        );
        await AuditEvent.record({
            actorUserId:  rejectedBy,
            action:       'CERTIFICATE_REJECTED',
            targetEntity: 'od_certificate',
            targetId:     String(certId),
            newData: { reason },
            details:      reason,
            client:       pgClient,
        });
    }

    /**
     * Approve a late submission (admin / class_advisor / coordinating_faculty).
     * Transitions status from late_submitted → submitted (pending further verification).
     */
    static async approveLate(certId, approvedBy, pgClient) {
        await pgClient.query(
            `UPDATE od_certificates
             SET status='submitted',
                 late_approved_by=$1, late_approved_at=NOW(), updated_at=NOW()
             WHERE id=$2`,
            [approvedBy, certId]
        );
        await AuditEvent.record({
            actorUserId:  approvedBy,
            action:       'CERTIFICATE_LATE_APPROVED',
            targetEntity: 'od_certificate',
            targetId:     String(certId),
            client:       pgClient,
        });
    }

    /**
     * Reject a late submission (admin / class_advisor / coordinating_faculty).
     * Transitions status from late_submitted → rejected.
     */
    static async rejectLate(certId, rejectedBy, reason, pgClient) {
        await pgClient.query(
            `UPDATE od_certificates
             SET status='rejected',
                 late_rejected_by=$1, late_rejected_at=NOW(),
                 rejection_reason=$2, updated_at=NOW()
             WHERE id=$3`,
            [rejectedBy, reason, certId]
        );
        await AuditEvent.record({
            actorUserId:  rejectedBy,
            action:       'CERTIFICATE_LATE_REJECTED',
            targetEntity: 'od_certificate',
            targetId:     String(certId),
            newData: { reason },
            details:      reason,
            client:       pgClient,
        });
    }

    /**
     * Mark overdue certificates for an OD.
     * Called internally after deadline passes; safe to call repeatedly (idempotent).
     */
    static async markOverdue(odId) {
        await pool.query(
            `UPDATE od_certificates
             SET status='overdue', updated_at=NOW()
             WHERE od_id=$1
               AND status='pending'
               AND deadline IS NOT NULL
               AND deadline < CURRENT_DATE`,
            [odId]
        );
    }
}

export default OdCertificate;
