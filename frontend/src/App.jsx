import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/Layout/ProtectedRoute';

// Pages
import LoginPage from './pages/LoginPage';
import NotFoundPage from './pages/NotFoundPage';
import UnauthorizedPage from './pages/UnauthorizedPage';

// Role-specific Dashboards
import StudentDashboard from './pages/StudentDashboard';
import StudentRepDashboard from './pages/StudentRepDashboard';
import FacultyDashboard from './pages/FacultyDashboard';
import AdminDashboard from './pages/AdminDashboard';
import ManagementDashboard from './pages/ManagementDashboard';

function App() {
    return (
        <Router>
            <AuthProvider>
                <Routes>
                    {/* Public Routes */}
                    <Route path="/login" element={<LoginPage />} />
                    <Route path="/unauthorized" element={<UnauthorizedPage />} />
                    
                    {/* Protected Routes */}
                    <Route 
                        path="/student/*" 
                        element={<ProtectedRoute requiredRole="student"><StudentDashboard /></ProtectedRoute>} 
                    />
                    <Route 
                        path="/student-rep/*" 
                        element={<ProtectedRoute requiredRole="student_representative"><StudentRepDashboard /></ProtectedRoute>} 
                    />
                    <Route 
                        path="/faculty/*" 
                        element={<ProtectedRoute requiredRole="coordinating_faculty"><FacultyDashboard /></ProtectedRoute>} 
                    />
                    <Route
                        path="/admin/*"
                        element={<ProtectedRoute requiredRole="admin"><AdminDashboard /></ProtectedRoute>}
                    />
                    <Route
                        path="/management/*"
                        element={<ProtectedRoute requiredRoles={['super_admin', 'admin', 'coordinating_faculty', 'class_advisor']}><ManagementDashboard /></ProtectedRoute>}
                    />
                    
                    {/* Default and 404 Routes */}
                    <Route path="/" element={<Navigate to="/login" />} />
                    <Route path="*" element={<NotFoundPage />} />
                </Routes>
            </AuthProvider>
        </Router>
    );
}

export default App;
