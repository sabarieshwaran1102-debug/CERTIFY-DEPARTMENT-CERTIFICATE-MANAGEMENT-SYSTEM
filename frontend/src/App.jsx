import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/Layout/ProtectedRoute';

import LoginPage from './pages/LoginPage';
import NotFoundPage from './pages/NotFoundPage';
import UnauthorizedPage from './pages/UnauthorizedPage';
import StudentDashboard from './pages/StudentDashboard';
import StudentRepDashboard from './pages/StudentRepDashboard';
import FacultyDashboard from './pages/FacultyDashboard';
import AdminDashboard from './pages/AdminDashboard';
import ManagementDashboard from './pages/ManagementDashboard';
import ClassRepDashboard from './pages/ClassRepDashboard';

function App() {
    return (
        <Router>
            <AuthProvider>
                <Routes>
                    <Route path="/login" element={<LoginPage />} />
                    <Route path="/unauthorized" element={<UnauthorizedPage />} />

                    <Route path="/student/*"
                        element={<ProtectedRoute requiredRole="student"><StudentDashboard /></ProtectedRoute>} />

                    <Route path="/student-rep/*"
                        element={<ProtectedRoute requiredRole="student_representative"><StudentRepDashboard /></ProtectedRoute>} />

                    <Route path="/class-rep/*"
                        element={<ProtectedRoute requiredRole="class_representative"><ClassRepDashboard /></ProtectedRoute>} />

                    <Route path="/faculty/*"
                        element={<ProtectedRoute requiredRole="coordinating_faculty"><FacultyDashboard /></ProtectedRoute>} />

                    <Route path="/admin/*"
                        element={<ProtectedRoute requiredRole="admin"><AdminDashboard /></ProtectedRoute>} />

                    <Route path="/management/*"
                        element={<ProtectedRoute requiredRoles={['super_admin', 'admin', 'coordinating_faculty', 'class_advisor']}><ManagementDashboard /></ProtectedRoute>} />

                    <Route path="/" element={<Navigate to="/login" />} />
                    <Route path="*" element={<NotFoundPage />} />
                </Routes>
            </AuthProvider>
        </Router>
    );
}

export default App;