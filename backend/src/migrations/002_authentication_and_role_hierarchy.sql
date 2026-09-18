-- Certificate Management System v1.3
-- Authentication and role hierarchy migration

ALTER TABLE users
    ADD COLUMN IF NOT EXISTS password_hash TEXT,
    ADD COLUMN IF NOT EXISTS assigned_faculty_id BIGINT;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'users_assigned_faculty_fkey'
    ) THEN
        ALTER TABLE users
            ADD CONSTRAINT users_assigned_faculty_fkey
            FOREIGN KEY (assigned_faculty_id) REFERENCES users(user_id) ON DELETE RESTRICT;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'users_role_check'
    ) THEN
        ALTER TABLE users
            ADD CONSTRAINT users_role_check
            CHECK (role IN ('coordinating_faculty', 'student_representative', 'student'));
    END IF;
END $$;

-- Existing student accounts use register numbers as their final login identifiers.
UPDATE users u
SET username = s.register_number
FROM students s
WHERE u.student_id = s.student_id
  AND u.role = 'student'
  AND u.username IS DISTINCT FROM s.register_number;

-- Preserve existing staff accounts while assigning existing representatives to the
-- first available faculty account when one exists.
UPDATE users rep
SET assigned_faculty_id = faculty.user_id
FROM (
    SELECT user_id FROM users
    WHERE role = 'coordinating_faculty'
    ORDER BY user_id
    LIMIT 1
) faculty
WHERE rep.role = 'student_representative'
  AND rep.assigned_faculty_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_assigned_faculty ON users(assigned_faculty_id);

-- The role hierarchy permits unprovisioned legacy rows during migration. New
-- account-management APIs require credentials before an account can log in.
