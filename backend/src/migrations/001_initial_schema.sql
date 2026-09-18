-- Certificate Management System v1.3
-- Initial Database Schema Migration
-- Created: 2026-09-05

-- Step 1: Create students table (no dependencies)
CREATE TABLE IF NOT EXISTS students (
    student_id BIGSERIAL PRIMARY KEY,
    register_number VARCHAR(20) NOT NULL UNIQUE,
    name VARCHAR(255) NOT NULL,
    department VARCHAR(100) NOT NULL,
    year VARCHAR(50),
    section VARCHAR(50),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Step 2: Create users table (foreign key to students, nullable for staff)
CREATE TABLE IF NOT EXISTS users (
    user_id BIGSERIAL PRIMARY KEY,
    student_id BIGINT REFERENCES students(student_id) ON DELETE RESTRICT,
    username VARCHAR(100),
    role VARCHAR(50) NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Step 3: Create od_records table (foreign key to students)
CREATE TABLE IF NOT EXISTS od_records (
    od_id BIGSERIAL PRIMARY KEY,
    student_id BIGINT NOT NULL REFERENCES students(student_id) ON DELETE RESTRICT,
    registration_number VARCHAR(20),
    event_details TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    created_by VARCHAR(100),
    updated_at TIMESTAMP DEFAULT NOW(),
    od_status VARCHAR(50) DEFAULT 'active'
);

-- Step 4: Create sequence for registration_number generation
-- Note: Sequence is atomic and concurrency-safe but NOT gapless
-- (failed transactions consume sequence values)
CREATE SEQUENCE IF NOT EXISTS registration_number_seq
    START WITH 1
    INCREMENT BY 1;

-- Step 5: Add UNIQUE constraint to registration_number
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'unique_registration_number'
          AND conrelid = 'od_records'::regclass
    ) THEN
        ALTER TABLE od_records
            ADD CONSTRAINT unique_registration_number UNIQUE(registration_number);
    END IF;
END $$;

-- Step 6: Create certificates table (foreign keys to od_records and students)
CREATE TABLE IF NOT EXISTS certificates (
    certificate_id BIGSERIAL PRIMARY KEY,
    od_id BIGINT UNIQUE NOT NULL REFERENCES od_records(od_id) ON DELETE RESTRICT,
    student_id BIGINT NOT NULL REFERENCES students(student_id) ON DELETE RESTRICT,
    file_name VARCHAR(255) NOT NULL,
    file_path VARCHAR(500) NOT NULL,
    file_size INTEGER,
    file_type VARCHAR(20),
    submitted_at TIMESTAMP DEFAULT NOW(),
    submission_month VARCHAR(7),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Step 7: Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_students_department ON students(department);
CREATE INDEX IF NOT EXISTS idx_students_year_section ON students(year, section);
CREATE INDEX IF NOT EXISTS idx_od_records_student_id ON od_records(student_id);
CREATE INDEX IF NOT EXISTS idx_od_records_status ON od_records(od_status);
CREATE INDEX IF NOT EXISTS idx_od_records_created_at ON od_records(created_at);
CREATE INDEX IF NOT EXISTS idx_od_records_registration_number ON od_records(registration_number);
CREATE INDEX IF NOT EXISTS idx_certificates_student_id ON certificates(student_id);
CREATE INDEX IF NOT EXISTS idx_certificates_submission_month ON certificates(submission_month);
CREATE INDEX IF NOT EXISTS idx_certificates_od_id ON certificates(od_id);
