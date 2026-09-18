-- Phase 1: organizational hierarchy and historical context.

CREATE TABLE IF NOT EXISTS departments (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    code VARCHAR(30) NOT NULL UNIQUE,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS academic_years (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(20) NOT NULL UNIQUE,
    start_date DATE,
    end_date DATE,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    CONSTRAINT academic_years_date_order CHECK (end_date IS NULL OR start_date IS NULL OR end_date >= start_date)
);

CREATE TABLE IF NOT EXISTS classes (
    id BIGSERIAL PRIMARY KEY,
    department_id BIGINT NOT NULL REFERENCES departments(id) ON DELETE RESTRICT,
    academic_year_id BIGINT NOT NULL REFERENCES academic_years(id) ON DELETE RESTRICT,
    year_of_study VARCHAR(50) NOT NULL,
    section VARCHAR(50) NOT NULL,
    display_name VARCHAR(150) NOT NULL,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    CONSTRAINT classes_combination_unique UNIQUE (department_id, academic_year_id, year_of_study, section)
);

CREATE INDEX IF NOT EXISTS idx_classes_department ON classes(department_id);
CREATE INDEX IF NOT EXISTS idx_classes_academic_year ON classes(academic_year_id);
CREATE INDEX IF NOT EXISTS idx_classes_active ON classes(active);

ALTER TABLE students
    ADD COLUMN IF NOT EXISTS class_id BIGINT,
    ADD COLUMN IF NOT EXISTS academic_year_id BIGINT,
    ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE';

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'students_status_check'
    ) THEN
        ALTER TABLE students
            ADD CONSTRAINT students_status_check
            CHECK (status IN ('ACTIVE', 'INACTIVE', 'GRADUATED', 'TRANSFERRED'));
    END IF;
END $$;

-- Existing text-only student data is retained and mapped into a Legacy academic year.
INSERT INTO departments (name, code)
SELECT DISTINCT trim(s.department), trim(s.department)
FROM students s
WHERE trim(s.department) <> ''
ON CONFLICT (code) DO NOTHING;

INSERT INTO academic_years (name)
SELECT 'Legacy'
WHERE EXISTS (SELECT 1 FROM students)
ON CONFLICT (name) DO NOTHING;

INSERT INTO classes (department_id, academic_year_id, year_of_study, section, display_name)
SELECT DISTINCT
    d.id,
    ay.id,
    COALESCE(NULLIF(trim(s.year), ''), 'Unknown'),
    COALESCE(NULLIF(trim(s.section), ''), 'UNASSIGNED'),
    d.code || '-' || COALESCE(NULLIF(trim(s.section), ''), 'UNASSIGNED')
FROM students s
JOIN departments d ON d.name = trim(s.department)
JOIN academic_years ay ON ay.name = 'Legacy'
ON CONFLICT (department_id, academic_year_id, year_of_study, section) DO NOTHING;

UPDATE students s
SET class_id = c.id,
    academic_year_id = c.academic_year_id
FROM classes c
JOIN departments d ON d.id = c.department_id
JOIN academic_years ay ON ay.id = c.academic_year_id
WHERE s.class_id IS NULL
  AND d.name = trim(s.department)
  AND ay.name = 'Legacy'
  AND c.year_of_study = COALESCE(NULLIF(trim(s.year), ''), 'Unknown')
  AND c.section = COALESCE(NULLIF(trim(s.section), ''), 'UNASSIGNED');

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'students_class_fkey') THEN
        ALTER TABLE students
            ADD CONSTRAINT students_class_fkey FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE RESTRICT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'students_academic_year_fkey') THEN
        ALTER TABLE students
            ADD CONSTRAINT students_academic_year_fkey FOREIGN KEY (academic_year_id) REFERENCES academic_years(id) ON DELETE RESTRICT;
    END IF;
END $$;

ALTER TABLE students
    ALTER COLUMN class_id SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_students_class_id ON students(class_id);
CREATE INDEX IF NOT EXISTS idx_students_academic_year_id ON students(academic_year_id);
CREATE INDEX IF NOT EXISTS idx_students_status ON students(status);

ALTER TABLE od_records
    ADD COLUMN IF NOT EXISTS class_id BIGINT,
    ADD COLUMN IF NOT EXISTS academic_year_id BIGINT;

UPDATE od_records od
SET class_id = s.class_id,
    academic_year_id = s.academic_year_id
FROM students s
WHERE od.student_id = s.student_id
  AND od.class_id IS NULL;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'od_records_class_fkey') THEN
        ALTER TABLE od_records
            ADD CONSTRAINT od_records_class_fkey FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE RESTRICT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'od_records_academic_year_fkey') THEN
        ALTER TABLE od_records
            ADD CONSTRAINT od_records_academic_year_fkey FOREIGN KEY (academic_year_id) REFERENCES academic_years(id) ON DELETE RESTRICT;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_od_records_class_id ON od_records(class_id);
CREATE INDEX IF NOT EXISTS idx_od_records_academic_year_id ON od_records(academic_year_id);