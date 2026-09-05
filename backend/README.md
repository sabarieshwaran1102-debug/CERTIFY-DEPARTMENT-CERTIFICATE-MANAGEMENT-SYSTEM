# Certificate Management System - Backend

Express.js REST API for the Certificate Management System v1.3.

## Quick Start

### Prerequisites
- Node.js 16+ (LTS)
- PostgreSQL 12+
- npm or yarn

### Setup

1. **Install dependencies**
   ```bash
   npm install
   ```

2. **Configure environment**
   ```bash
   cp .env.example .env
   ```
   Edit `.env` with your database credentials and settings.

3. **Create PostgreSQL database**
   ```bash
   createdb certificate_management
   ```

4. **Run database migrations**
   ```bash
   npm run migrate
   ```
   This creates all tables, sequences, indexes, and constraints.

5. **Start the server**
   ```bash
   npm start
   ```
   Server runs on `http://localhost:5000` (configurable via PORT in .env)

### Development

For development with auto-reload:
```bash
npm run dev
```

Requires `nodemon` (included in devDependencies).

---

## API Documentation

See `../docs/API.md` for complete API endpoint specifications.

---

## Database Documentation

See `../docs/DATABASE.md` for complete database schema documentation.

---

## Project Structure

```
backend/
├── src/
│   ├── config/           # Configuration files
│   │   ├── database.js   # PostgreSQL pool setup
│   │   └── storage.js    # File storage configuration
│   │
│   ├── middleware/       # Express middleware
│   │   ├── auth.js       # Token verification
│   │   ├── authorization.js  # Role/ownership checks
│   │   ├── errorHandler.js   # Error handling
│   │   └── validation.js # Input validation
│   │
│   ├── routes/          # API route handlers
│   │   ├── auth.js
│   │   ├── students.js
│   │   ├── od-records.js
│   │   ├── certificates.js
│   │   └── reports.js
│   │
│   ├── controllers/     # Request handlers (to be implemented)
│   ├── models/          # Database models (to be implemented)
│   ├── services/        # Business logic (to be implemented)
│   ├── utils/           # Utilities
│   │
│   ├── migrations/      # Database migrations
│   │   ├── 001_initial_schema.sql
│   │   └── runMigrations.js
│   │
│   └── app.js          # Express app setup
│
├── server.js            # Server entry point
├── package.json
├── .env.example
└── README.md
```

---

## Environment Variables

See `.env.example` for all available variables:

- `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD` - PostgreSQL connection
- `PORT` - Server port (default: 5000)
- `NODE_ENV` - Environment (development/production)
- `JWT_SECRET` - JWT signing secret (change in production!)
- `JWT_EXPIRY` - Token expiry time (default: 30m)
- `STORAGE_PATH` - Directory for certificate storage
- `MAX_FILE_SIZE` - Maximum file upload size (default: 5MB)
- `CORS_ORIGIN` - Frontend URL for CORS (default: http://localhost:5173)

---

## Authentication

**Status**: Pending department confirmation of authentication method.

Placeholder endpoint structure is implemented in `/api/auth/login`.

Once department confirms authentication method (password, DOB, OTP, SSO, etc.):
1. Update `backend/src/routes/auth.js`
2. Add authentication logic to `backend/src/controllers/authController.js`
3. Add credential fields to `users` table as needed
4. Update migration file if schema changes

---

## Security Considerations

1. **JWT Secret**: Change `JWT_SECRET` in production
2. **HTTPS**: Use HTTPS in production
3. **CORS**: Configure `CORS_ORIGIN` appropriately
4. **Database**: Use strong passwords, restrict access
5. **File Storage**: Stored outside web root, accessed only via API
6. **Input Validation**: All inputs validated server-side
7. **SQL Injection**: Parameterized queries used throughout

---

## Development Phases

- **Phase 0**: Project setup ✅
- **Phase 1**: Database & authentication framework (next)
- **Phase 2**: Student backend APIs
- **Phase 3**: Student Rep backend APIs
- **Phase 4**: Faculty backend APIs
- **Phases 5-10**: Frontend + testing

See `../README.md` for full development plan.

---

## Testing

Testing framework: Jest + Supertest

```bash
npm test
```

Tests are located in `test/` directory (to be created).

---

## Troubleshooting

### Database Connection Error
- Verify PostgreSQL is running
- Check DB credentials in .env
- Verify database exists: `psql -l | grep certificate_management`

### Port Already in Use
- Change PORT in .env
- Or kill process: `lsof -ti:5000 | xargs kill -9`

### Migration Fails
- Check PostgreSQL logs
- Ensure database user has CREATE permissions
- Try manual migration: `psql certificate_management < src/migrations/001_initial_schema.sql`

### CORS Errors
- Verify `CORS_ORIGIN` matches frontend URL
- Check frontend is running on correct port (default: 5173)

---

## Notes

- All timestamps use UTC timezone
- Dates formatted as YYYY-MM or YYYY-MM-DD
- All IDs are BIGINT (64-bit) for scalability
- Registration numbers generated via PostgreSQL sequence (atomic, concurrency-safe)
- File paths never exposed to frontend (API access only)

---

## Dependencies

See `package.json` for complete list.

Key dependencies:
- `express` - Web framework
- `pg` - PostgreSQL driver
- `jsonwebtoken` - JWT token handling
- `multer` - File upload handling
- `exceljs` - Excel workbook generation
- `adm-zip` - ZIP compression

---

## Next Steps

1. Confirm authentication method with department
2. Complete Phase 1 (Database + Auth Framework)
3. Implement Phase 2 (Student APIs)
4. Proceed through phases sequentially

---

## Support

For questions or issues, refer to:
- `../docs/DESIGN.md` - Architecture and design decisions
- `../docs/API.md` - API endpoint specifications
- `../docs/DATABASE.md` - Database schema details
