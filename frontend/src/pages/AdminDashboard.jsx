import { useContext, useEffect, useState } from 'react';
import { AuthContext } from '../context/AuthContext';
import userService from '../services/userService';

const AdminDashboard = () => {
    const { user, logout } = useContext(AuthContext);
    const [faculty, setFaculty] = useState([]);
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [message, setMessage] = useState('');
    const [error, setError] = useState('');

    const loadFaculty = async () => {
        try {
            const result = await userService.getFaculty();
            setFaculty(result.data || []);
        } catch (requestError) {
            setError(requestError.error || 'Unable to load faculty accounts.');
        }
    };

    useEffect(() => {
        loadFaculty();
    }, []);

    const createFaculty = async (event) => {
        event.preventDefault();
        setMessage('');
        setError('');
        try {
            await userService.createFaculty(username, password);
            setUsername('');
            setPassword('');
            setMessage('Coordinating Faculty account created.');
            await loadFaculty();
        } catch (requestError) {
            setError(requestError.error || 'Unable to create faculty account.');
        }
    };

    const toggleFaculty = async (account) => {
        try {
            await userService.updateFaculty(account.user_id, { is_active: !account.is_active });
            await loadFaculty();
        } catch (requestError) {
            setError(requestError.error || 'Unable to update faculty account.');
        }
    };

    return (
        <div className="container-main p-6">
            <div className="max-w-4xl mx-auto">
                <div className="flex justify-between items-center mb-6">
                    <div>
                        <h1 className="text-3xl font-bold text-gray-900">Admin Dashboard</h1>
                        <p className="text-gray-600">Welcome, {user?.username || 'Admin'}</p>
                    </div>
                    <button className="btn-secondary" onClick={logout}>Logout</button>
                </div>

                {message && <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded mb-6">{message}</div>}
                {error && <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-6">{error}</div>}

                <div className="card mb-8">
                    <h2 className="text-xl font-bold mb-4">Create Coordinating Faculty</h2>
                    <form onSubmit={createFaculty} className="grid gap-4 md:grid-cols-3">
                        <input className="form-input" value={username} onChange={(event) => setUsername(event.target.value)} placeholder="Username" required />
                        <input className="form-input" type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Password" minLength="8" required />
                        <button className="btn-primary" type="submit">Create Faculty</button>
                    </form>
                </div>

                <div className="card">
                    <h2 className="text-xl font-bold mb-4">Coordinating Faculty Accounts</h2>
                    <div className="space-y-3">
                        {faculty.map((account) => (
                            <div key={account.user_id} className="flex justify-between items-center border-b py-3">
                                <span>{account.username} ({account.is_active ? 'Active' : 'Inactive'})</span>
                                <button className="btn-secondary" onClick={() => toggleFaculty(account)}>{account.is_active ? 'Deactivate' : 'Activate'}</button>
                            </div>
                        ))}
                        {faculty.length === 0 && <p className="text-gray-500">No faculty accounts found.</p>}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AdminDashboard;