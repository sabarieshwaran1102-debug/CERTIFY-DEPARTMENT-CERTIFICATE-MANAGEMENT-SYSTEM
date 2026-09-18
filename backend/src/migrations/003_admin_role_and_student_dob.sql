-- Add the finalized admin role and student date-of-birth field.

ALTER TABLE students
    ADD COLUMN IF NOT EXISTS date_of_birth DATE;

ALTER TABLE users
    DROP CONSTRAINT IF EXISTS users_role_check;

ALTER TABLE users
    ADD CONSTRAINT users_role_check
    CHECK (role IN ('admin', 'coordinating_faculty', 'student_representative', 'student'));

CREATE INDEX IF NOT EXISTS idx_students_date_of_birth ON students(date_of_birth);