# Risks Faced and Mitigations
## Certificate Management System — Development, Testing, and UAT Lifecycle

**Project:** CERTIFY — Department Certificate Management System
**Stack:** Node.js 18 · Express 4 · PostgreSQL 16 · React 18 · Vite 5 · Tailwind CSS 3
**Document version:** 1.0 · Reflects state at commit `a18ddbc` and subsequent UAT preparation

---

## Table of Contents

1. [Risk Register](#1-risk-register)
2. [Risk Summary Table](#2-risk-summary-table)
3. [Current Security Posture](#3-current-security-posture)
4. [UAT Readiness Status](#4-uat-readiness-status)
5. [Remaining Known Risks](#5-remaining-known-risks)
6. [Recommended Production Precautions](#6-recommended-production-precautions)

---

## 1. Risk Register

---

### RISK-01 — Corrupted Authorization Header in Frontend `api.js`

| Field | Detail |
|---|---|
| **Category** | Frontend — Authentication |
| **Severity** | Critical |
| **Status** | ✅ Resolved |

**Symptoms / Error**
Every authenticated API call from the browser returned `401 Unauthorized`. The UI displayed the generic message `"Failed"` or `"Failed to create"` on every protected action (creating departments, academic years, classes, etc.). The backend log showed: `[warn] Unauthorized: Missing or invalid authorization token`.

**Root Cause**
`frontend/src/services/api.js` line 25 was corrupted during a PowerShell file-write operation. PowerShell interprets `${token}` as a variable expansion inside double-quoted strings, so the template literal:

```js
config.headers.Authorization = `Bearer ${token}`;
```

was written to disk as:

```js
config.headers.Authorization = Bearer ;
```

This is a JavaScript syntax error that Vite silently parsed (treating `Bearer` as a bare identifier resolving to `undefined`). Every request went out with `Authorization: Bearer ` (empty token), causing 401 on every protected endpoint. The response interceptor then fired `tokenStore.remove()` and redirected to `/login`, preventing the component `catch` block from showing a meaningful error — the user saw only `"Failed"`.

**Impact**
Complete loss of all authenticated functionality. No departments, academic years, classes, students, ODs, or certificates could be created via the browser UI. Affected all roles.

**Investigation / How It Was Identified**
1. Backend health check returned 200 (backend healthy).
2. Direct API test with `Invoke-WebRequest` returned 201 for `POST /api/departments` — backend worked perfectly.
3. Backend log showed `Unauthorized: Missing or invalid authorization token` for requests originating from the browser.
4. Reading `frontend/src/services/api.js` source revealed the broken line.
5. Verified the Vite dev server was serving the broken file by fetching `http://localhost:5173/src/services/api.js` and confirming no `${token}` in the output.

**Fix / Mitigation Applied**
Restored the correct template literal on line 25 of `frontend/src/services/api.js`:
```js
// BROKEN
config.headers.Authorization = Bearer ;

// FIXED
config.headers.Authorization = `Bearer ${token}`;
```

**Verification Performed**
1. Fetched `http://localhost:5173/src/services/api.js` from the Vite dev server — confirmed `Bearer ${token}` present.
2. Rebuilt production bundle — confirmed `Bearer ${t}` (minified) in `dist/assets/index-*.js`.
3. Frontend tests: 3/3 pass.
4. End-to-end login → `POST /api/departments` → `HTTP 201` confirmed.

**Prevention / Best Practice**
- Always use dedicated file-write tools (not PowerShell string interpolation) when writing JavaScript files containing template literals.
- Add an integration smoke test that verifies the `Authorization` header is present in outgoing requests.
- Code review any automated file manipulation that touches JS source files.

---

### RISK-02 — Stale Frontend Production Bundle with Hardcoded Old API URL

| Field | Detail |
|---|---|
| **Category** | Frontend — Configuration |
| **Severity** | Critical |
| **Status** | ✅ Resolved |

**Symptoms / Error**
The browser UI showed `"Failed to create"` on all operations even though the backend was running correctly on port 5001 and all direct API tests passed.

**Root Cause**
Vite bakes `VITE_API_BASE_URL` into the production bundle at build time. The existing `dist/` bundle was built on 25-Sep-2026 when the API was still on port 5000. When the environment was reconfigured for UAT (port 5001), the `frontend/.env` was updated but the old `dist/` bundle — containing the hardcoded string `"http://localhost:5000/api"` — continued to be served. The Vite dev server was also started before the `.env` was confirmed present, so the first start may have used the fallback default.

**Impact**
Every browser request targeted port 5000 (which was occupied by an unrelated Python application or was not running the Node backend), causing network errors or wrong responses. All UI actions failed silently.

**Investigation / How It Was Identified**
1. Direct API tests from PowerShell using port 5001 returned 201 — backend worked.
2. Inspected the dist bundle: `grep -o 'localhost:500[0-9]'` found `localhost:5000`.
3. Checked bundle build timestamp: 25-Sep-2026 — predated the port change.
4. Fetched `http://localhost:5173/src/services/api.js` from Vite dev server — confirmed it was serving `localhost:5001` (correct) when `.env` was present and Vite was started afterward.

**Fix / Mitigation Applied**
1. Confirmed `frontend/.env` contains `VITE_API_BASE_URL=http://localhost:5001/api`.
2. Ran `npm run build` in the frontend directory to produce a fresh bundle.
3. Verified the new bundle contains `localhost:5001`.

**Prevention / Best Practice**
- Always run `npm run build` after changing `VITE_*` environment variables.
- Never serve a stale production build when the API URL has changed.
- Document the build step explicitly in the deployment runbook.
- Consider adding a build-time assertion or runtime check that logs the active API URL on startup.

---

### RISK-03 — Port Conflict with Unrelated Application

| Field | Detail |
|---|---|
| **Category** | Infrastructure — Port Management |
| **Severity** | High |
| **Status** | ✅ Managed |

**Symptoms / Error**
Starting the backend on the default port 5000 failed silently or conflicted with an unrelated Python application that was already occupying port 5000 on the same machine.

**Root Cause**
The default `backend/.env` had `PORT=5000`. An unrelated Python application was already bound to port 5000.

**Impact**
Backend startup appeared to succeed (no error) but the port was in use, so the Node process either crashed or the responses from the browser came from the Python application — returning non-JSON responses and breaking all API calls.

**Fix / Mitigation Applied**
- Created a separate `backend/.env.uat` with `PORT=5001`.
- UAT backend is always started with `node -r dotenv/config server.js dotenv_config_path=.env.uat`.
- `frontend/.env` updated to `VITE_API_BASE_URL=http://localhost:5001/api`.
- The dev `.env` retains `PORT=5000` for the development database; they never run simultaneously.

**Prevention / Best Practice**
- Always check port availability before starting services: `netstat -ano | findstr :5000`.
- Use different ports per environment (dev=5000, UAT=5001, prod=443 via reverse proxy).
- Document the port assignments in the project README.

---

### RISK-04 — UAT Database Isolation and Accidental Test Data Contamination

| Field | Detail |
|---|---|
| **Category** | Database — Environment Isolation |
| **Severity** | High |
| **Status** | ✅ Resolved |

**Symptoms / Error**
After running the backend test suite, the `certify_uat` database was found to contain 131 users, 15 departments, 85 students, and 246 audit events — all generated by automated tests. The requirement was zero business data in UAT before the first legitimate data entry.

**Root Cause**
The `backend/.env` was temporarily changed to `DB_NAME=certify_uat` to start the UAT backend, but the full Jest test suite was then run without restoring the `.env` first. Jest loaded `dotenv` from the (now UAT-pointing) `.env`, so all test writes — including those from `phase2-integration`, `phase3a-od`, `phase4-certificates`, `phase7-security`, and `phase8-academic-history` — landed in `certify_uat`.

**Impact**
UAT database contained synthetic test data (usernames like `csa_XXX@t.com`, departments like `CertDept_XXX`, OD numbers like `OD-2026-000001`) that could not be distinguished from real institutional data.

**Fix / Mitigation Applied**
1. Restored `backend/.env` to `DB_NAME=certificate_management` immediately.
2. Created the permanent `backend/.env.uat` file for UAT use.
3. Deleted all test-generated rows from `certify_uat` in FK-safe order:
   `student_academic_history` → `od_participants` → `od_certificates` → `ods` → `users` (non-superadmin) → `students` → `classes` → `academic_years` → `departments`.
4. Verified: `certify_uat` returned to `users=1, departments=0, students=0`.

**Prevention / Best Practice**
- **Never** point `backend/.env` at `certify_uat`; always use `backend/.env.uat` for UAT.
- Run tests with `DB_NAME=certificate_management` always: `node --experimental-vm-modules ./node_modules/jest/bin/jest.js`.
- Add a guard in `runMigrations.js` and test setup that throws if `DB_NAME` is `certify_uat`.
- Document: "Tests must never run against certify_uat."

---

### RISK-05 — Unknown Superadmin Password During UAT Login

| Field | Detail |
|---|---|
| **Category** | Authentication — Credential Management |
| **Severity** | High |
| **Status** | ✅ Resolved |

**Symptoms / Error**
Login as `superadmin` in the browser returned `"Invalid username or password"`. The backend log showed repeated `[warn] Unauthorized: Invalid username or password | POST /api/auth/login`.

**Root Cause**
`bootstrap-admin.js` reads `ADMIN_USERNAME` and `ADMIN_PASSWORD` from environment variables at execution time. The password used during the initial bootstrap was not documented anywhere (correctly — credentials must not be committed). When UAT was started weeks later, the original password was unknown.

**Impact**
Complete inability to log in as superadmin. No UAT operations could be performed.

**Fix / Mitigation Applied**
1. Generated a new bcrypt hash (cost=12) for a known UAT password using a temporary `.cjs` script.
2. Updated the `superadmin` record in `certify_uat`:
   ```sql
   UPDATE users SET password_hash = '<new_hash>', updated_at = NOW()
   WHERE username = 'superadmin';
   ```
3. The new password was communicated to the operator outside this document.

**Prevention / Best Practice**
- During initial bootstrap, record the password in a secure password manager (not in code or documentation).
- For UAT environments, provision a fresh superadmin with a documented-in-the-manager password.
- Add a `bootstrap-uat.js` variant that validates the environment is UAT before executing.

---

### RISK-06 — Time-Dependent Phase 4 Certificate Test Failures

| Field | Detail |
|---|---|
| **Category** | Testing — Date Sensitivity |
| **Severity** | High (broke 12/227 tests) |
| **Status** | ✅ Resolved |

**Symptoms / Error**
After October 2026, `phase4-certificates.test.js` reported 12 failures:
```
Certificate submission › Participant student submits certificate
Expected: 201, Received: 400
Error: late_reason is required when submitting after the deadline
```

**Root Cause**
The main test OD used `event_date: '2026-09-10'`. `computeDeadline('2026-09-10')` returns `'2026-09-30'`. After 30-Sep-2026, `isLateSubmission()` returned `true` for all submissions against this OD, requiring `late_reason`. The test expected `status: 'submitted'` but received `400`. All 12 failures cascaded from this single incorrect baseline date.

**Impact**
12 of 40 Phase 4 tests failed. CI would report a broken build. Certificate submission, verification, and replacement tests were all non-functional.

**Fix / Mitigation Applied**
Added a dynamic date helper to `phase4-certificates.test.js`:
```js
const isoDate = (monthOffset = 0, dayOfMonth = 10) => { ... };
const OD_DATE_NORMAL  = isoDate(+1, 10);  // always next month
const OD_DATE_LATE    = isoDate(-6, 15);  // always 6 months ago
const OD_DATE_OVERDUE = isoDate(-36, 1);  // always 3 years ago
// ... etc.
```
All 8 hardcoded scenario dates were replaced with these dynamic constants. The 4 `computeDeadline()` unit test assertions were left unchanged (they test the pure function, not DB state).

**Verification Performed**
Phase 4: **40/40 pass**. Full suite: **227/227 pass**.

**Prevention / Best Practice**
- Never use specific calendar dates in integration tests for date-sensitive business logic.
- Use relative date helpers (`now + N months`, `now - N months`) for all test OD/event dates.
- Add a lint rule or comment convention flagging hardcoded year strings in test files.

---

### RISK-07 — JWT Secret Fallback Allowing Weak Tokens

| Field | Detail |
|---|---|
| **Category** | Security — Authentication |
| **Severity** | Critical |
| **Status** | ✅ Resolved |

**Symptoms / Error**
`backend/src/middleware/auth.js` contained:
```js
const jwtSecret = process.env.JWT_SECRET || 'development-secret-key';
```
If `JWT_SECRET` was absent from the environment, all tokens were signed with the public fallback string.

**Root Cause**
Defensive fallback pattern intended for development convenience — but it silently allowed production deployments with a predictable secret.

**Fix / Mitigation Applied**
Removed the fallback. The module now throws at startup if `JWT_SECRET` is unset:
```js
const jwtSecret = process.env.JWT_SECRET;
if (!jwtSecret) { throw new Error('JWT_SECRET environment variable is not set...'); }
```
`app.js` additionally validates length ≥ 32 chars in production mode.
`jwt.verify()` now pins the algorithm: `{ algorithms: ['HS256'] }` — prevents algorithm confusion attacks.

---

### RISK-08 — Database Password Fallback

| Field | Detail |
|---|---|
| **Category** | Security — Database Credentials |
| **Severity** | Critical |
| **Status** | ✅ Resolved |

**Symptoms / Error**
`backend/src/config/database.js` contained:
```js
password: process.env.DB_PASSWORD || 'password',
```

**Fix / Mitigation Applied**
- Removed the `'password'` fallback.
- Added production guard: throws at startup if `NODE_ENV=production` and `DB_PASSWORD` is unset.
- Added pool configuration: `max: 20`, `idleTimeoutMillis: 30000`, `connectionTimeoutMillis: 2000`.
- Added conditional SSL: `ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: true } : false`.

---

### RISK-09 — Missing Security Headers

| Field | Detail |
|---|---|
| **Category** | Security — HTTP Headers |
| **Severity** | High |
| **Status** | ✅ Resolved |

**Symptoms / Error**
No `Content-Security-Policy`, `X-Frame-Options`, `X-Content-Type-Options`, `Strict-Transport-Security`, or `Referrer-Policy` headers were present on any response.

**Fix / Mitigation Applied**
Added `helmet@7.2.0`: `app.use(helmet())` in `app.js`. Helmet sets all standard security headers automatically.

---

### RISK-10 — No Login Rate Limiting (Brute Force Risk)

| Field | Detail |
|---|---|
| **Category** | Security — Rate Limiting |
| **Severity** | High |
| **Status** | ✅ Resolved |

**Fix / Mitigation Applied**
Added `express-rate-limit@7.5.0`:
- Login endpoint: **10 requests per 15 minutes per IP**.
- All `/api` routes: **300 requests per 15 minutes per IP**.
- Both limiters skip if `DISABLE_RATE_LIMIT=true` in non-production (for test runs).

---

### RISK-11 — Certificate File Path Traversal

| Field | Detail |
|---|---|
| **Category** | Security — File System |
| **Severity** | Critical |
| **Status** | ✅ Resolved |

**Symptoms / Error**
`res.download(cert.file_path, cert.file_name)` used a database-stored path directly with no validation against the configured storage root. A compromised database or injection could cause arbitrary file reads.

**Fix / Mitigation Applied**
Added `assertWithinStorageRoot(filePath)` helper in both `certificates.js` and `od-certificates.js`:
```js
function assertWithinStorageRoot(filePath) {
  const storageRoot = path.resolve(getStoragePath());
  const resolved    = path.resolve(filePath);
  if (!resolved.startsWith(storageRoot + path.sep)) {
    throw new AppError('Certificate path is outside the permitted storage directory', 'FORBIDDEN', 403);
  }
  return resolved;
}
```
Every `res.download()` call now uses the validated `safeFilePath`.

---

### RISK-12 — Token Stored in `localStorage` (XSS Accessible)

| Field | Detail |
|---|---|
| **Category** | Security — Token Storage |
| **Severity** | Medium |
| **Status** | ✅ Partially Mitigated |

**Fix / Mitigation Applied**
Moved JWT token from `localStorage` to `sessionStorage`. `sessionStorage` is cleared when the browser tab is closed, reducing the token lifetime window. A `tokenStore` helper (`get/set/remove`) abstracts the storage so it can be replaced with `httpOnly` cookies in a future iteration without touching component code.

**Remaining Risk**
`sessionStorage` is still readable by JavaScript and susceptible to XSS. A full mitigation requires `httpOnly` cookie + refresh token flow, which is a planned future improvement.

---

### RISK-13 — Request Body Size Unlimited

| Field | Detail |
|---|---|
| **Category** | Security — DoS Prevention |
| **Severity** | Medium |
| **Status** | ✅ Resolved |

**Fix / Mitigation Applied**
```js
app.use(express.json({ limit: '100kb' }));
app.use(express.urlencoded({ extended: true, limit: '100kb' }));
```

---

### RISK-14 — `errorHandler.js` NODE_ENV Temporal Dead Zone

| Field | Detail |
|---|---|
| **Category** | Backend — Code Quality |
| **Severity** | Medium |
| **Status** | ✅ Resolved |

**Symptoms / Error**
`const NODE_ENV = process.env.NODE_ENV || 'development'` was declared at the bottom of `errorHandler.js`, after the function that used it. While it worked at runtime (due to call timing), it was in the temporal dead zone during module parse and would cause a `ReferenceError` in strict static analysis. Additionally, if `NODE_ENV` was unset, stack traces would leak in production.

**Fix / Mitigation Applied**
Moved `NODE_ENV` declaration to the top of the module. Separated log levels: 4xx AppErrors log at `console.warn`; 5xx errors log at `console.error`.

---

### RISK-15 — Health Endpoint Did Not Check Database Connectivity

| Field | Detail |
|---|---|
| **Category** | Observability |
| **Severity** | Low |
| **Status** | ✅ Resolved |

**Symptoms / Error**
`GET /api/health` returned `{"status":"OK"}` even when the database was stopped, making it useless for load-balancer or orchestration health checks.

**Fix / Mitigation Applied**
```js
app.get('/api/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'OK', timestamp: ..., db: 'connected' });
  } catch (err) {
    res.status(503).json({ status: 'DEGRADED', db: 'disconnected', error: err.message });
  }
});
```

---

### RISK-16 — PostgreSQL Service Stopped During Testing

| Field | Detail |
|---|---|
| **Category** | Infrastructure — Service Availability |
| **Severity** | High |
| **Status** | ✅ Managed |

**Symptoms / Error**
Backend tests returned `ECONNREFUSED` on port 5432. The Windows service `postgresql-x64-16` reported `Stopped`, and `sc start` returned `Access is denied (5)` without administrator privileges.

**Root Cause**
PostgreSQL 16 was installed at `D:\DB\` as a Windows service requiring Administrator to start via the service manager. The data directory is `D:\DB\data`.

**Fix / Mitigation Applied**
PostgreSQL 16 can be started directly via `pg_ctl.exe` without elevation:
```powershell
& "D:\DB\bin\pg_ctl.exe" start -D "D:\DB\data"
```
This starts the PostgreSQL process directly, bypassing the Windows service wrapper. The service status shows `Stopped` but `pg_ctl status` correctly reports `running`.

**Prevention / Best Practice**
- Add `pg_ctl start` to the project startup script.
- Document that the Windows service status is unreliable — use `pg_ctl status` to check.

---

### RISK-17 — Migration 004 Inserts Synthetic Data on Non-Empty Database

| Field | Detail |
|---|---|
| **Category** | Database — Migration Safety |
| **Severity** | Medium |
| **Status** | ✅ Documented |

**Symptoms / Error**
Migration `004_organizational_architecture.sql` contains INSERT statements that derive departments, a "Legacy" academic year, and classes from existing student rows. On a fresh empty database this produces zero rows. On a database with pre-existing legacy students, it creates derived org structure automatically.

**Impact**
On `certify_uat` (which was empty), migrations 001–010 produced a completely clean schema with zero data rows — correct behaviour. On `certificate_management` (which had legacy data), the migration correctly backfilled the org structure. No risk to UAT.

**Prevention / Best Practice**
- Always run migrations on an empty database for a clean UAT.
- Do not run migrations on `certify_uat` after it has been populated with real data.

---

### RISK-18 — Figma Source Project Conflict

| Field | Detail |
|---|---|
| **Category** | Repository — Source Management |
| **Severity** | Low |
| **Status** | ✅ Resolved |

**Symptoms / Error**
The `figma/` directory (a separate Figma-generated project) was untracked in the repository, appearing in every `git status` output as `?? figma/`. Risk of accidental staging.

**Fix / Mitigation Applied**
Added `figma/` to root `.gitignore`. Confirmed it no longer appears in `git status`.

---

### RISK-19 — Expired Import Sessions Accumulating in Database

| Field | Detail |
|---|---|
| **Category** | Database — Hygiene |
| **Severity** | Low |
| **Status** | ✅ Resolved |

**Symptoms / Error**
`import_sessions` records expire after 30 minutes but are only deleted when a confirm operation runs. Over time, expired-but-never-confirmed sessions accumulate indefinitely.

**Fix / Mitigation Applied**
Added a lazy cleanup statement in the import preview route:
```js
await pool.query('DELETE FROM import_sessions WHERE expires_at < NOW()').catch(() => {});
```
This runs on every preview request without blocking the main operation.

---

## 2. Risk Summary Table

| ID | Risk | Category | Severity | Status |
|---|---|---|---|---|
| RISK-01 | Corrupted Authorization header (`Bearer ${token}`) | Frontend Auth | 🔴 Critical | ✅ Resolved |
| RISK-02 | Stale production bundle with old API URL | Frontend Config | 🔴 Critical | ✅ Resolved |
| RISK-03 | Port conflict with unrelated application | Infrastructure | 🟠 High | ✅ Managed |
| RISK-04 | Test data contamination of UAT database | DB Isolation | 🟠 High | ✅ Resolved |
| RISK-05 | Unknown superadmin password at UAT start | Auth / Credentials | 🟠 High | ✅ Resolved |
| RISK-06 | Time-dependent Phase 4 test failures | Testing | 🟠 High | ✅ Resolved |
| RISK-07 | JWT secret fallback | Security | 🔴 Critical | ✅ Resolved |
| RISK-08 | DB password fallback `'password'` | Security | 🔴 Critical | ✅ Resolved |
| RISK-09 | Missing HTTP security headers | Security | 🟠 High | ✅ Resolved |
| RISK-10 | No login rate limiting | Security | 🟠 High | ✅ Resolved |
| RISK-11 | Certificate path traversal | Security | 🔴 Critical | ✅ Resolved |
| RISK-12 | Token in `sessionStorage` (XSS risk) | Security | 🟡 Medium | ⚠️ Partial |
| RISK-13 | Unlimited request body size | Security | 🟡 Medium | ✅ Resolved |
| RISK-14 | `NODE_ENV` temporal dead zone in errorHandler | Code Quality | 🟡 Medium | ✅ Resolved |
| RISK-15 | Health endpoint no DB check | Observability | 🟢 Low | ✅ Resolved |
| RISK-16 | PostgreSQL service stopped / access denied | Infrastructure | 🟠 High | ✅ Managed |
| RISK-17 | Migration 004 inserts on non-empty DB | DB Migration | 🟡 Medium | ✅ Documented |
| RISK-18 | Figma directory untracked | Repository | 🟢 Low | ✅ Resolved |
| RISK-19 | Import sessions accumulating | DB Hygiene | 🟢 Low | ✅ Resolved |

---

## 3. Current Security Posture

| Control | Implementation | Status |
|---|---|---|
| Authentication | JWT HS256, bcrypt cost=12, is_active checked per request | ✅ |
| JWT secret validation | Throws on startup if unset or < 32 chars in production | ✅ |
| Algorithm pinning | `jwt.verify(..., { algorithms: ['HS256'] })` | ✅ |
| Password hashing | bcrypt, rounds=12, all staff and student accounts | ✅ |
| Security headers | `helmet()` on all responses | ✅ |
| Rate limiting | 10/15min login, 300/15min API-wide | ✅ |
| Body size limits | `express.json({ limit: '100kb' })` | ✅ |
| CORS | Explicit allowlist in production; localhost in dev | ✅ |
| HTTPS enforcement | X-Forwarded-Proto check when `NODE_ENV=production` | ✅ |
| File type validation | Multer allowlist: PDF, JPG, PNG only | ✅ |
| File size limit | 5 MB, env-configurable | ✅ |
| Path traversal protection | `assertWithinStorageRoot()` on every download | ✅ |
| Role-based access control | Enforced on every route, double-checked in components | ✅ |
| SQL injection | All queries use parameterised `$1` placeholders | ✅ |
| Audit logging | All mutations recorded in `audit_events` | ✅ |
| Token storage | `sessionStorage` (clears on tab close) | ⚠️ Partial |
| Error message leakage | Stack traces suppressed in production | ✅ |
| DB SSL | Configurable via `DB_SSL=true` | ✅ (needs enabling) |
| Token revocation | No server-side revocation (30-min expiry only) | ⚠️ Partial |

---

## 4. UAT Readiness Status

| Criterion | Status |
|---|---|
| Backend test suite | ✅ 227/227 passing |
| Frontend tests | ✅ 3/3 passing |
| Production build | ✅ 123 modules, no errors |
| certify_uat schema | ✅ Migrations 001–010 applied |
| certify_uat data | ✅ Clean — superadmin only |
| Backend on port 5001 | ✅ Running, DB connected |
| Frontend on port 5173 | ✅ Running, API URL = `localhost:5001` |
| Authorization header | ✅ Fixed — `Bearer ${token}` correctly sent |
| Login (superadmin) | ✅ Verified end-to-end |
| Create Department API | ✅ HTTP 201 verified |
| Audit log | ✅ Captures all mutations |
| Email notifications | ⚠️ Disabled (`EMAIL_ENABLED=false`) — configure SMTP for prod |
| SSL/TLS | ⚠️ Not configured for UAT (HTTP only) |

---

## 5. Remaining Known Risks

| Risk | Description | Priority |
|---|---|---|
| `sessionStorage` XSS | Token readable by JS; needs `httpOnly` cookie + refresh token for full mitigation | Medium |
| No token revocation | Logout does not invalidate server-side; stolen token valid for 30 min | Medium |
| `adm-zip` CVEs | Direct prod dep; fix requires major version bump breaking API | High |
| `nodemailer` CVEs | Latest v6 (6.10.1) still has CVEs; v10 is a breaking major | High |
| `tar` (transitive) | Via `bcrypt` → `node-pre-gyp` → `tar`; build-time only, not runtime | Low |
| No HTTPS in UAT | UAT runs on HTTP; production must use TLS reverse proxy | High |
| JWT placeholder secret | `your-secret-key-change-in-production` in `.env` files; must be replaced before prod | Critical |
| `DB_SSL=false` | SSL not enforced between app and PostgreSQL in UAT; enable for prod | High |
| No background job for overdue certs | `markOverdue` is called lazily on read; no scheduled background sweep | Low |
| No password complexity enforcement | Staff account passwords require ≥8 chars but no complexity rules | Low |

---

## 6. Recommended Production Precautions

1. **Replace all placeholder secrets** — generate a cryptographically random 64-character `JWT_SECRET`; never reuse across environments.
2. **Enable DB SSL** — set `DB_SSL=true` and configure PostgreSQL to require TLS.
3. **Deploy behind a TLS reverse proxy** — Nginx or Caddy for HTTPS termination.
4. **Set `NODE_ENV=production`** — enables startup validation guards, suppresses stack traces.
5. **Set `CORS_ORIGIN`** to the exact production domain — never `*`.
6. **Set `STORAGE_PATH`** to an absolute path outside the web root — required in production by `app.js` guard.
7. **Configure SMTP** — set `EMAIL_ENABLED=true` and all `EMAIL_*` variables for certificate notification emails.
8. **Upgrade `adm-zip` and `nodemailer`** — evaluate API compatibility before the next release cycle.
9. **Implement `httpOnly` cookie auth** — replace `sessionStorage` token with `httpOnly` + `SameSite=Strict` cookie.
10. **Set up database backups** — daily `pg_dump certify_uat > backup_$(date +%Y%m%d).sql` before going live with real student data.
11. **Document the superadmin password** in a secure password manager — never in source code or documentation.
12. **Run `npm audit fix`** after each dependency upgrade cycle — do not use `--force` without reviewing breaking changes.
