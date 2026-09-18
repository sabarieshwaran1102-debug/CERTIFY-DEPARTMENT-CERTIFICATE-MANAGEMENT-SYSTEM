# API Endpoints - Certificate Management System v1.3

## Base URL
```
http://localhost:5000/api
```

## Authentication

All protected endpoints require a JWT token in the Authorization header:
```
Authorization: Bearer <token>
```

---

## Authentication Endpoints

### POST /auth/login
Authenticate user and receive JWT token.

**Status**: Pending authentication method confirmation
**Note**: Implementation method TBD by department

**Response**:
```json
{
    "token": "eyJhbGciOiJIUzI1NiIs...",
    "user": {
        "user_id": 1,
        "student_id": "101",
        "role": "student"
    }
}
```

### POST /auth/logout
Invalidate session.

**Status**: Implemented (Phase 1)

### GET /auth/me
Get authenticated user information.

**Status**: Implemented (Phase 1)

**Response**:
```json
{
    "user": {
        "user_id": 1,
        "student_id": "101",
        "role": "student"
    }
}
```

---

## Student Endpoints

**Required Role**: `student`

### GET /students/me
Get authenticated student's own information.

**Status**: Implemented (Phase 2)

**Response**:
```json
{
    "student_id": "101",
    "register_number": "22AD001",
    "name": "Alice Johnson",
    "department": "Computer Science",
    "year": "3rd Year",
    "section": "A"
}
```

### GET /students/me/od-records
List authenticated student's OD records.

**Status**: Implemented (Phase 2)

**Response**:
```json
[
    {
        "od_id": 1,
        "registration_number": "OD-0001",
        "event_details": "National Seminar on AI",
        "created_at": "2026-01-15T10:30:00Z",
        "status": "pending"  // pending or submitted
    }
]
```

### GET /students/me/certificates
List authenticated student's submitted certificates.

**Status**: Implemented (Phase 2)

**Response**:
```json
[
    {
        "certificate_id": 1,
        "od_id": 1,
        "registration_number": "OD-0001",
        "file_name": "certificate.pdf",
        "submitted_at": "2026-01-20T14:30:00Z",
        "file_type": "pdf"
    }
]
```

---

## Certificate Endpoints

### POST /certificates
Submit a certificate for an OD record (Student only).

**Required Role**: `student`

**Status**: Implemented (Phase 2)

**Request**:
```
Content-Type: multipart/form-data

Fields:
- registration_number (string): The OD registration number (e.g., OD-0001)
- file (binary): The certificate file (PDF, JPG, JPEG, or PNG, max 5MB)
```

**Response**:
```json
{
    "certificate_id": 1,
    "od_id": 1,
    "registration_number": "OD-0001",
    "file_type": "pdf",
    "submitted_at": "2026-01-20T14:30:00Z",
    "status": "submitted"
}
```

**Error Cases**:
- Invalid registration number (404)
- OD record doesn't belong to authenticated student (403)
- Certificate already submitted for this OD (409)
- Invalid file type (400)
- File size exceeds 5MB (413)

### GET /certificates/:certId/download
Download a certificate file.

**Status**: Implemented for students (Phase 2); faculty access is not part of this phase

**Authorization**: 
- Student can download own certificates
- Faculty can download any certificate

**Response**: Binary file with appropriate Content-Type header

---

## Student Representative Endpoints

**Required Role**: `student_representative`

### GET /students
Search students for OD registration.

**Status**: Implemented (Phase 3)

**Query Parameters**:
- `name` (optional): Filter by name
- `department` (optional): Filter by department

**Response**:
```json
[
    {
        "student_id": "101",
        "register_number": "22AD001",
        "name": "Alice Johnson",
        "department": "Computer Science",
        "year": "3rd Year",
        "section": "A"
    }
]
```

### POST /od-records
Register a new OD record (generates registration number atomically).

**Status**: Implemented (Phase 3)

**Request**:
```json
{
    "student_id": "101",
    "event_details": "National Seminar on AI"
}
```

**Response**:
```json
{
    "od_id": 1,
    "registration_number": "OD-0001",
    "student_id": "101",
    "event_details": "National Seminar on AI",
    "created_at": "2026-01-15T10:30:00Z"
}
```

**Note**: Registration number is generated atomically via PostgreSQL sequence.

### GET /od-records
List registered OD records.

**Status**: Implemented (Phase 3)

**Query Parameters**:
- `status` (optional): Filter by status (active, cancelled)
- `department` (optional): Filter by department
- `month` (optional): Filter by month (YYYY-MM)

**Response**:
```json
[
    {
        "od_id": 1,
        "registration_number": "OD-0001",
        "student_id": "101",
        "register_number": "22AD001",
        "name": "Alice Johnson",
        "event_details": "National Seminar on AI",
        "created_at": "2026-01-15T10:30:00Z",
        "status": "active",
        "certificate_submitted": false
    }
]
```

### GET /od-records/:odId
Get specific OD record details.

**Status**: Implemented (Phase 3)

---

## Coordinating Faculty Endpoints

**Required Role**: `coordinating_faculty`

### GET /od-records
List all OD records.

**Status**: Implemented for Coordinating Faculty (Phase 4)

**Query Parameters**:
- `status` (optional): Filter by status
- `department` (optional): Filter by department
- `year` (optional): Filter by year
- `section` (optional): Filter by section
- `month` (optional): Filter by month (YYYY-MM)

**Response**: Array of OD records with certificate status

### GET /od-records/certificates
View certificate submission status for OD records.

**Status**: Not implemented; use `GET /reports/monthly-summary` for Phase 4 status data.

**Query Parameters**:
- `month` (optional): Filter by month (YYYY-MM)
- `department` (optional): Filter by department

**Response**:
```json
{
    "total_od": 10,
    "submitted_certificates": 7,
    "missing_certificates": 3,
    "records": [...]
}
```

### GET /certificates
List all certificates.

**Status**: Implemented for Coordinating Faculty (Phase 4)

**Query Parameters**:
- `month` (optional): Filter by month
- `department` (optional): Filter by department

### GET /certificates/:certId/download
Download any certificate (Faculty access).

**Status**: Implemented for Student and Coordinating Faculty

### POST /reports/excel
Generate and download monthly Excel report.

**Status**: Implemented (Phase 4)

**Request**:
```json
{
    "month": "2026-01",
    "department": "Computer Science",
    "year": "3rd Year",
    "section": "A"
}
```

**Response**: Binary Excel file

**Report Contents**:
- One worksheet containing each OD record created in the selected month
- Student, event, OD status, certificate submitted flag, certificate filename, and submission timestamp

### POST /reports/certificates-zip
Bulk download certificates as ZIP.

**Status**: Implemented (Phase 4)

**Request**:
```json
{
    "month": "2026-01",
    "department": "Computer Science"
}
```

**Response**: Binary ZIP file

**ZIP Contents**:
Certificates named: `{register_number}_{registration_number}.{ext}`

Example:
```
22AD001_OD-0001.pdf
22AD002_OD-0002.jpg
22AD001_OD-0003.png
```

### GET /reports/monthly-summary
Get monthly data summary (for dashboard display).

**Status**: Implemented (Phase 4)

---

## Error Responses

All error responses follow this format:

```json
{
    "error": "Error message description"
}
```

**Common Status Codes**:
- `400`: Bad Request (invalid input)
- `401`: Unauthorized (missing/invalid token)
- `403`: Forbidden (insufficient permissions)
- `404`: Not Found
- `409`: Conflict (e.g., duplicate certificate)
- `413`: Payload Too Large (file exceeds 5MB)
- `500`: Internal Server Error

---

## Health Check

### GET /health
System health check (no authentication required).

**Status**: Implemented (Phase 0)

**Response**:
```json
{
    "status": "OK",
    "timestamp": "2026-01-15T10:30:00Z"
}
```

---

## Notes

- All timestamps are in ISO 8601 format (UTC)
- All dates use format YYYY-MM or YYYY-MM-DD
- File uploads use multipart/form-data
- Binary responses (files) use appropriate Content-Type headers
- Authentication method is pending department confirmation
