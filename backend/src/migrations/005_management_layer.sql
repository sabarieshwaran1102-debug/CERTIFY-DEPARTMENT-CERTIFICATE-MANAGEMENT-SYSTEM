-- Phase 2: administration, advisor assignment, representatives, and audit preparation.

ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users
    ADD CONSTRAINT users_role_check
    CHECK (role IN ('super_admin', 'admin', 'coordinating_faculty', 'class_advisor', 'student_representative', 'student'));

CREATE TABLE IF NOT EXISTS class_advisor_history (
    id BIGSERIAL PRIMARY KEY,
    class_id BIGINT NOT NULL REFERENCES classes(id) ON DELETE RESTRICT,
    user_id BIGINT NOT NULL REFERENCES users(user_id) ON DELETE RESTRICT,
    assigned_at TIMESTAMP NOT NULL DEFAULT NOW(),
    unassigned_at TIMESTAMP,
    changed_by BIGINT REFERENCES users(user_id) ON DELETE RESTRICT,
    reason TEXT
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_active_class_advisor
    ON class_advisor_history(class_id) WHERE unassigned_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_advisor_history_user ON class_advisor_history(user_id);
CREATE INDEX IF NOT EXISTS idx_advisor_history_class ON class_advisor_history(class_id);

CREATE TABLE IF NOT EXISTS class_representatives (
    class_id BIGINT NOT NULL REFERENCES classes(id) ON DELETE RESTRICT,
    student_id BIGINT NOT NULL REFERENCES students(student_id) ON DELETE RESTRICT,
    assigned_at TIMESTAMP NOT NULL DEFAULT NOW(),
    assigned_by BIGINT REFERENCES users(user_id) ON DELETE RESTRICT,
    PRIMARY KEY (class_id, student_id),
    CONSTRAINT class_representative_student_unique UNIQUE (student_id)
);

CREATE INDEX IF NOT EXISTS idx_class_representatives_student ON class_representatives(student_id);

CREATE TABLE IF NOT EXISTS audit_events (
    id BIGSERIAL PRIMARY KEY,
    actor_user_id BIGINT REFERENCES users(user_id) ON DELETE RESTRICT,
    action VARCHAR(80) NOT NULL,
    target_entity VARCHAR(80) NOT NULL,
    target_id VARCHAR(80),
    old_data JSONB,
    new_data JSONB,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_events_target ON audit_events(target_entity, target_id);
CREATE INDEX IF NOT EXISTS idx_audit_events_actor ON audit_events(actor_user_id);
CREATE INDEX IF NOT EXISTS idx_audit_events_created_at ON audit_events(created_at);