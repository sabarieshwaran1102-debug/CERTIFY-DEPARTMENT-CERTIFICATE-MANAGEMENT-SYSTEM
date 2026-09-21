import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/Layout/ProtectedRoute';
import AppShell from './components/Layout/AppShell';

// Auth pages
import LoginPage from './pages/LoginPage';
import NotFoundPage from './pages/NotFoundPage';
import UnauthorizedPage from './pages/UnauthorizedPage';

// Role dashboards (existing, will be progressively updated)
import StudentDashboard from './pages/StudentDashboard';
import StudentRepDashboard from './pages/StudentRepDashboard';
import FacultyDashboard from './pages/FacultyDashboard';
import AdminDashboard from './pages/AdminDashboard';
import ManagementDashboard from './pages/ManagementDashboard';
import ClassRepDashboard from './pages/ClassRepDashboard';

// New OD pages
import ODRecordsPage from './pages/ods/ODRecordsPage';
import CreateODPage from './pages/ods/CreateODPage';
import ODDetailsPage from './pages/ods/ODDetailsPage';

// Certificate pages
import CertificatesPage from './pages/certificates/CertificatesPage';
import CertificateDetailPage from './pages/certificates/CertificateDetailPage';
import UploadCertificatePage from './pages/certificates/UploadCertificatePage';

// Reports & Audit pages
import ReportsPage from './pages/reports/ReportsPage';
import AuditPage from './pages/audit/AuditPage';

// Roles that can access OD pages
const OD_ROLES = ['super_admin', 'admin', 'coordinating_faculty', 'class_advisor', 'class_representative', 'student_representative', 'student'];
const MANAGEMENT_ROLES = ['super_admin', 'admin', 'coordinating_faculty', 'class_advisor'];
const OD_CREATE_ROLES = ['super_admin', 'admin', 'coordinating_faculty', 'class_advisor', 'class_representative'];
const REPORTS_ROLES = ['super_admin', 'admin', 'coordinating_faculty', 'class_advisor'];
const AUDIT_ROLES = ['super_admin', 'admin'];

function App() {
  return (
    <Router>
      <AuthProvider>
        <Routes>
          {/* Public */}
          <Route path="/login" element={<LoginPage />} />
          <Route path="/unauthorized" element={<UnauthorizedPage />} />

          {/* Shell-wrapped authenticated routes */}
          <Route element={
            <ProtectedRoute requiredRoles={OD_ROLES}>
              <AppShell />
            </ProtectedRoute>
          }>
            {/* OD routes — available to all authenticated roles */}
            <Route path="/ods" element={
              <ProtectedRoute requiredRoles={OD_ROLES}><ODRecordsPage /></ProtectedRoute>
            } />
            <Route path="/ods/create" element={
              <ProtectedRoute requiredRoles={OD_CREATE_ROLES}><CreateODPage /></ProtectedRoute>
            } />
            <Route path="/ods/:id" element={
              <ProtectedRoute requiredRoles={OD_ROLES}><ODDetailsPage /></ProtectedRoute>
            } />

            {/* Certificate routes */}
            <Route path="/certificates" element={
              <ProtectedRoute requiredRoles={OD_ROLES}><CertificatesPage /></ProtectedRoute>
            } />
            <Route path="/certificates/pending" element={
              <ProtectedRoute requiredRoles={['super_admin','admin','coordinating_faculty','class_advisor']}><CertificatesPage /></ProtectedRoute>
            } />
            <Route path="/certificates/upload" element={
              <ProtectedRoute requiredRoles={['student','class_representative']}><UploadCertificatePage /></ProtectedRoute>
            } />
            <Route path="/certificates/:id" element={
              <ProtectedRoute requiredRoles={OD_ROLES}><CertificateDetailPage /></ProtectedRoute>
            } />

            {/* Reports & Audit routes */}
            <Route path="/reports" element={
              <ProtectedRoute requiredRoles={REPORTS_ROLES}><ReportsPage /></ProtectedRoute>
            } />
            <Route path="/audit" element={
              <ProtectedRoute requiredRoles={AUDIT_ROLES}><AuditPage /></ProtectedRoute>
            } />

            {/* Role-specific dashboards */}
            <Route path="/student/*" element={
              <ProtectedRoute requiredRole="student"><StudentDashboard /></ProtectedRoute>
            } />
            <Route path="/student-rep/*" element={
              <ProtectedRoute requiredRole="student_representative"><StudentRepDashboard /></ProtectedRoute>
            } />
            <Route path="/class-rep/*" element={
              <ProtectedRoute requiredRole="class_representative"><ClassRepDashboard /></ProtectedRoute>
            } />
            <Route path="/faculty/*" element={
              <ProtectedRoute requiredRole="coordinating_faculty"><FacultyDashboard /></ProtectedRoute>
            } />
            <Route path="/admin/*" element={
              <ProtectedRoute requiredRole="admin"><AdminDashboard /></ProtectedRoute>
            } />
            <Route path="/management/*" element={
              <ProtectedRoute requiredRoles={MANAGEMENT_ROLES}><ManagementDashboard /></ProtectedRoute>
            } />
          </Route>

          {/* Redirects */}
          <Route path="/" element={<Navigate to="/login" />} />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </AuthProvider>
    </Router>
  );
}

export default App;
