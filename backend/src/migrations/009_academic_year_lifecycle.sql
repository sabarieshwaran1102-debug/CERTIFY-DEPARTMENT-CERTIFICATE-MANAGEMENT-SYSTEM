-- Phase 7: Academic Year Lifecycle
-- Adds promotion tracking and ensures only one active academic year is enforced.

-- ── Promotion history ─────────────────────────────────────────────────────────
-- Records each bulk promotion operation for audit/rollback visibility.
CREATE TABLE IF NOT EXISTS academic_year_promotions (
    id                  BIGSERIAL   PRIMARY KEY,
    from_academic_year_id BIGINT    NOT NULL REFERENCES academic_years(id) ON DELETE RESTRICT,
    to_academic_year_id   BIGINT    NOT NULL REFERENCES academic_years(id) ON DELETE RESTRICT,
    promoted_by         BIGINT      NOT NULL REFERENCES users(user_id)     ON DELETE RESTRICT,
    promoted_at         TIMESTAMP   NOT NULL DEFAULT NOW(),
    student_count       INTEGER     NOT NULL DEFAULT 0,
    class_mapping       JSONB,   -- { fromClassId: toClassId, ... }
    notes               TEXT
);

CREATE INDEX IF NOT EXISTS idx_ay_promotions_from ON academic_year_promotions(from_academic_year_id);
CREATE INDEX IF NOT EXISTS idx_ay_promotions_to   ON academic_year_promotions(to_academic_year_id);
CREATE INDEX IF NOT EXISTS idx_ay_promotions_by   ON academic_year_promotions(promoted_by);
