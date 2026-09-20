import { useContext, useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import managementService from '../services/managementService';
import { LoadingState, ErrorState, PageHeader, SectionCard, StatCard, SearchInput, Pagination, Btn } from '../components/ui/index';
import Badge from '../components/ui/Badge';

export default function ClassRepDashboard() {
  const { user } = useContext(AuthContext);
  const navigate = useNavigate();
  const classId = user?.class_id;

  const [classInfo, setClassInfo] = useState(null);
  const [students, setStudents] = useState([]);
  const [pagination, setPagination] = useState({ total: 0, limit: 25, offset: 0 });
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('ACTIVE');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!classId) return;
    managementService.getClass(classId).then(setClassInfo).catch(() => {});
  }, [classId]);

  const loadStudents = useCallback(async (pg = 1) => {
    if (!classId) return;
    setLoading(true);
    try {
      const limit = 25;
      const params = { class_id: classId, limit, offset: (pg - 1) * limit };
      if (search) params.q = search;
      if (filterStatus) params.status = filterStatus;
      const result = await managementService.getStudents(params);
      setStudents(result.data || []);
      setPagination(p => ({ ...p, total: result.pagination?.total || 0 }));
    } catch (e) {
      setError(e?.response?.data?.error || 'Failed to load students');
    } finally {
      setLoading(false);
    }
  }, [classId, search, filterStatus]);

  useEffect(() => { loadStudents(page); }, [page, loadStudents]);

  if (!classId) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center max-w-sm">
          <div className="w-14 h-14 rounded-2xl bg-amber-50 flex items-center justify-center mx-auto mb-4">
            <svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="#d97706" strokeWidth="1.8">
              <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
              <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
            </svg>
          </div>
          <h2 className="font-display font-bold text-base text-gray-900 mb-1">No class assigned</h2>
          <p className="text-sm text-gray-400">Your Class Representative account is not linked to a class yet. Contact an administrator.</p>
        </div>
      </div>
    );
  }

  const activeCount = classInfo?.students?.filter(s => s.status === 'ACTIVE').length ?? 0;

  return (
    <div className="flex-1 overflow-y-auto">
      <PageHeader
        title={classInfo?.display_name || 'My Class'}
        subtitle={`${classInfo?.department_name || ''} · ${classInfo?.academic_year_name || ''} · ${user?.username || ''}`}
        action={
          <Btn onClick={() => navigate('/ods/create')}>
            <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
              <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
            Register OD
          </Btn>
        }
      />

      <div className="p-6 space-y-5">
        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard label="Total Students" value={pagination.total}
            iconColor="text-indigo-600 bg-indigo-50"
            icon={<svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8"><path d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197"/></svg>} />
          <StatCard label="Active" value={activeCount}
            iconColor="text-green-600 bg-green-50"
            icon={<svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>} />
          <StatCard label="CRs" value={classInfo?.representatives?.length ?? 0}
            iconColor="text-purple-600 bg-purple-50"
            icon={<svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8"><path d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0"/></svg>} />
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <p className="text-xs font-medium text-gray-500 mb-1">Class Advisor</p>
            <p className="text-sm font-semibold text-gray-900 truncate">{classInfo?.advisor?.username || 'Not assigned'}</p>
          </div>
        </div>

        {/* OD quick link */}
        <div className="bg-indigo-50 border border-indigo-200 rounded-xl px-4 py-3.5 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="#4f46e5" strokeWidth="2">
              <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2"/><rect x="9" y="3" width="6" height="4" rx="1"/>
            </svg>
            <div>
              <p className="text-sm font-semibold text-indigo-700">On-Duty Records</p>
              <p className="text-xs text-indigo-500">View and manage ODs for your class</p>
            </div>
          </div>
          <button onClick={() => navigate('/ods')} className="px-3 py-1.5 text-xs font-semibold text-indigo-600 border border-indigo-300 rounded-lg hover:bg-indigo-100 transition-colors whitespace-nowrap">
            View ODs
          </button>
        </div>

        {/* Students */}
        <SectionCard title="Class Roster">
          <div className="p-4 flex flex-wrap gap-3 border-b border-gray-100">
            <SearchInput value={search} onChange={setSearch} placeholder="Search name or register…" />
            <select value={filterStatus} onChange={e => { setFilterStatus(e.target.value); setPage(1); }}
              className="px-3 py-2.5 rounded-lg border border-gray-200 text-sm text-gray-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 bg-white">
              <option value="">All statuses</option>
              <option value="ACTIVE">Active</option>
              <option value="INACTIVE">Inactive</option>
              <option value="GRADUATED">Graduated</option>
            </select>
            <Btn size="sm" onClick={() => { setPage(1); loadStudents(1); }}>Search</Btn>
          </div>

          {loading ? <LoadingState /> : error ? <ErrorState message={error} onRetry={() => loadStudents(page)} /> : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200">
                      <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase">Register</th>
                      <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase">Name</th>
                      <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {students.length === 0 ? (
                      <tr><td colSpan={3} className="py-8 text-center text-sm text-gray-400">No students found</td></tr>
                    ) : students.map(s => (
                      <tr key={s.student_id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-sm font-mono text-indigo-600 font-medium">{s.register_number}</td>
                        <td className="px-4 py-3 text-sm text-gray-900">{s.name}</td>
                        <td className="px-4 py-3"><Badge variant={(s.status || '').toLowerCase()} label={s.status} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <Pagination total={pagination.total} perPage={25} page={page} onPage={p => { setPage(p); loadStudents(p); }} />
            </>
          )}
        </SectionCard>

        {/* CRs */}
        {classInfo?.representatives?.length > 0 && (
          <SectionCard title="Class Representatives">
            <div className="divide-y divide-gray-100">
              {classInfo.representatives.map(cr => (
                <div key={cr.student_id} className="flex items-center gap-3 px-5 py-3">
                  <div className="w-7 h-7 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center text-xs font-bold flex-shrink-0">
                    {(cr.name || '').split(' ').map(n => n[0]).join('').slice(0,2).toUpperCase()}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-900">{cr.name}</p>
                    <p className="text-xs text-gray-400">{cr.register_number}</p>
                  </div>
                </div>
              ))}
            </div>
          </SectionCard>
        )}
      </div>
    </div>
  );
}
