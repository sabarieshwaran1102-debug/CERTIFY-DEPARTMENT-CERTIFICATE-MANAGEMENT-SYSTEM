import { useState, useEffect, useContext, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthContext } from '../../context/AuthContext';
import odCertService from '../../services/odCertService';
import Badge from '../../components/ui/Badge';
import { LoadingState, ErrorState, EmptyState, PageHeader, SectionCard, SearchInput, StatCard, Pagination, Btn } from '../../components/ui/index';

const STATUS_OPTIONS = ['submitted', 'late_submitted', 'verified', 'rejected', 'overdue', 'pending'];
const STAFF_ROLES = ['super_admin', 'admin', 'coordinating_faculty', 'class_advisor'];

export default function CertificatesPage() {
  const { user } = useContext(AuthContext);
  const navigate = useNavigate();
  const isStaff = STAFF_ROLES.includes(user?.role);

  const [certs, setCerts] = useState([]);
  const [pagination, setPagination] = useState({ total: 0, limit: 25, offset: 0 });
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const load = useCallback(async (pg = 1) => {
    setLoading(true);
    setError('');
    try {
      const limit = 25;
      const params = { limit, offset: (pg - 1) * limit };
      if (statusFilter) params.status = statusFilter;
      const result = await odCertService.getAll(params);
      setCerts(result.data || []);
      setPagination(result.pagination || { total: 0, limit, offset: 0 });
    } catch (e) {
      setError(e?.response?.data?.error || e?.error || 'Failed to load certificates');
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => { load(page); }, [page, load]);

  const filtered = search
    ? certs.filter(c =>
        (c.od_number || '').toLowerCase().includes(search.toLowerCase()) ||
        (c.event_name || '').toLowerCase().includes(search.toLowerCase()) ||
        (c.register_number || '').toLowerCase().includes(search.toLowerCase()) ||
        (c.student_name || '').toLowerCase().includes(search.toLowerCase())
      )
    : certs;

  // Count stats from loaded page
  const counts = { submitted: 0, verified: 0, pending: 0, overdue: 0, late_submitted: 0 };
  certs.forEach(c => { if (counts[c.status] !== undefined) counts[c.status]++; });

  const downloadCert = async (cert) => {
    try {
      const blob = await odCertService.download(cert.id);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = cert.file_name;
      document.body.appendChild(a); a.click(); a.remove();
      window.URL.revokeObjectURL(url);
    } catch { /* silent */ }
  };

  return (
    <div className="flex-1 overflow-y-auto">
      <PageHeader
        title={user?.role === 'student' ? 'My Certificates' : 'Certificate Management'}
        subtitle={user?.role === 'student' ? 'Track and manage your OD certificates' : `${pagination.total} certificate records`}
        action={isStaff && (
          <Btn variant="secondary" onClick={() => load(1)}>
            <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path d="M23 4v6h-6M1 20v-6h6M20.49 9A9 9 0 005.64 5.64L1 10M23 14l-4.64 4.36A9 9 0 013.51 15"/>
            </svg>
            Refresh
          </Btn>
        )}
      />

      <div className="p-6 space-y-5">
        {/* Summary */}
        {!loading && (
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
            {[
              { label: 'Submitted',      value: counts.submitted,     color: 'text-blue-600 bg-blue-50' },
              { label: 'Verified',       value: counts.verified,      color: 'text-green-600 bg-green-50' },
              { label: 'Pending',        value: counts.pending,       color: 'text-amber-600 bg-amber-50' },
              { label: 'Late Submitted', value: counts.late_submitted, color: 'text-orange-600 bg-orange-50' },
              { label: 'Overdue',        value: counts.overdue,       color: 'text-red-600 bg-red-50' },
            ].map(s => (
              <div key={s.label} className="bg-white rounded-xl border border-gray-200 p-4">
                <div className="font-display font-bold text-3xl text-gray-900 leading-none mb-1">{s.value}</div>
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-md inline-flex ${s.color}`}>{s.label}</span>
              </div>
            ))}
          </div>
        )}

        {/* Filters */}
        <div className="bg-white rounded-xl border border-gray-200 p-4 flex flex-wrap gap-3">
          <SearchInput value={search} onChange={setSearch} placeholder="Search OD number, student, event…" className="min-w-[220px]" />
          <select
            value={statusFilter}
            onChange={e => { setStatusFilter(e.target.value); setPage(1); }}
            className="px-3 py-2.5 rounded-lg border border-gray-200 text-sm text-gray-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 bg-white"
          >
            <option value="">All Status</option>
            {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
          </select>
          {isStaff && (
            <Btn size="sm" variant="secondary" onClick={() => navigate('/certificates/pending')}>
              Pending Review
            </Btn>
          )}
        </div>

        {/* Table */}
        {loading ? <LoadingState message="Loading certificates…" /> : error ? (
          <ErrorState message={error} onRetry={() => load(page)} />
        ) : filtered.length === 0 ? (
          <EmptyState title="No certificates found" description="Try adjusting your filters." />
        ) : (
          <SectionCard>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    {[
                      'OD Number',
                      'Event',
                      ...(isStaff ? ['Student'] : []),
                      'Deadline',
                      'Submitted',
                      'Status',
                      'Actions',
                    ].map(col => (
                      <th key={col} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">{col}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filtered.map(cert => (
                    <tr key={cert.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3.5">
                        <button
                          onClick={() => navigate(`/certificates/${cert.id}`)}
                          className="text-indigo-600 font-semibold text-sm hover:underline font-mono"
                        >
                          {cert.od_number}
                        </button>
                      </td>
                      <td className="px-4 py-3.5 text-sm text-gray-900 max-w-[160px] truncate">{cert.event_name}</td>
                      {isStaff && (
                        <td className="px-4 py-3.5">
                          <div className="flex items-center gap-2">
                            <div className="w-6 h-6 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center text-xs font-bold flex-shrink-0">
                              {(cert.student_name || '').split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                            </div>
                            <div>
                              <p className="text-sm font-medium text-gray-900">{cert.student_name}</p>
                              <p className="text-xs text-gray-400 font-mono">{cert.register_number}</p>
                            </div>
                          </div>
                        </td>
                      )}
                      <td className="px-4 py-3.5 text-sm text-gray-500 whitespace-nowrap">
                        {cert.deadline ? cert.deadline.slice(0, 10) : '—'}
                        {cert.is_late && <span className="ml-1 text-xs text-orange-500 font-medium">(Late)</span>}
                      </td>
                      <td className="px-4 py-3.5 text-sm text-gray-500 whitespace-nowrap">
                        {cert.submitted_at ? new Date(cert.submitted_at).toLocaleDateString() : '—'}
                      </td>
                      <td className="px-4 py-3.5">
                        <Badge variant={cert.status} label={cert.status.replace('_', ' ')} />
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => navigate(`/certificates/${cert.id}`)}
                            className="px-2.5 py-1.5 text-xs font-medium text-indigo-600 border border-indigo-200 rounded-md hover:bg-indigo-50 transition-colors"
                          >
                            View
                          </button>
                          {cert.file_name && (
                            <button
                              onClick={() => downloadCert(cert)}
                              className="px-2.5 py-1.5 text-xs font-medium text-gray-600 border border-gray-200 rounded-md hover:bg-gray-50 transition-colors"
                            >
                              Download
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination
              total={pagination.total}
              perPage={pagination.limit}
              page={page}
              onPage={p => { setPage(p); load(p); }}
            />
          </SectionCard>
        )}
      </div>
    </div>
  );
}
