# Certificate Management System v1.3

A full-stack department web application for On-Duty (OD) registration, student certificate collection, missing-certificate identification, and monthly reporting.

The system replaces fragmented spreadsheet and file-sharing workflows with a role-aware application backed by PostgreSQL. It combines a React/Vite frontend with an Express REST API and supports four distinct user roles.

---

## Table of Contents

- [Project Overview](#project-overview)
- [Features](#features)
- [Technology Stack](#technology-stack)
- [Architecture](#architecture)
- [Project Structure](#project-structure)
- [Role Hierarchy](#role-hierarchy)
- [Getting Started](#getting-started)
  - [Prerequisites](#prerequisites)
  - [Backend Setup](#backend-setup)
  - [Frontend Setup](#frontend-setup)
- [Test Credentials](#test-credentials)
- [API Reference](#api-reference)
- [Database Schema](#database-schema)
- [Security](#security)
- [Development Status](#development-status)
- [Pending Decisions](#pending-decisions)

---

## Project Overview

The Certificate Management System manages the complete lifecycle of student On-Duty participation records within a department:

1. A **Student Representative** registers an OD record for a student attending an event. The system generates a unique registration number (e.g., `OD-0001`) atomically via a PostgreSQL sequence.
2. The **Student** later uploads a digital certificate (PDF, JPG, JPEG, or PNG) proving participation, linked to their OD registration number.
3. The **Coordinating Faculty** reviews all records, identifies students who have not submitted certificates, and exports monthly summaries as Excel spreadsheets or ZIP archives.
4. The **Administrator** provisions coordinating faculty accounts and supports the role hierarchy.

---

## Features

| Feature | Description |
|---|---|
| OD Registration | Student Representatives create OD records with auto-generated, globally unique registration numbers |
| Certificate Submission | Students upload certificates (PDF/JPG/JPEG/PNG, max 5 MB) linked to their OD record |
| Ownership Enforcement | Server-side check ensures students can only access and submit for their own records |
| Missing Certificate Detection | Faculty can identify students who received OD but have not submitted certificates |
| Excel Export | Monthly filtered export of OD records and certificate status as `.xlsx` |
| ZIP Download | Bulk download of all submitted certificates for a given month as `.zip` |
| Role-Based Access Control | Every API endpoint enforces role checks server-side |
| Atomic Registration Numbers | PostgreSQL sequence guarantees concurrency-safe, gap-tolerant unique numbers |
| Secure File Storage | Certificate files stored outside the web root, accessible only via authenticated API |
| JWT Authentication | Stateless authentication; students authenticate with register number + date of birth |

---

## Technology Stack

### Backend

| Package | Version | Purpose |
|---|---|---|
| Node.js | LTS | Runtime |
| Express.js | ^4.18.2 | Web framework |
| pg | ^8.11.3 | PostgreSQL connection pool |
| jsonwebtoken | ^9.0.2 | JWT authentication (HS256) |
| bcrypt | ^5.1.1 | Password hashing (cost 12) |
| multer | ^1.4.5-lts.1 | Multipart file uploads (memory storage) |
| express-validator | ^7.0.0 | Request validation |
| exceljs | ^4.3.0 | Excel report generation |
| adm-zip | ^0.5.10 | ZIP archive creation |
| cors | ^2.8.5 | Cross-origin resource sharing |
| dotenv | ^16.3.1 | Environment variable loading |
| nodemon | ^3.0.2 | Dev auto-restart |
| jest + supertest | ^29 + ^6 | Backend testing |

### Frontend

| Package | Version | Purpose |
|---|---|---|
| React | ^18.2.0 | UI framework |
| Vite | ^5.0.8 | Build tool and dev server |
| React Router DOM | ^6.20.1 | Client-side routing |
| Axios | ^1.6.2 | HTTP client with interceptors |
| React Hook Form | ^7.48.0 | Form state management |
| Tailwind CSS | ^3.3.6 | Utility-first styling |
| Vitest + Testing Library | ^2 + ^16 | Frontend testing |
| ESLint + Prettier | ^8 + ^3 | Linting and formatting |

### Database

- **PostgreSQL 12+** (validated against PostgreSQL 18)
- Database name: `certificate_management`
- Connection pooled via `pg.Pool`

---

## Architecture

```
┌─────────────────────────────────────────────┐
│           React / Vite Frontend             │
│   (Role-specific dashboards, ProtectedRoute) │
└──────────────────────┬──────────────────────┘
                       │  Axios JSON + multipart
                       ▼
┌─────────────────────────────────────────────┐
│            Express REST API                  │
│  ┌──────────┐  ┌──────────┐  ┌───────────┐ │
│  │   Auth   │  │  Routes  │  │  Models   │ │
│  │ JWT/bcrypt│  │ 6 groups │  │ 4 classes │ │
│  └──────────┘  └──────────┘  └───────────┘ │
└──────────────────────┬──────────────────────┘
                       │  pg.Pool
                       ▼
┌─────────────────────────────────────────────┐
│           PostgreSQL Database                │
│   students · users · od_records · certs      │
│   registration_number_seq (sequence)         │
└─────────────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────┐
│           Certificate File Storage           │
│   ../storage/certificates/YYYY/MM/           │
└─────────────────────────────────────────────┘
```

---

## Project Structure

```
certificate-management-system/
├── backend/                        # Express REST API
│   ├── server.js                   # Entry point — starts HTTP server
│   ├── .env.example                # Environment variable template
│   ├── package.json
│   ├── src/
│   │   ├── app.js                  # Express app, CORS, routes, error handler
│   │   ├── config/
│   │   │   ├── database.js         # pg.Pool configuration
│   │   │   └── storage.js          # STORAGE_PATH resolution
│   │   ├── middleware/
│   │   │   ├── auth.js             # verifyToken, requireRole
│   │   │   ├── authorization.js    # requireStudentOwnership, role helpers
│   │   │   └── errorHandler.js     # AppError class + global handler
│   │   ├── models/
│   │   │   ├── User.js             # User DB access
│   │   │   ├── Student.js          # Student DB access
│   │   │   ├── ODRecord.js         # OD record DB access + sequence logic
│   │   │   └── Certificate.js      # Certificate DB access + report queries
│   │   ├── routes/
│   │   │   ├── auth.js             # POST /login, POST /logout, GET /me
│   │   │   ├── users.js            # Faculty and rep account management
│   │   │   ├── students.js         # Student profile, OD list, cert list
│   │   │   ├── od-records.js       # OD creation and listing
│   │   │   ├── certificates.js     # Upload and download
│   │   │   └── reports.js          # Excel, ZIP, monthly summary
│   │   ├── migrations/
│   │   │   ├── 001_initial_schema.sql
│   │   │   ├── 002_authentication_and_role_hierarchy.sql
│   │   │   ├── 003_admin_role_and_student_dob.sql
│   │   │   └── runMigrations.js
│   │   └── utils/
│   │       ├── asyncHandler.js
│   │       ├── bootstrap-admin.js  # CLI: create initial admin account
│   │       └── seedTestData.js     # Test data seeding
│   └── tests/
│       ├── auth-middleware.test.js
│       ├── role-validation.test.js
│       └── uat-workflow.uat.mjs
│
├── frontend/                       # React / Vite SPA
│   ├── index.html
│   ├── vite.config.js
│   ├── tailwind.config.js
│   ├── .env.example
│   ├── package.json
│   └── src/
│       ├── main.jsx                # React DOM entry
│       ├── App.jsx                 # Route definitions
│       ├── context/
│       │   └── AuthContext.jsx     # Global auth state
│       ├── pages/
│       │   ├── LoginPage.jsx
│       │   ├── StudentDashboard.jsx
│       │   ├── StudentRepDashboard.jsx
│       │   ├── FacultyDashboard.jsx
│       │   ├── AdminDashboard.jsx
│       │   ├── NotFoundPage.jsx
│       │   └── UnauthorizedPage.jsx
│       ├── components/
│       │   ├── Auth/
│       │   ├── Student/
│       │   ├── StudentRep/
│       │   ├── Faculty/
│       │   ├── Common/
│       │   └── Layout/
│       │       └── ProtectedRoute.jsx
│       ├── services/
│       │   ├── api.js              # Axios instance, JWT injection, 401 handler
│       │   ├── authService.js
│       │   ├── studentService.js
│       │   ├── odService.js
│       │   ├── certService.js
│       │   ├── reportService.js
│       │   └── userService.js
│       └── styles/
│           └── index.css
│
├── docs/                           # Documentation
│   ├── API.md                      # Full endpoint reference
│   ├── DATABASE.md                 # Schema documentation
│   ├── DESIGN.md                   # Architecture and design decisions
│   └── PROJECT_SUBMISSION.md       # Project submission document
│
├── storage/
│   └── certificates/               # Uploaded certificate files (YYYY/MM/)
│
└── README.md                       # This file
```

---

## Role Hierarchy

```
admin
  └── coordinating_faculty  (provisioned by admin)
         └── student_representative  (provisioned by faculty, assigned via assigned_faculty_id)
student  (linked to students table via student_id)
```

| Role | Login Credentials | Capabilities |
|---|---|---|
| `admin` | Username + password | Provision and manage coordinating faculty accounts |
| `coordinating_faculty` | Username + password | View OD records and certificates, generate reports, manage reps |
| `student_representative` | Username + password | Search students, register OD records |
| `student` | Register number + date of birth | View own OD records, upload and download certificates |

---

## Getting Started

### Prerequisites

- **Node.js** LTS (v16 or later)
- **PostgreSQL** 12 or later (validated on PostgreSQL 18)
- **npm** (comes with Node.js)

### Backend Setup

```powershell
# 1. Install dependencies
cd backend
npm install

# 2. Configure environment
copy .env.example .env
# Open .env and set: DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD, JWT_SECRET

# 3. Create the database in PostgreSQL
# Run in psql: CREATE DATABASE certificate_management;

# 4. Run all three migrations
npm run migrate

# 5. (Optional) Create the first admin account
npm run bootstrap-admin

# 6. Start the server
npm start          # production
npm run dev        # development with auto-reload
```

Backend URL: `http://localhost:5000`
Health check: `GET http://localhost:5000/api/health`

#### Backend Environment Variables

| Variable | Default | Description |
|---|---|---|
| `DB_HOST` | `localhost` | PostgreSQL host |
| `DB_PORT` | `5432` | PostgreSQL port |
| `DB_NAME` | `certificate_management` | Database name |
| `DB_USER` | `postgres` | Database user |
| `DB_PASSWORD` | — | Database password |
| `PORT` | `5000` | Express server port |
| `NODE_ENV` | `development` | Environment mode |
| `JWT_SECRET` | — | HS256 signing secret (min 32 chars in production) |
| `JWT_EXPIRY` | `30m` | Token lifetime |
| `STORAGE_PATH` | `../storage/certificates` | Certificate file storage root |
| `MAX_FILE_SIZE` | `5242880` | Max upload size in bytes (5 MB) |
| `CORS_ORIGIN` | `http://localhost:5173` | Allowed frontend origin(s), comma-separated |

### Frontend Setup

```powershell
# 1. Install dependencies
cd frontend
npm install

# 2. Configure environment
copy .env.example .env
# Set: VITE_API_BASE_URL=http://localhost:5000/api

# 3. Start the development server
npm run dev -- --host localhost

# 4. Build for production
npm run build
```

Frontend URL: `http://localhost:5173`

#### Frontend Environment Variables

| Variable | Description |
|---|---|
| `VITE_API_BASE_URL` | Backend API base URL (must be prefixed `VITE_`) |
| `VITE_ENV` | Environment label |

---

## Test Credentials

> **For local development and demonstration only. Change or remove before any production deployment.**

| Role | Username | Password |
|---|---|---|
| Admin | `admin` | `Admin1234` |
| Coordinating Faculty | `faculty1` | `Faculty123` |
| Student Representative | `rep1` | `Rep12345` |
| Student | `22AD001` | `2004-06-15` |

Students log in with their institutional register number as the username and their date of birth (`YYYY-MM-DD`) as the password.

---

## API Reference

Base URL: `http://localhost:5000/api`

| Route Group | Purpose |
|---|---|
| `GET /health` | Health check — returns `{ status: "OK" }` |
| `POST /auth/login` | Authenticate and receive a JWT |
| `POST /auth/logout` | Stateless logout |
| `GET /auth/me` | Current user identity |
| `GET/POST/PATCH /users/coordinating-faculty` | Admin: manage faculty accounts |
| `GET/POST/PATCH /users/student-representatives` | Faculty: manage rep accounts |
| `GET /students/me` | Student: own profile |
| `GET /students/me/od-records` | Student: own OD records |
| `GET /students/me/certificates` | Student: own submitted certificates |
| `GET /students` | Student Rep: search students |
| `POST /od-records` | Student Rep: create OD record |
| `GET /od-records` | Student Rep / Faculty: list OD records |
| `GET /od-records/:odId` | Any authenticated: single OD record |
| `POST /certificates` | Student: upload certificate |
| `GET /certificates` | Faculty: list all certificates |
| `GET /certificates/:certId/download` | Student (own) / Faculty (any): download file |
| `GET /reports/monthly-summary` | Faculty: JSON monthly summary |
| `POST /reports/excel` | Faculty: download `.xlsx` report |
| `POST /reports/certificates-zip` | Faculty: download `.zip` of certificates |

Full request/response documentation: [docs/API.md](docs/API.md)

---

## Database Schema

Four tables and one sequence:

| Object | Type | Description |
|---|---|---|
| `students` | Table | Institutional register number, name, department, year, section, DOB |
| `users` | Table | Username, role, bcrypt password hash, active state, student/faculty links |
| `od_records` | Table | Student link, generated registration number, event details, status |
| `certificates` | Table | One-to-one OD link, file metadata, secure path, submission month |
| `registration_number_seq` | Sequence | Atomic counter for `OD-0001` style numbers |

Full schema documentation: [docs/DATABASE.md](docs/DATABASE.md)

---

## Security

- JWT authentication required on all protected endpoints
- Role checks enforced server-side — not relying on frontend alone
- Student ownership verified before certificate submission and download
- Passwords stored as bcrypt hashes (cost factor 12)
- All SQL uses parameterized queries via `pg` — no string concatenation
- Certificate files stored outside the public directory, served only through authenticated API
- File type and size validated server-side (PDF/JPG/JPEG/PNG, max 5 MB)
- Production mode enforces: strong `JWT_SECRET`, explicit `CORS_ORIGIN`, `HTTPS` only

---

## Development Status

| Phase | Description | Status |
|---|---|---|
| 1 | Project setup and database | ✅ Complete |
| 2 | Authentication framework | ✅ Complete |
| 3 | Student APIs and certificate submission | ✅ Complete |
| 4 | Student Representative APIs | ✅ Complete |
| 5 | Coordinating Faculty APIs and reporting | ✅ Complete |
| 6 | Frontend auth and core UI | ✅ Complete |
| 7 | Frontend student interface | ✅ Complete |
| 8 | Frontend student rep interface | ✅ Complete |
| 9 | Frontend faculty interface | ✅ Complete |
| 10 | Testing and end-to-end validation | ✅ Complete |

**Validation summary:** All three database migrations ran successfully. Health endpoint returned `OK`. Login, OD creation, certificate upload, Excel export, ZIP export, and all backend/frontend tests passed.

---

## Pending Decisions

The following items are pending department confirmation and are not yet implemented:

- **Authentication method** — password, DOB (current default), OTP, SSO, or OAuth
- **OD blocking policy** — hard stop, soft warning, or independent submission
- **OD cancellation authority** — who can cancel, what reasons are valid
- **Late submission deadline** — how it is calculated and enforced
- **Department scope** — single-department or multi-department
- **Edit authority** — whether OD records can be corrected after creation

---

## License

Internal use only. Department-specific system.
