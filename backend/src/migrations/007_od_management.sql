-- Phase 3A-1: On-Duty (OD) management core tables
-- All statements are idempotent (IF NOT EXISTS / DO $$ guards) so the migration
-- runner can replay this file safely against a live database.

-- ── OD number sequence ────────────────────────────────────────────────────────
-- One sequence per calendar year keeps OD numbers compact and human-readable.
-- The application generates the year prefix; the sequence provides the counter.
-- A single global sequence is simpler and still collision-proof at any concurrency.
CREATE SEQUENCE IF NOT EXISTS od_number_seq
    START WITH 1
    INCREMENT BY 1;

-- ── ods table ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ods (
    id              BIGSERIAL PRIMARY KEY,
    od_number       VARCHAR(20)  NOT NULL UNIQUE,
    department_id   BIGINT       NOT NULL REFERENCES departments(id)      ON DELETE RESTRICT,
    academic_year_id BIGINT      NOT NULL REFERENCES academic_years(id)   ON DELETE RESTRICT,
    class_id        BIGINT       NOT NULL REFERENCES classes(id)          ON DELETE RESTRICT,
    event_name      VARCHAR(255) NOT NULL,
    event_type      VARCHAR(100) NOT NULL,
    event_date      DATE         NOT NULL,
    od_start_date   DATE         NOT NULL,
    od_end_date     DATE         NOT NULL,
    purpose         TEXT         NOT NULL,
    venue           VARCHAR(255) NOT NULL,
    status          VARCHAR(20)  NOT NULL DEFAULT 'active',
    created_by      BIGINT       NOT NULL REFERENCES users(user_id)       ON DELETE RESTRICT,
    created_at      TIMESTAMP    NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMP    NOT NULL DEFAULT NOW(),
    cancelled_by    BIGINT                REFERENCES users(user_id)       ON DELETE RESTRICT,
    cancelled_at    TIMESTAMP,
    cancellation_reason TEXT,
    CONSTRAINT ods_status_check        CHECK (status IN ('active','cancelled')),
    CONSTRAINT ods_date_order          CHECK (od_end_date >= od_start_date),
    CONSTRAINT ods_event_date_range    CHECK (event_date BETWEEN od_start_date AND od_end_date + INTERVAL '30 days')
);

CREATE INDEX IF NOT EXISTS idx_ods_od_number       ON ods(od_number);
CREATE INDEX IF NOT EXISTS idx_ods_class_id        ON ods(class_id);
CREATE INDEX IF NOT EXISTS idx_ods_department_id   ON ods(department_id);
CREATE INDEX IF NOT EXISTS idx_ods_academic_year   ON ods(academic_year_id);
CREATE INDEX IF NOT EXISTS idx_ods_event_date      ON ods(event_date);
CREATE INDEX IF NOT EXISTS idx_ods_od_start_date   ON ods(od_start_date);
CREATE INDEX IF NOT EXISTS idx_ods_status          ON ods(status);
CREATE INDEX IF NOT EXISTS idx_ods_created_by      ON ods(created_by);
CREATE INDEX IF NOT EXISTS idx_ods_created_at      ON ods(created_at);

-- ── od_participants table ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS od_participants (
    id          BIGSERIAL    PRIMARY KEY,
    od_id       BIGINT       NOT NULL REFERENCES ods(id)           ON DELETE RESTRICT,
    student_id  BIGINT       NOT NULL REFERENCES students(student_id) ON DELETE RESTRICT,
    created_at  TIMESTAMP    NOT NULL DEFAULT NOW(),
    CONSTRAINT  od_participants_unique UNIQUE (od_id, student_id)
);

CREATE INDEX IF NOT EXISTS idx_od_participants_od_id      ON od_participants(od_id);
CREATE INDEX IF NOT EXISTS idx_od_participants_student_id ON od_participants(student_id);
