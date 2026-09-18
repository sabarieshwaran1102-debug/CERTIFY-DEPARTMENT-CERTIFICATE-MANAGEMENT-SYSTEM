# Certificate Management System — Backend API

Express.js REST API for the Certificate Management System. Provides JWT-authenticated, role-based endpoints for OD registration, certificate submission, report generation, and account management. Backed by PostgreSQL.

---

## Table of Contents

- [Quick Start](#quick-start)
- [Project Structure](#project-structure)
- [Environment Variables](#environment-variables)
- [Database Setup](#database-setup)
- [Authentication and Roles](#authentication-and-roles)
- [API Endpoints](#api-endpoints)
- [Middleware](#middleware)
- [Models](#models)
- [File Storage](#file-storage)
- [Report Generation](#report-generation)
- [Running Tests](#running-tests)
- [Scripts](#scripts)
- [Dependencies](#dependencies)
- [Troubleshooting](#troubleshooting)

---

## Quick Start

```powershell
cd backend
npm install
copy .env.example .env
# Edit .env — set DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD, JWT_SECRET

# Create the PostgreSQL database (run once)
# psql: CREATE DATABASE certificate_management;

npm run migrate          # Run all three SQL migrations
npm run bootstrap-admin  # (Optional) Create first admin account
npm start                # Start server on http://localhost:5000
```

Health check: `GET http://localhost:5000/api/health` → `{ "status": "OK" }`

---

## Project Structure

```
backend/
├── server.js                        # HTTP server entry point
├── .env.example                     # Environment template
├── package.json
└── src/
    ├── app.js                       # Express app factory
    │                                #   CORS, JSON body, routes, error handler
    ├── config/
    │   ├── database.js              # pg.Pool instance (shared across models)
    │   └── storage.js               # STORAGE_PATH resolution helper
    ├── middleware/
    │   ├── auth.js                  # verifyToken  +  requireRole
    │   ├── authorization.js         # requireStudentOwnership
    │   │                            # requireStudentRepRole
    │   │                            # requireFacultyRole
    │   └── errorHandler.js          # AppError class + centralised error handler
    ├── models/
    │   ├── User.js                  # users table access
    │   ├── Student.js               # students table access
    │   ├── ODRecord.js              # od_records + sequence logic
    │   └── Certificate.js           # certificates table + reporting queries
    ├── routes/
    │   ├── auth.js                  # /api/auth
    │   ├── users.js                 # /api/users
    │   ├── students.js              # /api/students
    │   ├── od-records.js            # /api/od-records
    │   ├── certificates.js          # /api/certificates  (multer here)
    │   └── reports.js               # /api/reports  (ExcelJS + AdmZip)
    ├── migrations/
    │   ├── 001_initial_schema.sql
    │   ├── 002_authentication_and_role_hierarchy.sql
    │   ├── 003_admin_role_and_student_dob.sql
    │   └── runMigrations.js         # Executes all three files in order
    ├── controllers/                 # Reserved — logic currently in route handlers
    ├── services/                    # Reserved
    └── utils/
        ├── asyncHandler.js          # Wraps async route handlers
        ├── bootstrap-admin.js       # CLI: create first admin account
        └── seedTestData.js          # Insert local test fixtures
```

---

## Environment Variables

Copy `.env.example` to `.env` and fill in every value before starting.

| Variable | Example | Required | Description |
|---|---|---|---|
| `DB_HOST` | `localhost` | Yes | PostgreSQL hostname |
| `DB_PORT` | `5432` | Yes | PostgreSQL port |
| `DB_NAME` | `certificate_management` | Yes | Database name |
| `DB_USER` | `postgres` | Yes | Database user |
| `DB_PASSWORD` | `changeme` | Yes | Database password |
| `PORT` | `5000` | No | Express listen port (default 5000) |
| `NODE_ENV` | `development` | No | `development` or `production` |
| `JWT_SECRET` | `a-long-random-string` | Yes | HS256 signing key — min 32 chars in production |
| `JWT_EXPIRY` | `30m` | No | Token lifetime (default 30 minutes) |
| `STORAGE_PATH` | `../storage/certificates` | Yes (prod) | Certificate file root directory |
| `MAX_FILE_SIZE` | `5242880` | No | Max upload bytes (default 5 MB) |
| `CORS_ORIGIN` | `http://localhost:5173` | Yes (prod) | Allowed origin(s), comma-separated |

### Production Guards

`app.js` throws at startup if any production constraint is violated:

- `JWT_SECRET` must be at least 32 characters and not the placeholder value.
- `CORS_ORIGIN` must be an explicit allowlist — `*` is rejected.
- `STORAGE_PATH` must be set.
- All requests arriving over plain HTTP receive `403 HTTPS is required`.

---

## Database Setup

### Create the database

```sql
-- Run in psql or pgAdmin
CREATE DATABASE certificate_management;
```

### Run migrations

```powershell
npm run migrate
```

`runMigrations.js` executes the three SQL files in sequence:

| File | What it creates |
|---|---|
| `001_initial_schema.sql` | `students`, `users`, `od_records`, `certificates` tables; `registration_number_seq` sequence; all indexes and foreign keys |
| `002_authentication_and_role_hierarchy.sql` | `password_hash` and `assigned_faculty_id` columns on `users`; role `CHECK` constraint; sets student usernames to register numbers; authentication indexes |
| `003_admin_role_and_student_dob.sql` | `admin` role in `CHECK` constraint; `date_of_birth DATE` column on `students`; `idx_students_date_of_birth` index |

Migrations are idempotent where possible and run inside transactions. Re-running a completed migration is safe.

### Schema overview

```
students ──< od_records ──0..1── certificates
users ──────────────────────────────────────── → students (student_id nullable)
users (assigned_faculty_id) ────────────────── → users (self-ref rep→faculty)
```

| Table | Key Columns |
|---|---|
| `students` | `student_id` PK, `register_number` UNIQUE, `name`, `department`, `year`, `section`, `date_of_birth` |
| `users` | `user_id` PK, `username`, `role` CHECK, `password_hash`, `is_active`, `student_id` FK, `assigned_faculty_id` FK |
| `od_records` | `od_id` PK, `student_id` FK, `registration_number` UNIQUE, `event_details`, `created_by`, `od_status` |
| `certificates` | `certificate_id` PK, `od_id` UNIQUE FK, `student_id` FK, `file_name`, `file_path`, `file_type`, `file_size`, `submission_month` |
| `registration_number_seq` | Sequence — values formatted as `OD-0001`, `OD-0042`, etc. |

---

## Authentication and Roles

### How login works

`POST /api/auth/login` accepts `{ username, password }`.

- **Students** — `username` is the institutional register number (e.g., `22AD001`); `password` is the date of birth in `YYYY-MM-DD` format. The model's `getForLogin` method routes this through a join on the `students` table.
- **Staff (faculty, rep, admin)** — `username` is a provisioned string; `password` is a bcrypt-hashed credential stored in `users.password_hash`.

On success the server signs a JWT `{ user_id }` with HS256 and `JWT_SECRET`, returning `{ token, user }`. The token expires after `JWT_EXPIRY`.

### Middleware chain

Every protected route passes through:

```
verifyToken  →  requireRole / requireStudentOwnership
```

`verifyToken` (`middleware/auth.js`):
1. Reads the `Authorization: Bearer <token>` header.
2. Verifies the JWT signature and expiry.
3. Loads the full user row from the database and confirms `is_active = true`.
4. Attaches `{ user_id, student_id, role, username, assigned_faculty_id }` to `req.user`.

`requireRole(...allowedRoles)` returns a middleware that checks `req.user.role` against the given list.

`requireStudentOwnership` (`middleware/authorization.js`) compares `req.user.student_id` against the resource's `student_id` — used for certificate submission and download.

### Role summary

| Role | Value in DB | Who creates it | Key permissions |
|---|---|---|---|
| Administrator | `admin` | `bootstrap-admin` script | Create/update coordinating faculty |
| Coordinating Faculty | `coordinating_faculty` | Admin | Create/update reps; view all records; generate reports |
| Student Representative | `student_representative` | Faculty | Search students; register OD records |
| Student | `student` | Seeded from students table | View own records; submit and download certificates |

---

## API Endpoints

Base URL: `http://localhost:5000/api`

### Health

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/health` | None | Returns `{ status: "OK", timestamp }` |

### Authentication — `/auth`

| Method | Path | Auth | Role | Description |
|---|---|---|---|---|
| POST | `/auth/login` | No | — | Login. Body: `{ username, password }`. Returns `{ token, user }` |
| POST | `/auth/logout` | JWT | Any | Stateless — client discards token. Returns `{ message }` |
| GET | `/auth/me` | JWT | Any | Full user object + linked student info |

### User Management — `/users`

| Method | Path | Auth | Role | Description |
|---|---|---|---|---|
| GET | `/users/coordinating-faculty` | JWT | `admin` | List all faculty accounts |
| POST | `/users/coordinating-faculty` | JWT | `admin` | Create faculty. Body: `{ username, password }` |
| PATCH | `/users/coordinating-faculty/:userId` | JWT | `admin` | Update faculty `is_active` or `password` |
| GET | `/users/student-representatives` | JWT | `coordinating_faculty` | List reps assigned to calling faculty |
| POST | `/users/student-representatives` | JWT | `coordinating_faculty` | Create rep assigned to calling faculty. Body: `{ username, password }` |
| PATCH | `/users/student-representatives/:userId` | JWT | `coordinating_faculty` | Update own rep's `is_active` or `password` |

### Students — `/students`

| Method | Path | Auth | Role | Description |
|---|---|---|---|---|
| GET | `/students/me` | JWT | `student` | Authenticated student's profile |
| GET | `/students/me/od-records` | JWT | `student` | Own OD records. Query: `?limit&offset` |
| GET | `/students/me/certificates` | JWT | `student` | Own submitted certificates. Query: `?limit&offset` |
| GET | `/students` | JWT | `student_representative` | Search students. Required: `?q=`. Optional: `?limit&offset` |

### OD Records — `/od-records`

| Method | Path | Auth | Role | Description |
|---|---|---|---|---|
| POST | `/od-records` | JWT | `student_representative` | Create OD. Body: `{ student_id, event_details }`. Returns `registration_number` like `OD-0001` |
| GET | `/od-records` | JWT | `student_representative` / `coordinating_faculty` | List records. Filters: `?department&status&limit&offset` |
| GET | `/od-records/:odId` | JWT | `student` / `student_representative` / `coordinating_faculty` | Single record + certificate metadata. Students restricted to own records. |

### Certificates — `/certificates`

| Method | Path | Auth | Role | Description |
|---|---|---|---|---|
| POST | `/certificates` | JWT | `student` | Upload certificate. Multipart: `registration_number` field + `file` (PDF/JPG/JPEG/PNG ≤ 5 MB). Enforces ownership and one-per-OD uniqueness. |
| GET | `/certificates` | JWT | `coordinating_faculty` | List all certificates. Filters: `?student_id&submission_month&department&year&section&limit&offset` |
| GET | `/certificates/:certId/download` | JWT | `student` (own) / `coordinating_faculty` (any) | Stream file download with correct `Content-Type` |

### Reports — `/reports`

| Method | Path | Auth | Role | Description |
|---|---|---|---|---|
| GET | `/reports/monthly-summary` | JWT | `coordinating_faculty` | JSON summary. Query: `?month=YYYY-MM&department?&year?&section?`. Returns total OD count, submitted cert count, missing cert count, and full record lists. |
| POST | `/reports/excel` | JWT | `coordinating_faculty` | Download `.xlsx`. Body: `{ month, department?, year?, section? }` |
| POST | `/reports/certificates-zip` | JWT | `coordinating_faculty` | Download `.zip` of all submitted certificates for the month. Body: `{ month, department?, year?, section? }`. Missing files skipped silently. |

### Error response format

```json
{
  "error": {
    "code": "NOT_FOUND",
    "message": "OD record not found"
  }
}
```

Common HTTP status codes: `400` (validation), `401` (not authenticated), `403` (forbidden / wrong role), `404` (not found), `409` (conflict — duplicate certificate), `413` (file too large), `500` (server error).

---

## Middleware

### `middleware/auth.js`

```js
verifyToken            // Validate JWT, load user, attach req.user
requireRole(...roles)  // Check req.user.role against allowedRoles array
```

### `middleware/authorization.js`

```js
requireStudentOwnership   // Compare req.user.student_id with resource student_id
requireStudentRepRole     // Shorthand: requireRole('student_representative')
requireFacultyRole        // Shorthand: requireRole('coordinating_faculty')
```

### `middleware/errorHandler.js`

```js
class AppError            // throw new AppError(message, code, statusCode)
errorHandler              // Express (err, req, res, next) — formats all errors consistently
```

---

## Models

All models use the shared `pg.Pool` from `config/database.js` and parameterized queries.

| Model | Notable methods |
|---|---|
| `User` | `getById`, `getByUsername`, `getForLogin` (dual-path student/staff), `getUserWithStudent`, `create`, `update`, `getCoordinatingFaculty`, `getRepresentatives` |
| `Student` | `getById`, `getByRegisterNumber`, `search` (ILIKE on register_number / name / department), `getAll`, `create` |
| `ODRecord` | `getById`, `getByRegistrationNumber`, `getByStudentId`, `getAll` (filtered), `create` (transaction + sequence), `update` |
| `Certificate` | `getById`, `getByOdId`, `getByStudentId`, `getAll` (filtered JOIN), `create`, `existsForOd`, `getByMonth`, `getMissingForMonth`, `delete` |

`ODRecord.create()` runs inside a PostgreSQL transaction:
1. Calls `nextval('registration_number_seq')` to get the next sequence value.
2. Formats it as `OD-0001` (zero-padded to 4 digits).
3. Inserts the record.
4. Rolls back on any error — the sequence value is consumed but never reused (gap-tolerant by design).

---

## File Storage

Uploaded certificates are saved to disk by the route handler in `routes/certificates.js` after passing Multer's memory buffer and file validation.

```
STORAGE_PATH/
└── YYYY/
    └── MM/
        └── {register_number}_{registration_number}.{ext}
```

Example: `../storage/certificates/2026/09/22AD001_OD-0001.pdf`

The `file_path` column in the `certificates` table stores the absolute path. This value is **never exposed** directly in API responses — file access goes through `GET /certificates/:certId/download`, which streams the file after ownership or role checks.

---

## Report Generation

### Excel (`routes/reports.js`)

Uses **ExcelJS** to build an in-memory workbook:
- Sheet 1: All OD records matching the month/department/year/section filters with student details and certificate status.
- Sheet 2: Students who received OD but have not submitted a certificate.

Returns as `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet` with a timestamped filename.

### ZIP (`routes/reports.js`)

Uses **adm-zip** to bundle all certificate files returned by `Certificate.getByMonth()`:
- Each file is added to the ZIP using its stored filename.
- Missing files on disk are silently skipped (logged server-side).

Returns as `application/zip`.

---

## Running Tests

```powershell
cd backend
npm test
```

Jest runs with `--detectOpenHandles`. The test suite includes:

| File | What it tests |
|---|---|
| `tests/auth-middleware.test.js` | `verifyToken` and `requireRole` middleware behaviour |
| `tests/role-validation.test.js` | Role hierarchy enforcement across endpoints |
| `tests/uat-workflow.uat.mjs` | End-to-end: login → OD creation → cert upload → report |

Validated results: **2 suites, 3 tests, 0 failures**.

---

## Scripts

| Script | Command | Description |
|---|---|---|
| `start` | `node server.js` | Production server |
| `dev` | `nodemon server.js` | Development server with auto-reload |
| `migrate` | `node src/migrations/runMigrations.js` | Run all SQL migrations |
| `bootstrap-admin` | `node src/utils/bootstrap-admin.js` | Create initial admin account interactively |
| `test` | `jest --detectOpenHandles` | Run test suite |
| `lint` | `eslint src/` | Lint source files |

---

## Dependencies

### Production

| Package | Version | Purpose |
|---|---|---|
| `express` | ^4.18.2 | Web framework |
| `pg` | ^8.11.3 | PostgreSQL client and connection pool |
| `jsonwebtoken` | ^9.0.2 | JWT signing and verification |
| `bcrypt` | ^5.1.1 | Password hashing |
| `multer` | ^1.4.5-lts.1 | Multipart/form-data file uploads |
| `express-validator` | ^7.0.0 | Input validation and sanitisation |
| `exceljs` | ^4.3.0 | Excel workbook generation |
| `adm-zip` | ^0.5.10 | In-memory ZIP archive creation |
| `cors` | ^2.8.5 | CORS headers |
| `dotenv` | ^16.3.1 | `.env` file loading |

### Development

| Package | Version | Purpose |
|---|---|---|
| `nodemon` | ^3.0.2 | Auto-restart on file changes |
| `jest` | ^29.7.0 | Test runner |
| `supertest` | ^6.3.3 | HTTP assertion for Express |
| `eslint` | ^8.53.0 | Static analysis |

---

## Troubleshooting

### Cannot connect to PostgreSQL

- Confirm PostgreSQL service is running.
- Check `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD` in `.env`.
- Confirm the `certificate_management` database exists: `psql -l`.

### Port 5000 already in use

```powershell
# Find the process using port 5000
netstat -ano | findstr :5000

# Kill by PID
taskkill /PID <pid> /F
```

Or change `PORT` in `.env`.

### Migration fails

- Ensure the target database exists before running `npm run migrate`.
- Check that the database user has `CREATE TABLE` and `CREATE SEQUENCE` privileges.
- If a partial migration ran, inspect the database and drop incomplete tables before re-running.

### CORS errors in browser

- Set `CORS_ORIGIN` in `.env` to match the exact frontend origin including the port, e.g. `http://localhost:5173`.
- Do not use a trailing slash.

### JWT errors (`invalid signature` / `jwt expired`)

- Ensure `JWT_SECRET` in `.env` matches the secret used when tokens were issued.
- Clear browser local storage and log in again to obtain a fresh token.
- Adjust `JWT_EXPIRY` if tokens are expiring too quickly during development.

### File upload returns 400 or 413

- Confirm the file type is PDF, JPG, JPEG, or PNG.
- Confirm the file is under 5 MB (`MAX_FILE_SIZE=5242880`).
- Check `STORAGE_PATH` exists and is writable by the Node.js process.
