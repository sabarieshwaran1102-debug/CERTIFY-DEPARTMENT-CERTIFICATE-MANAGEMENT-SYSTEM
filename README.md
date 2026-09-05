# Certificate Management System v1.3

A department web system for On-Duty (OD) registration, participation tracking, certificate collection, missing-certificate identification, and monthly reporting.

## Project Overview

This system replaces manual processes involving Excel and Google Drive by providing:

- **Student Interface**: View OD records, submit certificates, track submissions
- **Student Representative Interface**: Register OD, enter event details, view generated registration numbers
- **Coordinating Faculty Interface**: View OD records, identify missing certificates, generate monthly reports, download certificates

## Technology Stack

- **Backend**: Node.js + Express.js
- **Database**: PostgreSQL
- **Frontend**: React.js + Vite
- **Export**: exceljs (Excel), adm-zip (ZIP download)

## Project Structure

```
certificate-management-system/
├── backend/                  # Backend API
│   ├── src/
│   │   ├── config/          # Database, storage config
│   │   ├── middleware/      # Auth, authorization, validation
│   │   ├── models/          # Database models
│   │   ├── routes/          # API routes
│   │   ├── controllers/     # Route handlers
│   │   ├── services/        # Business logic
│   │   ├── utils/           # Utilities, validators
│   │   ├── migrations/      # Database migrations
│   │   └── app.js           # Express app
│   ├── server.js            # Server entry point
│   ├── .env.example         # Environment template
│   └── package.json
│
├── frontend/                # Frontend SPA
│   ├── src/
│   │   ├── components/      # Reusable components
│   │   ├── pages/           # Page components
│   │   ├── services/        # API service layer
│   │   ├── context/         # React context
│   │   ├── styles/          # Tailwind CSS
│   │   ├── App.jsx          # Main app component
│   │   └── main.jsx         # Entry point
│   ├── public/              # Static assets
│   ├── .env.example         # Environment template
│   ├── vite.config.js       # Vite config
│   └── package.json
│
├── docs/                    # Documentation
├── storage/                 # File storage
│   └── certificates/        # Certificate files (organized by month)
└── README.md
```

## Getting Started

### Prerequisites

- Node.js (LTS)
- PostgreSQL 12+
- npm or yarn

### Backend Setup

```bash
cd backend
npm install
cp .env.example .env
# Configure .env with database credentials
npm run migrate  # Run database migrations
npm start
```

Backend runs on `http://localhost:5000`

### Frontend Setup

```bash
cd frontend
npm install
cp .env.example .env
# Configure .env with backend API URL
npm run dev
```

Frontend runs on `http://localhost:5173`

## Database

PostgreSQL database with tables for:
- `users` - Authentication and role information
- `students` - Student data
- `od_records` - On-Duty records
- `certificates` - Certificate submissions

Registration numbers are generated using PostgreSQL sequences for atomic, concurrency-safe generation.

## API Documentation

See [docs/API.md](docs/API.md) for detailed endpoint specifications.

## Database Schema

See [docs/DATABASE.md](docs/DATABASE.md) for schema documentation.

## Architecture

See [docs/DESIGN.md](docs/DESIGN.md) for complete architecture and design decisions.

## Development Phases

1. Project setup
2. Database & authentication framework
3. Student backend APIs
4. Student Rep backend APIs
5. Faculty backend APIs
6. Frontend auth & core UI
7. Frontend student interface
8. Frontend student rep interface
9. Frontend faculty interface
10. Testing & validation

## Security

- Server-side authorization on all endpoints
- Role-based access control (Student, Student Rep, Coordinating Faculty)
- Ownership validation for student records
- Input validation (file type, size, format)
- Secure file storage (API access only, no direct HTTP access)
- Parameterized SQL queries (SQL injection prevention)
- HTTPS enforced in production

## Important Notes

### Confirmed Requirements

- Three roles: Student, Student Representative, Coordinating Faculty
- Atomic registration number generation (OD-0001, OD-0002, ...)
- Student owns certificate submission (verified server-side)
- File types: PDF, JPG, JPEG, PNG (max 5MB)
- Monthly reporting with Excel export
- Bulk certificate download as ZIP
- No event announcement system
- No certificate verification/approval/rejection
- No automatic OD blocking due to pending certificate

### Pending Department Decisions

- Authentication method (password, DOB, OTP, SSO, OAuth)
- OD blocking policy (Hard Stop, Soft Warning, Independent)
- OD cancellation authority
- Late submission deadline and handling
- Department scope (single vs multi-department)
- OD record editing authority

## License

Internal use only. Department-specific system.

## Support

For issues or questions, contact the development team.
