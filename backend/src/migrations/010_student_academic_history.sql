-- Migration 010: Student Academic History
-- Permanent enrollment record per student per academic year.
-- Backfills from current student class assignment.

CREATE TABLE IF NOT EXISTS student_academic_history (
    id                  BIGSERIAL   PRIMARY KEY,
    student_id          BIGINT      NOT NULL REFERENCES students(student_id) ON DELETE CASCADE,
    academic_year_id    BIGINT      NOT NULL REFERENCES academic_years(id)   ON DELETE RESTRICT,
    class_id            BIGINT      NOT NULL REFERENCES classes(id)          ON DELETE RESTRICT,
    status              VARCHAR(20) NOT NULL DEFAULT 'active'
                            CHECK (status IN ('active','promoted','graduated','transferred','inactive')),
    notes               TEXT,
    enrolled_at         TIMESTAMP   NOT NULL DEFAULT NOW(),
    exited_at           TIMESTAMP,
    created_at          TIMESTAMP   NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMP   NOT NULL DEFAULT NOW(),
    CONSTRAINT sah_student_year_unique UNIQUE (student_id, academic_year_id)
);

CREATE INDEX IF NOT EXISTS idx_sah_student_id       ON student_academic_history(student_id);
CREATE INDEX IF NOT EXISTS idx_sah_academic_year_id ON student_academic_history(academic_year_id);
CREATE INDEX IF NOT EXISTS idx_sah_class_id         ON student_academic_history(class_id);
CREATE INDEX IF NOT EXISTS idx_sah_status           ON student_academic_history(status);

-- Backfill: one record per existing student using their current class + academic year.
-- Safe to re-run (ON CONFLICT DO NOTHING).
INSERT INTO student_academic_history (student_id, academic_year_id, class_id, status, notes)
SELECT
    s.student_id,
    s.academic_year_id,
    s.class_id,
    CASE s.status
        WHEN 'ACTIVE'      THEN 'active'
        WHEN 'INACTIVE'    THEN 'inactive'
        WHEN 'GRADUATED'   THEN 'graduated'
        WHEN 'TRANSFERRED' THEN 'transferred'
        ELSE 'active'
    END,
    'Backfilled from existing enrollment'
FROM students s
WHERE s.academic_year_id IS NOT NULL
  AND s.class_id IS NOT NULL
ON CONFLICT (student_id, academic_year_id) DO NOTHING;
