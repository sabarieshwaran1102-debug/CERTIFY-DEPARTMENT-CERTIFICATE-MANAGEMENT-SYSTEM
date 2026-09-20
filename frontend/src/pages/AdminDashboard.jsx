import { useContext, useEffect, useState } from 'react';
import { AuthContext } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import userService from '../services/userService';

const AdminDashboard = () => {
    const { user, logout } = useContext(AuthContext);
    const navigate = useNavigate();
    const [faculty, setFaculty] = useState([]);
    const [advisors, setAdvisors] = useState([]);
    const [activeSection, setActiveSection] = useState('faculty');
    // Faculty form
    const [fUsername, setFUsername] = useState('');
    const [fPassword, setFPassword] = useState('');
    // Advisor form
    const [aUsername, setAUsername] = useState('');
    const [aPassword, setAPassword] = useState('');
    const [message, setMessage] = useState('');
    const [error, setError] = useState('');

    const notify = (m, isErr = false) => { if (isErr) { setError(m); setMessage(''); } else { setMessage(m); setError(''); } };

    const loadAll = async () => {
        try {
            const [f, a] = await Promise.all([userService.getFaculty(), userService.getClassAdvisors()]);
            setFaculty(f.data || []);
            setAdvisors(a.data || []);
        } catch (e) { notify(e.error || 'Unable to load accounts.', true); }
    };

    useEffect(() => { loadAll(); }, []);

    const createFaculty = async (e) => {
        e.preventDefault();
        try {
            await userService.createFaculty(fUsername, fPassword);
            setFUsername(''); setFPassword('');
            notify('Coordinating Faculty account created.');
            loadAll();
        } catch (e) { notify(e.error || 'Failed.', true); }
    };

    const toggleFaculty = async (account) => {
        try { await userService.updateFaculty(account.user_id, { is_active: !account.is_active }); loadAll(); }
        catch (e) { notify(e.error || 'Failed.', true); }
    };

    const createAdvisor = async (e) => {
        e.preventDefault();
        try {
            await userService.createClassAdvisor(aUsername, aPassword);
            setAUsername(''); setAPassword('');
            notify('Class Advisor account created.');
            loadAll();
        } catch (e) { notify(e.error || 'Failed.', true); }
    };

    const toggleAdvisor = async (account) => {
        try { await userService.updateClassAdvisor(account.user_id, { is_active: !account.is_active }); loadAll(); }
        catch (e) { notify(e.error || 'Failed.', true); }
    };

    return (
        <div className="container-main p-6">
            <div className="max-w-4xl mx-auto">
                <div className="flex justify-between items-center mb-6">
                    <div>
                        <h1 className="text-3xl font-bold text-gray-900">Admin Dashboard</h1>
                        <p className="text-gray-600">{user?.username} · {user?.role}</p>
                    </div>
                    <div className="flex gap-3">
                        <button className="btn-primary" onClick={() => navigate('/management')}>Student & Class Management →</button>
                        <button className="btn-secondary" onClick={logout}>Logout</button>
                    </div>
                </div>

                {message && <div className="bg-green-50 border border-green-300 text-green-800 px-4 py-3 rounded mb-4">{message}</div>}
                {error && <div className="bg-red-50 border border-red-300 text-red-800 px-4 py-3 rounded mb-4">{error}</div>}

                {/* Section switcher */}
                <div className="flex border-b mb-6">
                    {['faculty', 'advisors'].map((s) => (
                        <button key={s} className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${activeSection === s ? 'border-blue-600 text-blue-700' : 'border-transparent text-gray-500'}`} onClick={() => setActiveSection(s)}>
                            {s === 'faculty' ? 'Coordinating Faculty' : 'Class Advisors'}
                        </button>
                    ))}
                </div>

                {activeSection === 'faculty' && (
                    <div className="space-y-6">
                        <div className="card">
                            <h2 className="text-xl font-bold mb-4">Create Coordinating Faculty</h2>
                            <form onSubmit={createFaculty} className="grid gap-4 md:grid-cols-3">
                                <input className="form-input" value={fUsername} onChange={(e) => setFUsername(e.target.value)} placeholder="Username / email" required />
                                <input className="form-input" type="password" value={fPassword} onChange={(e) => setFPassword(e.target.value)} placeholder="Password (min 8)" minLength="8" required />
                                <button className="btn-primary" type="submit">Create</button>
                            </form>
                        </div>
                        <div className="card">
                            <h2 className="text-xl font-bold mb-4">Coordinating Faculty Accounts</h2>
                            <div className="divide-y">
                                {faculty.map((a) => (
                                    <div key={a.user_id} className="flex justify-between items-center py-3">
                                        <span>{a.username} <span className={`text-xs ml-2 ${a.is_active ? 'text-green-600' : 'text-gray-400'}`}>{a.is_active ? 'Active' : 'Inactive'}</span></span>
                                        <button className="btn-secondary text-sm" onClick={() => toggleFaculty(a)}>{a.is_active ? 'Deactivate' : 'Activate'}</button>
                                    </div>
                                ))}
                                {faculty.length === 0 && <p className="text-gray-400 py-4">No faculty accounts.</p>}
                            </div>
                        </div>
                    </div>
                )}

                {activeSection === 'advisors' && (
                    <div className="space-y-6">
                        <div className="card">
                            <h2 className="text-xl font-bold mb-4">Create Class Advisor</h2>
                            <p className="text-sm text-gray-500 mb-3">After creating an account, assign them to a class in Student & Class Management.</p>
                            <form onSubmit={createAdvisor} className="grid gap-4 md:grid-cols-3">
                                <input className="form-input" value={aUsername} onChange={(e) => setAUsername(e.target.value)} placeholder="Username / email" required />
                                <input className="form-input" type="password" value={aPassword} onChange={(e) => setAPassword(e.target.value)} placeholder="Password (min 8)" minLength="8" required />
                                <button className="btn-primary" type="submit">Create</button>
                            </form>
                        </div>
                        <div className="card">
                            <h2 className="text-xl font-bold mb-4">Class Advisor Accounts</h2>
                            <div className="divide-y">
                                {advisors.map((a) => (
                                    <div key={a.user_id} className="flex justify-between items-center py-3">
                                        <div>
                                            <span>{a.username}</span>
                                            <span className={`text-xs ml-2 ${a.is_active ? 'text-green-600' : 'text-gray-400'}`}>{a.is_active ? 'Active' : 'Inactive'}</span>
                                            {a.assigned_class_id && <span className="text-xs ml-2 text-blue-600">Assigned to class #{a.assigned_class_id}</span>}
                                        </div>
                                        <button className="btn-secondary text-sm" onClick={() => toggleAdvisor(a)}>{a.is_active ? 'Deactivate' : 'Activate'}</button>
                                    </div>
                                ))}
                                {advisors.length === 0 && <p className="text-gray-400 py-4">No class advisor accounts.</p>}
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default AdminDashboard;