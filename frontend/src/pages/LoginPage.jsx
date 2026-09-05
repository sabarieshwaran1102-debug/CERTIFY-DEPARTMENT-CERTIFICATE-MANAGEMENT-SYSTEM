import { useState, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';

const LoginPage = () => {
    const [credentials, setCredentials] = useState({});
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const { login } = useContext(AuthContext);
    const navigate = useNavigate();

    const handleChange = (e) => {
        const { name, value } = e.target;
        setCredentials(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');
        
        try {
            // TODO: Implement login in Phase 5 after authentication method is confirmed
            setError('Authentication method not yet configured. Pending department decision.');
        } catch (err) {
            setError(err.message || 'Login failed');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-100">
            <div className="bg-white p-8 rounded-lg shadow-md w-96">
                <h1 className="text-2xl font-bold text-center mb-6">Certificate Management System</h1>
                
                {error && (
                    <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
                        {error}
                    </div>
                )}

                <form onSubmit={handleSubmit}>
                    <div className="mb-4">
                        <label className="form-label">Username</label>
                        <input
                            className="form-input"
                            type="text"
                            name="username"
                            placeholder="Enter your username"
                            onChange={handleChange}
                            required
                        />
                    </div>

                    <div className="mb-6">
                        <label className="form-label">Password</label>
                        <input
                            className="form-input"
                            type="password"
                            name="password"
                            placeholder="Enter your password"
                            onChange={handleChange}
                            required
                        />
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full btn-primary disabled:opacity-50"
                    >
                        {loading ? 'Logging in...' : 'Login'}
                    </button>
                </form>

                <p className="text-center text-gray-600 text-sm mt-4">
                    Authentication method is pending department confirmation.
                </p>
            </div>
        </div>
    );
};

export default LoginPage;
