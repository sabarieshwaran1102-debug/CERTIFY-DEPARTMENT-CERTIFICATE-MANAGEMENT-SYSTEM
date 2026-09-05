# Certificate Management System - Frontend

React.js SPA (Single Page Application) for the Certificate Management System v1.3.

## Quick Start

### Prerequisites
- Node.js 16+ (LTS)
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
   Edit `.env` with your backend API URL (default: http://localhost:5000/api).

3. **Start development server**
   ```bash
   npm run dev
   ```
   Frontend runs on `http://localhost:5173` (or next available port).

4. **Build for production**
   ```bash
   npm run build
   ```
   Output generated in `dist/` directory.

---

## Project Structure

```
frontend/
├── src/
│   ├── components/          # Reusable React components
│   │   ├── Auth/           # Authentication components
│   │   ├── Student/        # Student role components
│   │   ├── StudentRep/     # Student Rep role components
│   │   ├── Faculty/        # Faculty role components
│   │   ├── Common/         # Shared components
│   │   └── Layout/         # Layout components
│   │
│   ├── pages/              # Page components
│   │   ├── LoginPage.jsx
│   │   ├── StudentDashboard.jsx
│   │   ├── StudentRepDashboard.jsx
│   │   ├── FacultyDashboard.jsx
│   │   ├── NotFoundPage.jsx
│   │   └── UnauthorizedPage.jsx
│   │
│   ├── services/           # API integration
│   │   ├── api.js          # Axios instance with interceptors
│   │   ├── authService.js
│   │   ├── studentService.js
│   │   ├── odService.js
│   │   ├── certService.js
│   │   └── reportService.js
│   │
│   ├── context/            # React Context
│   │   └── AuthContext.jsx # Global authentication state
│   │
│   ├── styles/             # CSS styles
│   │   └── index.css       # Tailwind CSS
│   │
│   ├── App.jsx            # Main app component
│   ├── main.jsx           # Vite entry point
│   └── constants.js       # App constants (to be created)
│
├── public/                # Static assets
├── index.html            # HTML template
├── vite.config.js        # Vite configuration
├── tailwind.config.js    # Tailwind CSS configuration
├── postcss.config.js     # PostCSS configuration
├── .env.example
├── package.json
└── README.md
```

---

## API Integration

All API calls go through `src/services/api.js` (Axios instance):

```javascript
import apiClient from './services/api';

// Example: Fetch student data
const response = await apiClient.get('/students/me');

// Example: Upload certificate
const formData = new FormData();
formData.append('file', file);
formData.append('registration_number', 'OD-0001');
await apiClient.post('/certificates', formData);
```

**Features**:
- Automatic JWT token injection in Authorization header
- Automatic token refresh on 401
- CORS configured for backend
- Request/response interceptors

---

## Authentication Context

Global authentication state managed via `src/context/AuthContext.jsx`:

```javascript
import { useContext } from 'react';
import { AuthContext } from './context/AuthContext';

function MyComponent() {
    const { user, token, isAuthenticated, login, logout } = useContext(AuthContext);
    // Use auth state and methods
}
```

**Available context values**:
- `user` - Authenticated user object (user_id, student_id, role)
- `token` - JWT token string
- `isAuthenticated` - Boolean flag
- `loading` - Loading state
- `login(token, user)` - Set auth state
- `logout()` - Clear auth state

---

## Protected Routes

Use `ProtectedRoute` component to guard role-specific pages:

```javascript
<Route 
    path="/student/*" 
    element={
        <ProtectedRoute requiredRole="student">
            <StudentDashboard />
        </ProtectedRoute>
    } 
/>
```

**Features**:
- Redirects unauthenticated users to /login
- Redirects wrong role users to /unauthorized
- Shows loading spinner during auth check

---

## Styling

Tailwind CSS configured via:
- `tailwind.config.js` - Theme configuration
- `postcss.config.js` - PostCSS plugins
- `src/styles/index.css` - Global and utility styles

**Example usage**:
```jsx
<div className="bg-white rounded-lg shadow-md p-6">
    <h1 className="text-3xl font-bold mb-6">Title</h1>
    <button className="btn-primary">Submit</button>
</div>
```

---

## Environment Variables

See `.env.example` for available variables:

- `VITE_API_BASE_URL` - Backend API base URL (default: http://localhost:5000/api)
- `VITE_ENV` - Environment (development/production)

**Note**: Variables must start with `VITE_` to be exposed to the app.

---

## Development

### Available Scripts

```bash
# Start development server
npm run dev

# Build for production
npm run build

# Preview production build locally
npm run preview

# Lint code
npm run lint

# Format code with Prettier
npm run format
```

### Hot Module Replacement (HMR)

Vite provides fast HMR during development:
- Edit components
- Changes reload instantly in browser
- State persists when possible

### Debugging

Use browser DevTools to debug:
- React Developer Tools extension
- Redux DevTools (if used)
- Network tab to inspect API calls
- Console for errors/logs

---

## Component Organization

### Page Components
Located in `src/pages/`, represent full-page routes:
- LoginPage
- StudentDashboard
- StudentRepDashboard
- FacultyDashboard
- NotFoundPage
- UnauthorizedPage

### Feature Components
Located in `src/components/<Role>/`, specific to role functionality:
- Student: MyODRecords, CertificateUpload, SubmittedCertificates
- StudentRep: RegisterOD, ViewODRecords
- Faculty: ODRecords, MissingCertificates, MonthlyReport, CertificateDownload

### Common Components
Located in `src/components/Common/`, shared across features:
- Header
- Navigation
- ErrorMessage
- SuccessMessage
- LoadingSpinner

### Layout Components
Located in `src/components/Layout/`:
- ProtectedRoute

---

## Form Handling

React Hook Form used for forms (lightweight, performant):

```javascript
import { useForm } from 'react-hook-form';

function MyForm() {
    const { register, handleSubmit, formState: { errors } } = useForm();

    const onSubmit = (data) => {
        // Handle form data
    };

    return (
        <form onSubmit={handleSubmit(onSubmit)}>
            <input {...register('fieldName', { required: true })} />
            {errors.fieldName && <span>This field is required</span>}
            <button type="submit">Submit</button>
        </form>
    );
}
```

---

## API Service Layer

Each feature has corresponding service file:

- `authService.js` - Authentication (login, logout, getCurrentUser)
- `studentService.js` - Student data (getMyInfo, getMyODRecords, getMyCertificates)
- `odService.js` - OD registration (registerOD, getODRecords)
- `certService.js` - Certificate operations (submitCertificate, downloadCertificate)
- `reportService.js` - Report generation (generateExcelReport, downloadCertificatesZip)

**Usage**:
```javascript
import certService from '../services/certService';

const handleUpload = async (registrationNumber, file) => {
    try {
        const response = await certService.submitCertificate(registrationNumber, file);
        // Handle success
    } catch (error) {
        // Handle error
    }
};
```

---

## Error Handling

Errors are caught and displayed to user:

```javascript
import ErrorMessage from '../components/Common/ErrorMessage';
import SuccessMessage from '../components/Common/SuccessMessage';

function MyPage() {
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    const handleAction = async () => {
        try {
            // Perform action
            setSuccess('Action completed successfully');
        } catch (err) {
            setError(err.message);
        }
    };

    return (
        <>
            {error && <ErrorMessage message={error} />}
            {success && <SuccessMessage message={success} />}
            {/* Page content */}
        </>
    );
}
```

---

## Development Phases

- **Phase 0**: Project setup ✅
- **Phase 5**: Frontend auth & core UI (next)
- **Phase 6**: Student interface
- **Phase 7**: Student Rep interface
- **Phase 8**: Faculty interface
- **Phases 9-10**: Testing & documentation

See `../README.md` for full development plan.

---

## Testing

Testing framework: Vitest + React Testing Library

```bash
npm test
```

Tests located in `test/` directory (to be created).

---

## Production Build

For production deployment:

```bash
npm run build
npm run preview
```

**Output**: Static files in `dist/` directory ready for:
- Nginx/Apache static file serving
- CDN deployment
- Container image (Docker)

**Optimization features**:
- Code splitting via Vite
- CSS minification
- JavaScript minification
- Asset optimization

---

## Browser Support

Modern browsers (ES2020+ support):
- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

---

## Troubleshooting

### Port Already in Use
```bash
npm run dev -- --port 3000
```
Or configure in `vite.config.js`.

### CORS Errors
- Verify backend is running on correct port
- Check `VITE_API_BASE_URL` in .env
- Verify backend CORS_ORIGIN matches frontend URL

### Blank Page
- Check browser console for errors
- Verify backend API is accessible
- Check network tab for failed requests

### Token Expiry
- Frontend automatically refreshes token on 401
- If token refresh fails, redirected to login

---

## Notes

- All components use React 18+ hooks
- Tailwind CSS for styling (no CSS-in-JS)
- Axios for HTTP requests (with interceptors)
- React Router v6 for routing
- React Hook Form for form handling
- Context API for global state (auth)

---

## Next Steps

1. Confirm authentication method with department
2. Implement Phase 5 (Frontend auth & core UI)
3. Implement Phase 6 (Student interface)
4. Proceed through phases sequentially

---

## Support

For questions or issues, refer to:
- `../docs/DESIGN.md` - Architecture and design
- `../docs/API.md` - API specifications
- `../docs/DATABASE.md` - Database schema
