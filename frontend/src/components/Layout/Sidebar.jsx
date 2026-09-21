import { useContext } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { AuthContext } from '../../context/AuthContext';

const ROLE_LABELS = {
  super_admin: 'Super Admin',
  admin: 'Administrator',
  coordinating_faculty: 'Coord. Faculty',
  class_advisor: 'Class Advisor',
  class_representative: 'Class Rep.',
  student_representative: 'Student Rep.',
  student: 'Student',
};

const ROLE_COLORS = {
  super_admin: 'from-purple-600 to-violet-700',
  admin: 'from-indigo-600 to-blue-700',
  coordinating_faculty: 'from-blue-600 to-cyan-700',
  class_advisor: 'from-teal-600 to-emerald-700',
  class_representative: 'from-green-600 to-teal-700',
  student_representative: 'from-amber-500 to-orange-600',
  student: 'from-orange-500 to-rose-600',
};

const NAV_ITEMS = {
  super_admin: [
    { path: '/management', label: 'Dashboard', icon: 'home' },
    { path: '/management?tab=Org+Structure', label: 'Departments', icon: 'building' },
    { path: '/management?tab=Students', label: 'Students', icon: 'users' },
    { path: '/management?tab=Advisors', label: 'Class Advisors', icon: 'check-badge' },
    { path: '/management?tab=Representatives', label: 'Class Representatives', icon: 'user-group' },
    { path: '/ods', label: 'On-Duty Records', icon: 'document' },
    { path: '/certificates', label: 'Certificates', icon: 'badge' },
    { path: '/reports', label: 'Reports', icon: 'chart' },
    { path: '/audit', label: 'Audit Log', icon: 'clipboard' },
  ],
  admin: [
    { path: '/admin', label: 'Dashboard', icon: 'home' },
    { path: '/management?tab=Students', label: 'Students', icon: 'users' },
    { path: '/admin?section=advisors', label: 'Faculty / Advisors', icon: 'user' },
    { path: '/management?tab=Representatives', label: 'Class Representatives', icon: 'user-group' },
    { path: '/ods', label: 'On-Duty Records', icon: 'document' },
    { path: '/certificates', label: 'Certificates', icon: 'badge' },
    { path: '/reports', label: 'Reports', icon: 'chart' },
    { path: '/audit', label: 'Audit Log', icon: 'clipboard' },
  ],
  coordinating_faculty: [
    { path: '/faculty', label: 'Dashboard', icon: 'home' },
    { path: '/ods', label: 'On-Duty Records', icon: 'document' },
    { path: '/certificates', label: 'Certificates', icon: 'badge' },
    { path: '/reports', label: 'Reports', icon: 'chart' },
  ],
  class_advisor: [
    { path: '/management', label: 'Dashboard', icon: 'home' },
    { path: '/management?tab=Students', label: 'Students', icon: 'users' },
    { path: '/ods', label: 'On-Duty Records', icon: 'document' },
    { path: '/ods/create', label: 'Register OD', icon: 'plus-circle' },
    { path: '/management?tab=Representatives', label: 'Class Representatives', icon: 'user-group' },
    { path: '/management?tab=Bulk+Import', label: 'Bulk Import', icon: 'upload' },
    { path: '/certificates', label: 'Certificates', icon: 'badge' },
    { path: '/reports', label: 'Reports', icon: 'chart' },
  ],
  class_representative: [
    { path: '/class-rep', label: 'Dashboard', icon: 'home' },
    { path: '/class-rep?tab=roster', label: 'My Class', icon: 'building' },
    { path: '/ods', label: 'On-Duty Records', icon: 'document' },
    { path: '/ods/create', label: 'Register OD', icon: 'plus-circle' },
    { path: '/certificates', label: 'Certificates', icon: 'badge' },
  ],
  student_representative: [
    { path: '/student-rep', label: 'Dashboard', icon: 'home' },
    { path: '/ods', label: 'On-Duty Records', icon: 'document' },
  ],
  student: [
    { path: '/student', label: 'Dashboard', icon: 'home' },
    { path: '/ods', label: 'My On-Duty Records', icon: 'document' },
    { path: '/certificates', label: 'My Certificates', icon: 'badge' },
    { path: '/certificates/upload', label: 'Upload Certificate', icon: 'upload' },
  ],
};

function NavIcon({ type }) {
  const icons = {
    home: <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" />,
    users: <path d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197" />,
    user: <path d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />,
    building: <path d="M3 21h18M9 21V10.5M15 21V10.5M5 10.5l7-7 7 7" />,
    document: <><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2" /><rect x="9" y="3" width="6" height="4" rx="1" /><line x1="9" y1="12" x2="15" y2="12" /><line x1="9" y1="16" x2="13" y2="16" /></>,
    'check-badge': <path d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />,
    'user-group': <path d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0" />,
    badge: <><circle cx="12" cy="8" r="5" /><path d="M8.21 13.89L7 23l5-3 5 3-1.21-9.12" /></>,
    chart: <path d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />,
    clipboard: <><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2" /><rect x="9" y="3" width="6" height="4" rx="1" /></>,
    'plus-circle': <><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="16" /><line x1="8" y1="12" x2="16" y2="12" /></>,
    upload: <><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" /></>,
  };
  return (
    <svg width="17" height="17" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8">
      {icons[type] || icons.document}
    </svg>
  );
}

function getInitials(name) {
  if (!name) return '?';
  return name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
}

export default function Sidebar({ mobileOpen, onMobileClose }) {
  const { user, logout } = useContext(AuthContext);
  const navigate = useNavigate();
  const location = useLocation();

  if (!user) return null;

  const role = user.role;
  const navItems = NAV_ITEMS[role] || [];
  const colorGradient = ROLE_COLORS[role] || ROLE_COLORS.student;
  const roleLabel = ROLE_LABELS[role] || role;
  const displayName = user.username || user.name || 'User';
  const initials = getInitials(displayName);

  const isActive = (item) => {
    const [itemPath, itemQuery] = item.path.split('?');
    return location.pathname === itemPath && (!itemQuery || location.search.includes(itemQuery.split('=')[1]));
  };

  const handleNav = (item) => {
    const [path, query] = item.path.split('?');
    if (query) {
      const [key, val] = query.split('=');
      navigate(`${path}?${key}=${val}`);
    } else {
      navigate(path);
    }
    if (onMobileClose) onMobileClose();
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <>
      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 bg-black/40 z-20 lg:hidden" onClick={onMobileClose} />
      )}

      <aside className={`
        fixed left-0 top-0 h-full w-60 bg-white border-r border-gray-200 z-30 flex flex-col
        transition-transform duration-200
        ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}
        lg:translate-x-0 lg:static lg:z-auto
      `}>
        {/* Brand */}
        <div className="px-5 pt-6 pb-5 border-b border-gray-200">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center flex-shrink-0">
              <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="white" strokeWidth="2.2">
                <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2"/>
                <rect x="9" y="3" width="6" height="4" rx="1"/>
                <path d="M9 12l2 2 4-4"/>
              </svg>
            </div>
            <div>
              <div className="font-display font-extrabold text-sm text-gray-900 leading-tight">CERTIFY</div>
              <div className="text-xs text-gray-400 leading-tight">Certificate Management</div>
            </div>
          </div>
        </div>

        {/* Role badge */}
        <div className="px-4 py-2 border-b border-gray-100">
          <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-xs font-semibold text-white bg-gradient-to-r ${colorGradient}`}>
            {roleLabel}
          </span>
        </div>

        {/* Nav */}
        <nav className="flex-1 py-3 px-3 overflow-y-auto">
          <ul className="space-y-0.5">
            {navItems.map((item) => {
              const active = isActive(item);
              return (
                <li key={item.path + item.label}>
                  <button
                    onClick={() => handleNav(item)}
                    className={`
                      w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all cursor-pointer text-left
                      ${active ? 'bg-indigo-50 text-indigo-600' : 'text-gray-500 hover:bg-gray-50 hover:text-gray-900'}
                    `}
                  >
                    <span className={`flex-shrink-0 ${active ? 'text-indigo-600' : 'text-gray-400'}`}>
                      <NavIcon type={item.icon} />
                    </span>
                    <span className="flex-1 truncate">{item.label}</span>
                    {active && <span className="w-1.5 h-1.5 rounded-full bg-indigo-600 flex-shrink-0" />}
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* User footer */}
        <div className="p-4 border-t border-gray-200">
          <div className="flex items-center gap-3">
            <div className={`w-8 h-8 rounded-full bg-gradient-to-br ${colorGradient} flex items-center justify-center text-white text-xs font-bold flex-shrink-0`}>
              {initials}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-gray-900 truncate">{displayName}</p>
              <p className="text-xs text-gray-400">{roleLabel}</p>
            </div>
            <button onClick={handleLogout} title="Sign out" className="text-gray-400 hover:text-red-500 transition-colors">
              <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9"/>
              </svg>
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
