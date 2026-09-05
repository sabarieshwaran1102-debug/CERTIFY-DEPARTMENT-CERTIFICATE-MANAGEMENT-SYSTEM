# Certificate Management System v1.3 - Design Document

## Overview

This document contains the complete design for the Certificate Management System v1.3 as approved and finalized.

See the DESIGN_FINAL.md in this directory for the full detailed design.

## Quick Links

- [API Endpoints](./API.md)
- [Database Schema](./DATABASE.md)
- [Architecture Diagram](./ARCHITECTURE.md)

## Key Design Decisions

### 1. Registration Number Generation
- PostgreSQL sequence for atomic, concurrency-safe generation
- Format: OD-0001, OD-0002, OD-0003, ...
- Globally unique (never reused)
- Stable after creation
- Note: Sequences may have gaps due to failed transactions (expected behavior)

### 2. Student ID vs Register Number
- **student_id**: Internal database identifier (BIGSERIAL/identity)
- **register_number**: Institutional college number (e.g., 22AD001)
- Foreign keys use student_id
- Reports and filenames use register_number

### 3. Three Roles
- **Student**: Can submit certificates for their own OD records
- **Student Representative**: Can register OD records
- **Coordinating Faculty**: Can view records, generate reports

### 4. File Storage
- Secure file storage outside web root
- Access only through authenticated API endpoints
- Filenames: {register_number}_{registration_number}.{ext}
- Organized by month: /storage/certificates/YYYY/MM/

### 5. Monthly Reporting
- Excel export with OD records, certificates, missing certificates
- ZIP download of certificates for a month
- Optional filtering by department, year, section

## Pending Department Decisions

The following items require department confirmation before implementation:

1. **Authentication Method**
   - Options: Password, Register#/DOB, OTP, SSO, Institutional OAuth
   - Implementation: Abstract provider pattern, configurable at runtime

2. **OD Blocking Policy**
   - Options: Hard Stop (block new OD if cert missing), Soft Warning, Independent
   - Implementation: Placeholder, no blocking implemented until confirmed

3. **OD Cancellation Authority**
   - Questions: Who can cancel? What reasons valid? Should appear in reports?
   - Implementation: Database field exists (od_status), UI not implemented

4. **Late Submission Policy**
   - Questions: What is deadline? How calculated? Consequences?
   - Implementation: Database field exists (submission_month), logic configurable

5. **Department Scope**
   - Questions: Single department or multi-department system?
   - Implementation: Department fields present, no hard restrictions

6. **Edit Authority**
   - Questions: Can Student Reps edit OD? Can Faculty correct? Audit log?
   - Implementation: OD records immutable, edit endpoints not created

## Confirmed Requirements

✅ Three-role system (Student, Student Rep, Faculty)
✅ Atomic registration number generation (OD-0001, OD-0002, ...)
✅ Student ownership validation (server-side)
✅ Certificate file upload (PDF, JPG, JPEG, PNG, max 5MB)
✅ Monthly Excel export
✅ Bulk ZIP download
✅ Role-based API authorization
✅ Secure file storage (API access only)

## Explicitly Not Implemented

❌ Event announcement/discovery system
❌ Certificate verification/approval/rejection workflow
❌ Automatic OD blocking due to pending certificate
❌ Participation verification
❌ Assumed authentication method
❌ Unnecessary Admin role
❌ Multi-tenancy complexity
❌ AI, OCR, blockchain, QR codes, GPS, payments, leaderboards

## Development Status

**Phase 0**: Project Setup ✅ COMPLETE
**Phases 1-10**: Pending approval to proceed

See README.md for development phases and timeline.
