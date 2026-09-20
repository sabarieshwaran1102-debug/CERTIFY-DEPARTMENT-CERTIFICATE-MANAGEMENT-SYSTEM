import { useState, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import authService from '../services/authService';

const LoginPage = () => {
    const [credentials, setCredentials] = useState({ username: '', password: '', role: 'student' });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const { login } = useContext(AuthContext);
    const navigate = useNavigate();

    const handleChange = (e) => {
        const { name, value } = e.target;
        setCredentials((prev) => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');
        try {
            const result = await authService.login(credentials);
            login(result.token, result.user);
            const role = result.user?.role;
            if (role === 'admin') navigate('/admin');
            else if (['super_admin', 'class_advisor'].includes(role)) navigate('/management');
            else if (role === 'class_representative') navigate('/class-rep');
            else if (role === 'student') navigate('/student');
            else if (role === 'student_representative') navigate('/student-rep');
            else if (role === 'coordinating_faculty') navigate('/faculty');
            else navigate('/unauthorized');
        } catch (err) {
            setError(err.message || err.error || 'Login failed');
        } finally { setLoading(false); }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-100">
            <div className="bg-white p-8 rounded-lg shadow-md w-full max-w-md">
                <h1 className="text-2xl font-bold text-center mb-2">Certificate Management System</h1>
                <p className="text-center text-gray-500 text-sm mb-6">Sign in to continue.</p>

                {error && (
                    <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">{error}</div>
                )}

                <form onSubmit={handleSubmit}>
                    <div className="mb-4">
                        <label className="form-label">Role</label>
                        <select className="form-input" name="role" value={credentials.role} onChange={handleChange}>
                            <option value="student">Student</option>
                            <option value="class_representative">Class Representative</option>
                            <option value="student_representative">Student Representative (legacy)</option>
                            <option value="class_advisor">Class Advisor</option>
                            <option value="admin">Admin</option>
                            <option value="super_admin">Super Admin</option>
                            <option value="coordinating_faculty">Coordinating Faculty</option>
                        </select>
                    </div>

                    <div className="mb-4">
                        <label className="form-label">
                            {credentials.role === 'student' ? 'Register Number' : 'Username'}
                        </label>
                        <input className="form-input" type="text" name="username" value={credentials.username}
                            placeholder={credentials.role === 'student' ? 'Register number' : 'Username'}
                            onChange={handleChange} required />
                    </div>

                    <div className="mb-6">
                        <label className="form-label">
                            {['student', 'class_representative'].includes(credentials.role) ? 'Date of Birth' : 'Password'}
                        </label>
                        <input className="form-input"
                            type={['student', 'class_representative'].includes(credentials.role) ? 'date' : 'password'}
                            name="password" value={credentials.password}
                            placeholder={['student', 'class_representative'].includes(credentials.role) ? undefined : 'Password'}
                            onChange={handleChange} required />
                    </div>

                    <button type="submit" disabled={loading} className="w-full btn-primary disabled:opacity-50">
                        {loading ? 'Signing in…' : 'Sign In'}
                    </button>
                </form>
            </div>
        </div>
    );
};

export default LoginPage;