-- Phase 2 completion: CR role in users, import sessions, active class filter

-- 1. Expand role check to include class_representative
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users
    ADD CONSTRAINT users_role_check
    CHECK (role IN (
        'super_admin', 'admin', 'coordinating_faculty',
        'class_advisor', 'class_representative', 'student_representative', 'student'
    ));

-- 2. Import sessions table for safe two-step bulk import
CREATE TABLE IF NOT EXISTS import_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    class_id BIGINT NOT NULL REFERENCES classes(id) ON DELETE RESTRICT,
    created_by BIGINT NOT NULL REFERENCES users(user_id) ON DELETE RESTRICT,
    validated_rows JSONB NOT NULL,
    summary JSONB NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMP NOT NULL DEFAULT (NOW() + INTERVAL '30 minutes')
);

CREATE INDEX IF NOT EXISTS idx_import_sessions_class ON import_sessions(class_id);
CREATE INDEX IF NOT EXISTS idx_import_sessions_created_by ON import_sessions(created_by);
CREATE INDEX IF NOT EXISTS idx_import_sessions_expires_at ON import_sessions(expires_at);

-- 3. Drop the redundant student-uniqueness constraint on class_representatives.
--    A student belongs to exactly one class; the PK (class_id, student_id) is sufficient.
ALTER TABLE class_representatives DROP CONSTRAINT IF EXISTS class_representative_student_unique;

-- 4. Add class_id column to users for class_representative scoping
ALTER TABLE users ADD COLUMN IF NOT EXISTS class_id BIGINT REFERENCES classes(id) ON DELETE RESTRICT;
CREATE INDEX IF NOT EXISTS idx_users_class_id ON users(class_id);

-- 5. Add details column to audit_events for human-readable notes
ALTER TABLE audit_events ADD COLUMN IF NOT EXISTS details TEXT;