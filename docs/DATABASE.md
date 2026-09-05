# Database Schema - Certificate Management System v1.3

## Overview

PostgreSQL database with four main tables:
- `students` - Student data
- `users` - Authentication and role information
- `od_records` - On-Duty records
- `certificates` - Certificate submissions

Plus one sequence for atomic registration number generation:
- `registration_number_seq` - Global counter for registration numbers

---

## Table: students

Stores student information.

| Column | Type | Constraints | Description |
|--------|------|-----------|-------------|
| student_id | BIGSERIAL | PRIMARY KEY | Internal system identifier |
| register_number | VARCHAR(20) | NOT NULL, UNIQUE | Institutional/college register number (e.g., 22AD001) |
| name | VARCHAR(255) | NOT NULL | Student full name |
| department | VARCHAR(100) | NOT NULL | Department name |
| year | VARCHAR(50) | | Academic year or class year |
| section | VARCHAR(50) | | Section/section identifier |
| created_at | TIMESTAMP | DEFAULT NOW() | Record creation timestamp |
| updated_at | TIMESTAMP | DEFAULT NOW() | Last update timestamp |

**Indexes**:
- idx_students_department: On (department)
- idx_students_year_section: On (year, section)

**Primary Key**: student_id

**Unique Constraints**: register_number

---

## Table: users

Stores authentication and role information.

| Column | Type | Constraints | Description |
|--------|------|-----------|-------------|
| user_id | BIGSERIAL | PRIMARY KEY | Internal user identifier |
| student_id | BIGINT | FK → students(student_id), NULLABLE | Link to student (NULL for staff) |
| username | VARCHAR(100) | | Username for login |
| role | VARCHAR(50) | NOT NULL | Role: 'student', 'student_representative', 'coordinating_faculty' |
| is_active | BOOLEAN | DEFAULT TRUE | Account active status |
| created_at | TIMESTAMP | DEFAULT NOW() | Record creation timestamp |
| updated_at | TIMESTAMP | DEFAULT NOW() | Last update timestamp |

**Foreign Keys**:
- student_id → students(student_id) ON DELETE SET NULL

**Primary Key**: user_id

**Note**: Authentication credentials (e.g., password_hash) are NOT yet in the schema pending department confirmation of authentication method. Will be added after method is finalized.

---

## Sequence: registration_number_seq

Atomic, concurrency-safe sequence for registration number generation.

```sql
CREATE SEQUENCE registration_number_seq
    START WITH 1
    INCREMENT BY 1;
```

**Characteristics**:
- Atomic: Each call gets a unique value
- Concurrency-safe: No race conditions
- Not gapless: Failed transactions consume values (expected)
- Order-preserving: Earlier registrations get lower numbers
- Stable: Value never changes after assignment

**Format**: Output from sequence is formatted as OD-{number} in application code.

**Example**:
- Sequence value 1 → Registration number "OD-0001"
- Sequence value 42 → Registration number "OD-0042"

---

## Table: od_records

Stores On-Duty records with system-generated registration numbers.

| Column | Type | Constraints | Description |
|--------|------|-----------|-------------|
| od_id | BIGSERIAL | PRIMARY KEY | Internal OD identifier |
| student_id | BIGINT | FK → students(student_id), NOT NULL | Student who obtained OD |
| registration_number | VARCHAR(20) | UNIQUE, NOT NULL | System-generated (e.g., OD-0001) |
| event_details | TEXT | | Event name and participation info |
| created_at | TIMESTAMP | DEFAULT NOW() | Record creation timestamp |
| created_by | VARCHAR(100) | | Student rep who registered OD |
| updated_at | TIMESTAMP | DEFAULT NOW() | Last update timestamp |
| od_status | VARCHAR(50) | DEFAULT 'active' | Status: 'active', 'cancelled' (extensible) |

**Foreign Keys**:
- student_id → students(student_id) ON DELETE CASCADE

**Indexes**:
- idx_od_records_student_id: On (student_id)
- idx_od_records_status: On (od_status)
- idx_od_records_created_at: On (created_at)
- idx_od_records_registration_number: On (registration_number)

**Unique Constraints**:
- registration_number (globally unique, never reused)

**Primary Key**: od_id

**Important**: 
- registration_number is generated via application code using PostgreSQL sequence
- One student can have multiple OD records, each with unique registration number
- od_status field is extensible for future cancellation workflow

---

## Table: certificates

Stores certificate submission records.

| Column | Type | Constraints | Description |
|--------|------|-----------|-------------|
| certificate_id | BIGSERIAL | PRIMARY KEY | Internal certificate identifier |
| od_id | BIGINT | UNIQUE, FK → od_records(od_id), NOT NULL | Associated OD record (one-to-one) |
| student_id | BIGINT | FK → students(student_id), NOT NULL | Student who submitted |
| file_name | VARCHAR(255) | NOT NULL | Original uploaded filename (for reference) |
| file_path | VARCHAR(500) | NOT NULL | Storage location on disk |
| file_size | INTEGER | | File size in bytes |
| file_type | VARCHAR(20) | | File type: 'pdf', 'jpg', 'jpeg', 'png' |
| submitted_at | TIMESTAMP | DEFAULT NOW() | Submission timestamp |
| submission_month | VARCHAR(7) | | Month of submission (YYYY-MM) for reporting |
| created_at | TIMESTAMP | DEFAULT NOW() | Record creation timestamp |
| updated_at | TIMESTAMP | DEFAULT NOW() | Last update timestamp |

**Foreign Keys**:
- od_id → od_records(od_id) ON DELETE CASCADE
- student_id → students(student_id) ON DELETE CASCADE

**Indexes**:
- idx_certificates_student_id: On (student_id)
- idx_certificates_submission_month: On (submission_month)
- idx_certificates_od_id: On (od_id)

**Unique Constraints**:
- od_id (one certificate per OD record maximum)

**Primary Key**: certificate_id

**Important**:
- UNIQUE(od_id) enforces one certificate per OD maximum
- file_path is stored securely, never exposed in URLs
- submission_month used for monthly reporting and filtering
- File access is only through authenticated API endpoints

---

## Relationships

### Student → OD Records (1:Many)
```
students.student_id ← od_records.student_id (NOT NULL)
One student can have many OD records.
```

### OD Record → Certificate (1:0..1)
```
od_records.od_id ← certificates.od_id (UNIQUE)
One OD record can have zero or one certificate.
Each certificate belongs to exactly one OD record.
```

### Diagram
```
students (1) ─── (Many) od_records
                           │
                           │ (1)
                           │
                        (0..1)
                           │
                           └──→ certificates
```

---

## Constraints Summary

| Table | Constraint | Type | Purpose |
|-------|-----------|------|---------|
| students | register_number | UNIQUE | College number must be unique |
| students | student_id | PRIMARY KEY | System identifier |
| users | student_id → students | FOREIGN KEY | Link user to student (nullable) |
| od_records | student_id → students | FOREIGN KEY | Link OD to student |
| od_records | registration_number | UNIQUE | Registration number globally unique |
| certificates | od_id → od_records | FOREIGN KEY + UNIQUE | One cert per OD maximum |
| certificates | student_id → students | FOREIGN KEY | Link cert to student |

---

## Migration

The schema is created via SQL migration:

**File**: `backend/src/migrations/001_initial_schema.sql`

**To run migration**:
```bash
cd backend
npm run migrate
```

The migration creates:
1. students table
2. users table
3. od_records table
4. registration_number_seq sequence
5. certificates table
6. All indexes
7. All constraints

---

## Data Retention

**Important**: Historical records are NOT automatically deleted.

- Deleted student records: Cascade delete OD and certificates (orphaned data cleanup)
- Deleted OD records: Cascade delete associated certificate
- Deleted certificates: Allowed (certificate submission can be deleted)

**Note**: Future data retention/archival policies are pending department confirmation.

---

## Index Strategy

Indexes are created for:
- Foreign key columns (for JOIN performance)
- Filter columns (department, status, month)
- Search columns (registration_number)

This ensures:
- Fast lookups by student
- Fast filtering by month (reporting)
- Fast filtering by status/department
- Efficient JOIN operations

---

## Future Extensions

The schema supports future extensibility:

1. **Authentication Fields** (when method is confirmed):
   - Add password_hash, dob, external_id, etc. to users table

2. **Cancellation Workflow** (when authority is confirmed):
   - Use existing od_status field
   - Add cancelled_reason, cancelled_at, cancelled_by fields

3. **Late Submission Policy** (when deadline is confirmed):
   - Use existing submission_month field
   - Add is_late flag or late_calculated_at field

4. **Multi-Department Support**:
   - Already stores department in students table
   - Add authorization filters in application code

5. **Audit Trail** (if required):
   - Add audit table or JSON log columns
   - Track who made what changes when

---

## Backup & Recovery

Database should be:
- Backed up regularly (daily recommended)
- Point-in-time recovery capability
- Tested recovery procedures

Connection string for backups:
```
postgres://user:password@localhost:5432/certificate_management
```
