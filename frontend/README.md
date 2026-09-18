# Certificate Management System — Frontend

React 18 single-page application built with Vite. Provides role-specific dashboards for students, student representatives, coordinating faculty, and administrators. Communicates with the Express backend via Axios.

---

## Table of Contents

- [Quick Start](#quick-start)
- [Project Structure](#project-structure)
- [Environment Variables](#environment-variables)
- [Authentication and Routing](#authentication-and-routing)
- [Role-to-Screen Mapping](#role-to-screen-mapping)
- [Pages](#pages)
- [Components](#components)
- [Service Layer](#service-layer)
- [AuthContext](#authcontext)
- [ProtectedRoute](#protectedroute)
- [Form Handling](#form-handling)
- [Styling](#styling)
- [Scripts](#scripts)
- [Testing](#testing)
- [Dependencies](#dependencies)
- [Troubleshooting](#troubleshooting)

---

## Quick Start

```powershell
cd frontend
npm install

# Copy and configure environment
copy .env.example .env
# Set VITE_API_BASE_URL=http://localhost:5000/api

# Start development server
npm run dev -- --host localhost
```

App runs at: `http://localhost:5173`

The backend must be running at `http://localhost:5000` before the frontend can authenticate or fetch data.

---

## Project Structure

```
frontend/
├── index.html                     # Vite HTML entry template
├── vite.config.js                 # Vite build configuration
├── tailwind.config.js             # Tailwind CSS configuration
├── postcss.config.js              # PostCSS plugins (autoprefixer)
├── vitest.config.js               # Vitest test configuration
├── .env.example                   # Environment variable template
├── package.json
└── src/
    ├── main.jsx                   # React DOM root — wraps app in BrowserRouter
    ├── App.jsx                    # Route definitions + ProtectedRoute wrappers
    │
    ├── context/
    │   └── AuthContext.jsx        # Global auth state: user, token, login(), logout()
    │
    ├── pages/
    │   ├── LoginPage.jsx          # Shared login form for all roles
    │   ├── StudentDashboard.jsx   # Student home — profile + OD records + certs
    │   ├── StudentRepDashboard.jsx# Rep home — search students + register OD
    │   ├── FacultyDashboard.jsx   # Faculty home — records + reports + downloads
    │   ├── AdminDashboard.jsx     # Admin home — manage faculty accounts
    │   ├── NotFoundPage.jsx       # 404 catch-all
    │   └── UnauthorizedPage.jsx   # 403 — authenticated but wrong role
    │
    ├── components/
    │   ├── Auth/                  # Login form and auth-related UI pieces
    │   ├── Student/               # MyODRecords, CertificateUpload, SubmittedCertificates
    │   ├── StudentRep/            # RegisterOD, ViewODRecords
    │   ├── Faculty/               # ODRecordsList, MissingCertificates,
    │   │                          # MonthlyReport, CertificateDownload
    │   ├── Common/                # Header, Navigation, ErrorMessage,
    │   │                          # SuccessMessage, LoadingSpinner
    │   └── Layout/
    │       └── ProtectedRoute.jsx # Auth + role guard for React Router
    │
    ├── services/
    │   ├── api.js                 # Axios instance — base URL, JWT header, 401 handler
    │   ├── authService.js         # login(), logout(), getCurrentUser()
    │   ├── studentService.js      # getMyInfo(), getMyODRecords(), getMyCertificates()
    │   ├── odService.js           # registerOD(), getODRecords(), getODRecord()
    │   ├── certService.js         # submitCertificate(), downloadCertificate()
    │   ├── reportService.js       # getMonthlySummary(), generateExcelReport(),
    │   │                          # downloadCertificatesZip()
    │   └── userService.js         # getFaculty(), createFaculty(), updateFaculty(),
    │                              # getReps(), createRep(), updateRep()
    │
    ├── styles/
    │   └── index.css              # Tailwind base, components, utilities + custom classes
    │
    └── test/
        ├── auth-flow.test.jsx     # Login and auth context tests
        └── setup.js               # Vitest setup — extends jest-dom matchers
```

---

## Environment Variables

All variables **must** be prefixed with `VITE_` to be exposed by Vite to the browser bundle.

| Variable | Example | Description |
|---|---|---|
| `VITE_API_BASE_URL` | `http://localhost:5000/api` | Backend API base URL injected into the Axios instance |
| `VITE_ENV` | `development` | Environment label (optional) |

Copy `.env.example` to `.env` and set `VITE_API_BASE_URL` before starting the dev server or running a build.

---

## Authentication and Routing

### Login flow

1. User submits credentials on `LoginPage`.
2. `authService.login()` posts to `POST /api/auth/login`.
3. On success the JWT token and user object are stored in `AuthContext` (and persisted to `localStorage`).
4. The user is redirected to the dashboard matching their role.
5. All subsequent API calls attach the token via the Axios request interceptor in `api.js`.

### 401 auto-logout

The Axios response interceptor in `api.js` listens for `401 Unauthorized` responses. When one is received the interceptor calls `AuthContext.logout()`, clears `localStorage`, and redirects to `/login`. This handles expired or invalidated tokens transparently.

### Route structure (`App.jsx`)

```
/                  → redirect to /login
/login             → LoginPage (public)
/student           → StudentDashboard      (requires role: student)
/student-rep       → StudentRepDashboard   (requires role: student_representative)
/faculty           → FacultyDashboard      (requires role: coordinating_faculty)
/admin             → AdminDashboard        (requires role: admin)
/unauthorized      → UnauthorizedPage (public)
*                  → NotFoundPage (public)
```

All dashboard routes are wrapped in `ProtectedRoute`.

---

## Role-to-Screen Mapping

| Role | Dashboard | Key actions available |
|---|---|---|
| `student` | `StudentDashboard` | View profile, view OD records, upload certificate, download submitted certificate |
| `student_representative` | `StudentRepDashboard` | Search students by name/register number/department, register new OD record, view OD list |
| `coordinating_faculty` | `FacultyDashboard` | View all OD records, identify missing certificates, generate monthly summary, download Excel report, download ZIP of certificates |
| `admin` | `AdminDashboard` | List coordinating faculty, create new faculty account, activate/deactivate faculty |

---

## Pages

### `LoginPage.jsx`

Single login form used by all roles. Collects `username` and `password`. Students enter their register number and date of birth (`YYYY-MM-DD`). Calls `authService.login()` and redirects to the correct dashboard based on the `role` returned in the response.

### `StudentDashboard.jsx`

Loads the authenticated student's profile via `studentService.getMyInfo()`. Renders:
- Personal details (name, register number, department, year, section).
- OD record list with certificate submission status per record.
- Certificate upload form for OD records without a submitted certificate.
- List of already-submitted certificates with download links.

### `StudentRepDashboard.jsx`

Provides:
- Student search input — queries `GET /api/students?q=` and shows results in a table.
- OD registration form — collects `student_id` and `event_details`, submits to `POST /api/od-records`, and displays the generated registration number.
- OD records table showing all records created by the representative.

### `FacultyDashboard.jsx`

Provides:
- Month picker (`YYYY-MM`) as the primary filter.
- Monthly summary panel showing total OD count, submitted certificate count, and missing certificate count.
- Filterable OD records table (department, year, section).
- Missing certificates list.
- Download buttons for Excel export and ZIP archive of certificates.

### `AdminDashboard.jsx`

Provides:
- List of all coordinating faculty accounts with active/inactive status.
- Form to create a new coordinating faculty account (username + password).
- Toggle to activate or deactivate existing faculty accounts.

---

## Components

### `components/Layout/ProtectedRoute.jsx`

React Router wrapper that guards a route by:
1. Checking `isAuthenticated` from `AuthContext` — redirects to `/login` if false.
2. Checking the user's `role` against the `allowedRoles` prop — redirects to `/unauthorized` if the role is not permitted.

Usage in `App.jsx`:
```jsx
<Route
  path="/faculty"
  element={
    <ProtectedRoute allowedRoles={['coordinating_faculty']}>
      <FacultyDashboard />
    </ProtectedRoute>
  }
/>
```

### `components/Common/`

| Component | Purpose |
|---|---|
| `Header` | Top navigation bar with app title and logout button |
| `Navigation` | Role-aware sidebar or tab navigation |
| `LoadingSpinner` | Centered spinner shown during API calls |
| `ErrorMessage` | Styled error alert with message text |
| `SuccessMessage` | Styled success alert with message text |

### `components/Student/`

| Component | Purpose |
|---|---|
| `MyODRecords` | Paginated table of the student's OD records and certificate status |
| `CertificateUpload` | File picker and upload form — calls `certService.submitCertificate()` |
| `SubmittedCertificates` | List of submitted certs with download button per row |

### `components/StudentRep/`

| Component | Purpose |
|---|---|
| `RegisterOD` | Form to select a student and register a new OD record |
| `ViewODRecords` | Filterable table of all OD records with certificate status |

### `components/Faculty/`

| Component | Purpose |
|---|---|
| `ODRecordsList` | Full OD records table with department/year/section filter |
| `MissingCertificates` | List of students who have OD but no certificate for the selected month |
| `MonthlyReport` | Summary statistics panel per selected month |
| `CertificateDownload` | Excel and ZIP download trigger buttons |

---

## Service Layer

All services import the shared Axios instance from `api.js`.

### `services/api.js`

```js
// Axios instance configured with base URL from VITE_API_BASE_URL
// Request interceptor: attaches Authorization: Bearer <token> from localStorage
// Response interceptor: on 401 → calls logout() and redirects to /login
```

### `services/authService.js`

```js
login(username, password)   // POST /auth/login → { token, user }
logout()                    // POST /auth/logout (then clears local state)
getCurrentUser()            // GET  /auth/me    → { user }
```

### `services/studentService.js`

```js
getMyInfo()                 // GET /students/me
getMyODRecords(params)      // GET /students/me/od-records?limit&offset
getMyCertificates(params)   // GET /students/me/certificates?limit&offset
searchStudents(q, params)   // GET /students?q=&limit&offset
```

### `services/odService.js`

```js
registerOD(studentId, eventDetails)   // POST /od-records
getODRecords(filters)                 // GET  /od-records?department&status&limit&offset
getODRecord(odId)                     // GET  /od-records/:odId
```

### `services/certService.js`

```js
submitCertificate(registrationNumber, file)   // POST /certificates (multipart/form-data)
downloadCertificate(certId)                   // GET  /certificates/:certId/download → Blob
listCertificates(filters)                     // GET  /certificates?filters
```

### `services/reportService.js`

```js
getMonthlySummary(month, filters)      // GET  /reports/monthly-summary?month=YYYY-MM
generateExcelReport(month, filters)    // POST /reports/excel → Blob (.xlsx)
downloadCertificatesZip(month, filters)// POST /reports/certificates-zip → Blob (.zip)
```

### `services/userService.js`

```js
// Faculty management (admin only)
getFacultyList()                        // GET   /users/coordinating-faculty
createFaculty(username, password)       // POST  /users/coordinating-faculty
updateFaculty(userId, data)             // PATCH /users/coordinating-faculty/:userId

// Rep management (faculty only)
getRepList()                            // GET   /users/student-representatives
createRep(username, password)           // POST  /users/student-representatives
updateRep(userId, data)                 // PATCH /users/student-representatives/:userId
```

---

## AuthContext

`context/AuthContext.jsx` provides global authentication state via React Context.

### Values exposed

| Value | Type | Description |
|---|---|---|
| `user` | `object \| null` | Authenticated user object from the server |
| `token` | `string \| null` | JWT token stored in memory and `localStorage` |
| `isAuthenticated` | `boolean` | True when a valid token and user exist |
| `isLoading` | `boolean` | True while restoring auth state on page load |
| `login(username, password)` | `async function` | Calls `authService.login()`, stores token, sets user |
| `logout()` | `function` | Clears token and user, redirects to `/login` |

### Usage

```jsx
import { useAuth } from '../context/AuthContext';

function MyComponent() {
  const { user, isAuthenticated, logout } = useAuth();

  if (!isAuthenticated) return <p>Not logged in</p>;
  return <p>Hello, {user.username} ({user.role})</p>;
}
```

### State persistence

The token is saved to `localStorage` under the key `cms_token`. On app load `AuthContext` reads this value and calls `GET /auth/me` to restore the full user object. If the token is expired or invalid the restore silently fails and the user stays logged out.

---

## ProtectedRoute

```jsx
// components/Layout/ProtectedRoute.jsx
<ProtectedRoute allowedRoles={['student']}>
  <StudentDashboard />
</ProtectedRoute>
```

Behaviour:
- If `isLoading` is true (auth state being restored) — renders a loading spinner.
- If `!isAuthenticated` — redirects to `/login`, preserving the intended path in `location.state`.
- If `isAuthenticated` but the role is not in `allowedRoles` — redirects to `/unauthorized`.
- Otherwise — renders `children`.

---

## Form Handling

Forms use **React Hook Form** for state management and validation.

```jsx
import { useForm } from 'react-hook-form';

const { register, handleSubmit, formState: { errors } } = useForm();

const onSubmit = async (data) => {
  await odService.registerOD(data.studentId, data.eventDetails);
};

return (
  <form onSubmit={handleSubmit(onSubmit)}>
    <input
      {...register('studentId', { required: 'Student ID is required' })}
    />
    {errors.studentId && <span>{errors.studentId.message}</span>}
    <button type="submit">Register OD</button>
  </form>
);
```

File uploads use a controlled `<input type="file">` rather than React Hook Form's register, because the file is sent as `FormData` via Axios.

---

## Styling

The application uses **Tailwind CSS** with the default configuration extended in `tailwind.config.js`. PostCSS with `autoprefixer` is configured in `postcss.config.js`.

`src/styles/index.css` imports the Tailwind directives:

```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

Custom component classes and design tokens can be added in the `@layer components` block within the same file.

The purge paths in `tailwind.config.js` include `./index.html` and `./src/**/*.{js,ts,jsx,tsx}`, so only used classes are included in the production bundle.

---

## Scripts

| Script | Command | Description |
|---|---|---|
| `dev` | `vite` | Start development server at `http://localhost:5173` |
| `build` | `vite build` | Production build into `dist/` |
| `preview` | `vite preview` | Serve the production build locally |
| `test` | `vitest run` | Run test suite once (no watch mode) |
| `lint` | `eslint src/` | Lint all source files |
| `format` | `prettier --write src/` | Auto-format source files |

### Production build

```powershell
npm run build
```

Output is in `dist/`. Serve it with any static file host or web server. Configure the server to serve `index.html` for all routes (client-side routing requires this).

---

## Testing

Tests use **Vitest** with **Testing Library** and **jsdom**.

```powershell
npm test
```

`src/test/setup.js` extends Vitest's global `expect` with `@testing-library/jest-dom` matchers (`toBeInTheDocument`, `toHaveTextContent`, etc.).

| File | What it covers |
|---|---|
| `src/test/auth-flow.test.jsx` | Login form rendering, submission, AuthContext state updates, 401 auto-logout |

Validated results: **1 suite, 3 tests, 0 failures**.

### Writing new tests

```jsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import LoginPage from '../pages/LoginPage';

test('renders login form', () => {
  render(<MemoryRouter><LoginPage /></MemoryRouter>);
  expect(screen.getByLabelText(/username/i)).toBeInTheDocument();
});
```

Wrap components that use `useNavigate` or `Link` in `<MemoryRouter>`. Mock `AuthContext` where needed using `vi.mock`.

---

## Dependencies

### Production

| Package | Version | Purpose |
|---|---|---|
| `react` | ^18.2.0 | UI framework |
| `react-dom` | ^18.2.0 | DOM renderer |
| `react-router-dom` | ^6.20.1 | Declarative client-side routing |
| `axios` | ^1.6.2 | HTTP client with interceptors |
| `react-hook-form` | ^7.48.0 | Form state and validation |

### Development

| Package | Version | Purpose |
|---|---|---|
| `vite` | ^5.0.8 | Build tool and HMR dev server |
| `@vitejs/plugin-react` | ^4.2.1 | JSX transform and Fast Refresh |
| `tailwindcss` | ^3.3.6 | Utility-first CSS framework |
| `postcss` | ^8.4.32 | CSS processing |
| `autoprefixer` | ^10.4.16 | CSS vendor prefixes |
| `vitest` | ^2.1.8 | Vite-native test runner |
| `@testing-library/react` | ^16.0.1 | React component testing utilities |
| `@testing-library/user-event` | ^14.5.2 | Simulated user interactions |
| `@testing-library/jest-dom` | ^6.6.3 | Custom DOM matchers |
| `jsdom` | ^24.1.0 | Browser environment for tests |
| `eslint` | ^8.53.0 | Static analysis |
| `eslint-plugin-react` | ^7.33.2 | React-specific lint rules |
| `prettier` | ^3.1.0 | Code formatter |

---

## Troubleshooting

### White screen / no content on load

- Open browser DevTools → Console for JavaScript errors.
- Check that `VITE_API_BASE_URL` in `.env` points to the running backend.
- Ensure the backend is running and `GET http://localhost:5000/api/health` returns `OK`.

### Login returns 401 or "Invalid credentials"

- Students: username must be the full register number (e.g., `22AD001`); password must be the date of birth in `YYYY-MM-DD` format (e.g., `2004-06-15`).
- Staff: confirm the account is active (`is_active = true`) in the database.
- Check the backend is not in production mode with a different `JWT_SECRET`.

### API calls fail with CORS error

- `CORS_ORIGIN` in the backend `.env` must exactly match the frontend origin including the protocol and port: `http://localhost:5173`.
- No trailing slash.

### `VITE_API_BASE_URL` is undefined at runtime

- All Vite environment variables must be prefixed with `VITE_`.
- Re-start the dev server after changing `.env` — Vite does not hot-reload `.env` changes.

### Production build serves 404 on page refresh

- Configure your web server to rewrite all non-file requests to `index.html`.
- Nginx example: `try_files $uri $uri/ /index.html;`
- Apache example: add `FallbackResource /index.html` to `.htaccess`.

### File download produces a corrupted file

- Ensure the Axios call sets `responseType: 'blob'`.
- Check that the backend `Content-Type` header matches the actual file format.
- Confirm the file exists on disk in `STORAGE_PATH`.
