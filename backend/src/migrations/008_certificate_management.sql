-- Phase 4: Certificate Management
-- Adds od_certificates (Phase-3A OD → certificates) and certificate_versions (history).
-- The existing certificates table (Phase-1 od_records) is preserved untouched.

-- ── Deadline configuration per OD ────────────────────────────────────────────
-- Stores the computed deadline for each Phase-3A OD participant certificate.
-- Deadline rule: last calendar day of the month in which the OD event_date falls,
-- unless the OD runs into the next month (use od_end_date's month in that case).

-- ── od_certificates ───────────────────────────────────────────────────────────
-- One current certificate per (od_id, student_id) pair.
-- Versions are stored in certificate_versions.
CREATE TABLE IF NOT EXISTS od_certificates (
    id              BIGSERIAL   PRIMARY KEY,
    od_id           BIGINT      NOT NULL REFERENCES ods(id)           ON DELETE RESTRICT,
    student_id      BIGINT      NOT NULL REFERENCES students(student_id) ON DELETE RESTRICT,

    -- Current file
    file_name       VARCHAR(255) NOT NULL,
    file_path       VARCHAR(500) NOT NULL,
    file_size       INTEGER      NOT NULL,
    file_type       VARCHAR(50)  NOT NULL,

    -- Status lifecycle: pending → submitted → verified | rejected | overdue | late_submitted
    status          VARCHAR(30)  NOT NULL DEFAULT 'pending',

    -- Deadline: computed from OD event date at submission time
    deadline        DATE,

    -- Late submission
    is_late         BOOLEAN     NOT NULL DEFAULT FALSE,
    late_reason     TEXT,                       -- student-supplied reason
    late_approved_by BIGINT     REFERENCES users(user_id) ON DELETE RESTRICT,
    late_approved_at TIMESTAMP,
    late_rejected_by BIGINT     REFERENCES users(user_id) ON DELETE RESTRICT,
    late_rejected_at TIMESTAMP,

    -- Version tracking
    version         INTEGER     NOT NULL DEFAULT 1,  -- increments on replacement

    -- Submission metadata
    submitted_by    BIGINT      NOT NULL REFERENCES users(user_id) ON DELETE RESTRICT,
    submitted_at    TIMESTAMP   NOT NULL DEFAULT NOW(),
    verified_by     BIGINT      REFERENCES users(user_id) ON DELETE RESTRICT,
    verified_at     TIMESTAMP,
    rejected_by     BIGINT      REFERENCES users(user_id) ON DELETE RESTRICT,
    rejected_at     TIMESTAMP,
    rejection_reason TEXT,

    created_at      TIMESTAMP   NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMP   NOT NULL DEFAULT NOW(),

    CONSTRAINT od_certificates_status_check CHECK (
        status IN ('pending','submitted','late_submitted','verified','rejected','overdue')
    ),
    -- Only one active certificate per (OD, student)
    CONSTRAINT od_certificates_od_student_unique UNIQUE (od_id, student_id)
);

CREATE INDEX IF NOT EXISTS idx_od_certs_od_id       ON od_certificates(od_id);
CREATE INDEX IF NOT EXISTS idx_od_certs_student_id  ON od_certificates(student_id);
CREATE INDEX IF NOT EXISTS idx_od_certs_status      ON od_certificates(status);
CREATE INDEX IF NOT EXISTS idx_od_certs_deadline    ON od_certificates(deadline);
CREATE INDEX IF NOT EXISTS idx_od_certs_submitted_at ON od_certificates(submitted_at);

-- ── certificate_versions ──────────────────────────────────────────────────────
-- Preserves superseded certificate files when a student replaces their upload.
CREATE TABLE IF NOT EXISTS certificate_versions (
    id                  BIGSERIAL   PRIMARY KEY,
    od_certificate_id   BIGINT      NOT NULL REFERENCES od_certificates(id) ON DELETE RESTRICT,
    version             INTEGER     NOT NULL,
    file_name           VARCHAR(255) NOT NULL,
    file_path           VARCHAR(500) NOT NULL,
    file_size           INTEGER      NOT NULL,
    file_type           VARCHAR(50)  NOT NULL,
    replaced_at         TIMESTAMP   NOT NULL DEFAULT NOW(),
    replaced_by         BIGINT      NOT NULL REFERENCES users(user_id) ON DELETE RESTRICT,
    CONSTRAINT cert_versions_unique UNIQUE (od_certificate_id, version)
);

CREATE INDEX IF NOT EXISTS idx_cert_versions_od_cert ON certificate_versions(od_certificate_id);
