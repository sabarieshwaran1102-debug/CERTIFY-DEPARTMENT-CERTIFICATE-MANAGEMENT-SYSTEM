-- Add the finalized admin role and student date-of-birth field.
-- NOTE: The role check is updated to the final Phase 2 complete role list so
-- this migration is safe to replay against a live database that already has
-- rows with roles introduced in later migrations (class_advisor, super_admin).

ALTER TABLE students
    ADD COLUMN IF NOT EXISTS date_of_birth DATE;

ALTER TABLE users
    DROP CONSTRAINT IF EXISTS users_role_check;

ALTER TABLE users
    ADD CONSTRAINT users_role_check
    CHECK (role IN (
        'super_admin',
        'admin',
        'coordinating_faculty',
        'class_advisor',
        'class_representative',
        'student_representative',
        'student'
    ));

CREATE INDEX IF NOT EXISTS idx_students_date_of_birth ON students(date_of_birth);
