import { useContext, useEffect, useState, useCallback } from 'react';
import { AuthContext } from '../context/AuthContext';
import managementService from '../services/managementService';

const ClassRepDashboard = () => {
    const { user, logout } = useContext(AuthContext);
    const classId = user?.class_id;

    const [classInfo, setClassInfo] = useState(null);
    const [students, setStudents] = useState([]);
    const [pagination, setPagination] = useState({ total: 0, limit: 25, offset: 0 });
    const [search, setSearch] = useState('');
    const [filterStatus, setFilterStatus] = useState('ACTIVE');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    const loadClass = useCallback(async () => {
        if (!classId) return;
        try {
            const info = await managementService.getClass(classId);
            setClassInfo(info);
        } catch { /* silent */ }
    }, [classId]);

    const loadStudents = useCallback(async (offset = 0) => {
        if (!classId) return;
        setLoading(true);
        try {
            const params = { class_id: classId, limit: pagination.limit, offset };
            if (search) params.q = search;
            if (filterStatus) params.status = filterStatus;
            const result = await managementService.getStudents(params);
            setStudents(result.data || []);
            setPagination((p) => ({ ...p, total: result.pagination?.total || 0, offset }));
        } catch (e) {
            setError(e?.response?.data?.error || 'Failed to load students.');
        } finally { setLoading(false); }
    }, [classId, search, filterStatus, pagination.limit]);

    useEffect(() => { loadClass(); }, [loadClass]);
    useEffect(() => { loadStudents(0); }, [loadStudents]);

    if (!classId) {
        return (
            <div className="container-main p-6 flex items-center justify-center min-h-screen">
                <div className="text-center">
                    <h2 className="text-xl font-bold text-red-600 mb-2">No class assigned</h2>
                    <p className="text-gray-500">Your Class Representative account is not linked to a class yet. Contact an administrator.</p>
                    <button className="btn-secondary mt-4" onClick={logout}>Logout</button>
                </div>
            </div>
        );
    }

    return (
        <div className="container-main p-6">
            <div className="max-w-5xl mx-auto">
                <header className="flex justify-between items-center mb-6">
                    <div>
                        <p className="text-sm text-blue-700 uppercase tracking-wide">Class Representative</p>
                        <h1 className="text-3xl font-bold text-gray-900">
                            {classInfo?.display_name || 'My Class'}
                        </h1>
                        <p className="text-gray-500 text-sm">
                            {classInfo?.department_name} · {classInfo?.academic_year_name} · {user?.username}
                        </p>
                    </div>
                    <button className="btn-secondary" onClick={logout}>Logout</button>
                </header>

                {error && (
                    <div className="bg-red-50 border border-red-300 text-red-800 rounded px-4 py-3 mb-4">
                        {error}
                        <button className="ml-4 font-bold" onClick={() => setError('')}>×</button>
                    </div>
                )}

                {/* Class summary cards */}
                {classInfo && (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                        <div className="card text-center">
                            <p className="text-2xl font-bold text-blue-700">{pagination.total}</p>
                            <p className="text-xs text-gray-500 mt-1">Total Students</p>
                        </div>
                        <div className="card text-center">
                            <p className="text-2xl font-bold text-green-700">{classInfo.students?.filter((s) => s.status === 'ACTIVE').length ?? '—'}</p>
                            <p className="text-xs text-gray-500 mt-1">Active</p>
                        </div>
                        <div className="card text-center">
                            <p className="text-2xl font-bold text-purple-700">{classInfo.representatives?.length ?? 0}</p>
                            <p className="text-xs text-gray-500 mt-1">CRs</p>
                        </div>
                        <div className="card text-center">
                            <p className="text-sm font-medium text-gray-700">{classInfo.advisor?.username || 'None'}</p>
                            <p className="text-xs text-gray-500 mt-1">Class Advisor</p>
                        </div>
                    </div>
                )}

                {/* Student search and list */}
                <div className="card">
                    <div className="flex flex-wrap gap-3 mb-4 items-end">
                        <input
                            className="form-input w-48"
                            placeholder="Search name or register…"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && loadStudents(0)}
                        />
                        <select
                            className="form-input w-36"
                            value={filterStatus}
                            onChange={(e) => { setFilterStatus(e.target.value); loadStudents(0); }}
                        >
                            <option value="">All statuses</option>
                            <option value="ACTIVE">Active</option>
                            <option value="INACTIVE">Inactive</option>
                            <option value="GRADUATED">Graduated</option>
                        </select>
                        <button className="btn-primary" onClick={() => loadStudents(0)}>Search</button>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left">
                            <thead>
                                <tr className="border-b text-gray-500">
                                    <th className="py-2 pr-4">Register</th>
                                    <th className="pr-4">Name</th>
                                    <th className="pr-4">Status</th>
                                </tr>
                            </thead>
                            <tbody>
                                {students.map((s) => (
                                    <tr key={s.student_id} className="border-b hover:bg-gray-50">
                                        <td className="py-2 pr-4 font-mono text-xs">{s.register_number}</td>
                                        <td className="pr-4">{s.name}</td>
                                        <td>
                                            <span className={`text-xs px-2 py-0.5 rounded-full ${s.status === 'ACTIVE' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                                                {s.status}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                                {!loading && students.length === 0 && (
                                    <tr><td colSpan={3} className="py-8 text-center text-gray-400">No students found</td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>

                    <div className="flex justify-between items-center mt-3 text-sm text-gray-500">
                        <span>{pagination.total} students in this class</span>
                        <div className="flex gap-2">
                            <button
                                disabled={pagination.offset === 0}
                                onClick={() => loadStudents(Math.max(0, pagination.offset - pagination.limit))}
                                className="btn-secondary disabled:opacity-40"
                            >← Prev</button>
                            <span>Page {Math.floor(pagination.offset / pagination.limit) + 1}</span>
                            <button
                                disabled={pagination.offset + pagination.limit >= pagination.total}
                                onClick={() => loadStudents(pagination.offset + pagination.limit)}
                                className="btn-secondary disabled:opacity-40"
                            >Next →</button>
                        </div>
                    </div>
                </div>

                {/* Current CRs */}
                {classInfo?.representatives?.length > 0 && (
                    <div className="card mt-6">
                        <h2 className="font-bold mb-3">Class Representatives</h2>
                        <div className="divide-y text-sm">
                            {classInfo.representatives.map((cr) => (
                                <div key={cr.student_id} className="py-2">
                                    <strong>{cr.name}</strong>
                                    <span className="text-gray-400 text-xs ml-2">{cr.register_number}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ClassRepDashboard;