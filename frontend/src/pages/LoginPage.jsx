import { useState, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import authService from '../services/authService';

const ROLES = [
  { value: 'super_admin',            label: 'Super Admin',            hint: 'Full system access',             color: 'text-purple-700 bg-purple-50 border-purple-200' },
  { value: 'admin',                  label: 'Admin',                  hint: 'Department management',          color: 'text-indigo-700 bg-indigo-50 border-indigo-200' },
  { value: 'coordinating_faculty',   label: 'Coordinating Faculty',   hint: 'OD & certificate coordination', color: 'text-blue-700 bg-blue-50 border-blue-200' },
  { value: 'class_advisor',          label: 'Class Advisor',          hint: 'Assigned class management',     color: 'text-teal-700 bg-teal-50 border-teal-200' },
  { value: 'class_representative',   label: 'Class Representative',   hint: 'Own class OD operations',       color: 'text-green-700 bg-green-50 border-green-200' },
  { value: 'student_representative', label: 'Student Representative', hint: 'Student council functions',     color: 'text-amber-700 bg-amber-50 border-amber-200' },
];

const ROLE_REDIRECTS = {
  admin:                 '/admin',
  super_admin:           '/management',
  class_advisor:         '/management',
  coordinating_faculty:  '/faculty',
  class_representative:  '/class-rep',
  student_representative:'/student-rep',
  student:               '/student',
};

export default function LoginPage() {
  const { login } = useContext(AuthContext);
  const navigate = useNavigate();

  const [tab, setTab] = useState('staff');
  const [selectedRole, setSelectedRole] = useState('admin');
  const [showRolePicker, setShowRolePicker] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const isStudent = tab === 'student';
  const currentRole = ROLES.find(r => r.value === selectedRole) || ROLES[0];

  const handleTabChange = (t) => {
    setTab(t);
    setError('');
    setUsername('');
    setPassword('');
    setSelectedRole(t === 'student' ? 'student' : 'admin');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const role = isStudent ? 'student' : selectedRole;
      const result = await authService.login({ username: username.trim(), password, role });
      login(result.token, result.user);
      navigate(ROLE_REDIRECTS[result.user?.role] || '/login', { replace: true });
    } catch (err) {
      setError(err?.error || err?.message || 'Invalid credentials');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-[#f5f6fa] to-blue-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-indigo-600 shadow-lg shadow-indigo-200 mb-4">
            <svg width="28" height="28" fill="none" viewBox="0 0 24 24" stroke="white" strokeWidth="2">
              <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2"/>
              <rect x="9" y="3" width="6" height="4" rx="1"/>
              <path d="M9 12l2 2 4-4"/>
            </svg>
          </div>
          <h1 className="font-display font-bold text-2xl text-gray-900">CERTIFY</h1>
          <p className="text-sm text-gray-400 mt-0.5">Department Certificate Management System</p>
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 shadow-xl overflow-hidden">
          <div className="flex border-b border-gray-200">
            {[{ key: 'staff', label: 'Staff / Admin' }, { key: 'student', label: 'Student' }].map(t => (
              <button key={t.key} onClick={() => handleTabChange(t.key)}
                className={`flex-1 py-3.5 text-sm font-semibold transition-colors ${tab === t.key ? 'text-indigo-600 border-b-2 border-indigo-600 bg-indigo-50/50' : 'text-gray-500 hover:text-gray-900'}`}>
                {t.label}
              </button>
            ))}
          </div>

          <div className="p-6">
            {!isStudent && (
              <div className="mb-4">
                <label className="block text-xs font-semibold text-gray-700 mb-1.5">Login as</label>
                <button type="button" onClick={() => setShowRolePicker(!showRolePicker)}
                  className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg border-2 text-left transition-all ${currentRole.color}`}>
                  <div>
                    <span className="text-sm font-semibold">{currentRole.label}</span>
                    <span className="text-xs ml-2 opacity-70">{currentRole.hint}</span>
                  </div>
                  <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" className={`transition-transform ${showRolePicker ? 'rotate-180' : ''}`}>
                    <polyline points="6 9 12 15 18 9"/>
                  </svg>
                </button>
                {showRolePicker && (
                  <div className="mt-1 border border-gray-200 rounded-lg overflow-hidden shadow-lg">
                    {ROLES.map(r => (
                      <button key={r.value} type="button"
                        onClick={() => { setSelectedRole(r.value); setShowRolePicker(false); }}
                        className={`w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-gray-50 transition-colors ${selectedRole === r.value ? 'bg-indigo-50/50' : 'bg-white'}`}>
                        <span className={`inline-flex px-2 py-0.5 rounded text-xs font-semibold border ${r.color}`}>{r.label}</span>
                        <span className="text-xs text-gray-400">{r.hint}</span>
                        {selectedRole === r.value && (
                          <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="#4f46e5" strokeWidth="2.5" className="ml-auto">
                            <polyline points="20 6 9 17 4 12"/>
                          </svg>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {isStudent && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg px-3 py-2 mb-4">
                <p className="text-xs text-blue-700">Students log in using their <strong>Registration Number</strong> and <strong>Date of Birth</strong> (YYYY-MM-DD) as password.</p>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="login-username" className="block text-xs font-semibold text-gray-700 mb-1.5">{isStudent ? 'Registration Number' : 'Username / Email'}</label>
                <input id="login-username" type="text" value={username} onChange={e => setUsername(e.target.value)}
                  placeholder={isStudent ? 'e.g. 22AD001' : 'Enter your username'} required
                  className="w-full px-3 py-2.5 rounded-lg border border-gray-200 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition-colors" />
              </div>

              <div>
                <label htmlFor="login-password" className="block text-xs font-semibold text-gray-700 mb-1.5">{isStudent ? 'Date of Birth' : 'Password'}</label>
                <div className="relative">
                  <input id="login-password" type={isStudent ? 'date' : (showPass ? 'text' : 'password')}
                    value={password} onChange={e => { setPassword(e.target.value); setError(''); }} required
                    placeholder={isStudent ? undefined : 'Enter your password'}
                    className="w-full px-3 pr-10 py-2.5 rounded-lg border border-gray-200 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition-colors" />
                  {!isStudent && (
                    <button type="button" onClick={() => setShowPass(!showPass)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors">
                      <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                        {showPass ? <><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></> : <><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></>}
                      </svg>
                    </button>
                  )}
                </div>
              </div>

              {error && (
                <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg px-3 py-2.5">
                  <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="#dc2626" strokeWidth="2">
                    <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                  </svg>
                  <p className="text-xs text-red-600">{error}</p>
                </div>
              )}

              <button type="submit" disabled={loading}
                className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 text-white rounded-lg text-sm font-semibold transition-colors flex items-center justify-center gap-2 shadow-sm">
                {loading ? (
                  <>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" className="animate-spin">
                      <circle cx="12" cy="12" r="10" strokeOpacity="0.3"/>
                      <path d="M12 2a10 10 0 0110 10" strokeLinecap="round"/>
                    </svg>
                    Signing in…
                  </>
                ) : 'Sign In'}
              </button>
            </form>
          </div>
        </div>
        <p className="text-center text-xs text-gray-400 mt-6">CERTIFY · Department Certificate Management System</p>
      </div>
    </div>
  );
}
