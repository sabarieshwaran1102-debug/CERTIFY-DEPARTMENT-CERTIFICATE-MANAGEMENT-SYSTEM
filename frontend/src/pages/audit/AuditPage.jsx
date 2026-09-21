import { useState, useEffect, useContext, useCallback } from 'react';
import { AuthContext } from '../../context/AuthContext';
import managementService from '../../services/managementService';
import Badge from '../../components/ui/Badge';
import {
  PageHeader, SectionCard, SearchInput, Pagination, Btn,
  LoadingState, EmptyState, Modal
} from '../../components/ui/index';

const ACTION_COLORS = {
  student_created: 'bg-green-50 text-green-700',
  student_updated: 'bg-blue-50 text-blue-700',
  student_deactivated: 'bg-amber-50 text-amber-700',
  student_permanently_deleted: 'bg-red-50 text-red-600',
  advisor_assigned: 'bg-violet-50 text-violet-700',
  advisor_unassigned: 'bg-orange-50 text-orange-700',
  representative_assigned: 'bg-teal-50 text-teal-700',
  representative_removed: 'bg-pink-50 text-pink-700',
  bulk_import: 'bg-indigo-50 text-indigo-700',
  department_created: 'bg-green-50 text-green-700',
  department_updated: 'bg-blue-50 text-blue-700',
  class_created: 'bg-green-50 text-green-700',
  class_updated: 'bg-blue-50 text-blue-700',
  academic_year_created: 'bg-green-50 text-green-700',
  OD_CREATED: 'bg-green-50 text-green-700',
  OD_CANCELLED: 'bg-red-50 text-red-600',
  CERTIFICATE_SUBMITTED: 'bg-blue-50 text-blue-700',
  CERTIFICATE_VERIFIED: 'bg-green-50 text-green-700',
  CERTIFICATE_REJECTED: 'bg-red-50 text-red-600',
  CERTIFICATE_REPLACED: 'bg-amber-50 text-amber-700',
  CERTIFICATE_LATE_APPROVED: 'bg-teal-50 text-teal-700',
  CERTIFICATE_LATE_REJECTED: 'bg-red-50 text-red-600',
};

const ENTITY_LABELS = [
  'student', 'class', 'department', 'academic_year', 'od', 'od_certificate', 'user',
];

const ACTION_LABELS = [
  'student_created', 'student_updated', 'student_deactivated', 'student_permanently_deleted',
  'advisor_assigned', 'advisor_unassigned', 'representative_assigned', 'representative_removed',
  'bulk_import', 'OD_CREATED', 'OD_CANCELLED',
  'CERTIFICATE_SUBMITTED', 'CERTIFICATE_VERIFIED', 'CERTIFICATE_REJECTED',
  'CERTIFICATE_REPLACED', 'CERTIFICATE_LATE_APPROVED', 'CERTIFICATE_LATE_REJECTED',
];

export default function AuditPage() {
  const { user } = useContext(AuthContext);

  const [auditLog, setAuditLog] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ total: 0, limit: 50 });
  const [detail, setDetail] = useState(null);

  // Filters
  const [search, setSearch] = useState('');
  const [actionFilter, setActionFilter] = useState('');
  const [entityFilter, setEntityFilter] = useState('');

  const load = useCallback(async (pg = 1) => {
    setLoading(true);
    try {
      const limit = 50;
      const r = await managementService.getAuditLog({ limit, offset: (pg - 1) * limit });
      setAuditLog(r.data || []);
      setPagination({ total: r.pagination?.total || 0, limit });
      setPage(pg);
    } catch { /* silent */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(1); }, [load]);

  // Client-side filtering on the loaded page
  const filtered = auditLog.filter(e => {
    const matchSearch = !search ||
      (e.actor_username || '').toLowerCase().includes(search.toLowerCase()) ||
      (e.action || '').toLowerCase().includes(search.toLowerCase()) ||
      (e.target_entity || '').toLowerCase().includes(search.toLowerCase()) ||
      (e.target_id || '').toString().includes(search) ||
      (e.details || '').toLowerCase().includes(search.toLowerCase());
    const matchAction = !actionFilter || e.action === actionFilter;
    const matchEntity = !entityFilter || e.target_entity === entityFilter;
    return matchSearch && matchAction && matchEntity;
  });

  // Accessibility: super_admin only
  if (!['super_admin', 'admin'].includes(user?.role)) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <div className="w-14 h-14 rounded-2xl bg-amber-50 flex items-center justify-center mx-auto mb-4">
            <svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="#d97706" strokeWidth="1.8">
              <rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/>
            </svg>
          </div>
          <h2 className="font-display font-bold text-base text-gray-900">Restricted Access</h2>
          <p className="text-sm text-gray-400 mt-1">Audit logs are available to Super Admin and Admin only.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto">
      <PageHeader
        title="Audit Log"
        subtitle={`${pagination.total} total events`}
        action={
          <Btn variant="secondary" size="sm" onClick={() => load(1)} disabled={loading}>
            <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path d="M23 4v6h-6M1 20v-6h6M20.49 9A9 9 0 005.64 5.64L1 10M23 14l-4.64 4.36A9 9 0 013.51 15"/>
            </svg>
            Refresh
          </Btn>
        }
      />

      <div className="p-6 space-y-5">
        {/* Filters */}
        <div className="bg-white rounded-xl border border-gray-200 p-4 flex flex-wrap gap-3 items-center">
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="Search actor, action, entity, details…"
            className="min-w-[250px]"
          />
          <select
            value={actionFilter}
            onChange={e => setActionFilter(e.target.value)}
            className="px-3 py-2.5 rounded-lg border border-gray-200 text-sm text-gray-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 bg-white"
          >
            <option value="">All Actions</option>
            {ACTION_LABELS.map(a => <option key={a} value={a}>{a}</option>)}
          </select>
          <select
            value={entityFilter}
            onChange={e => setEntityFilter(e.target.value)}
            className="px-3 py-2.5 rounded-lg border border-gray-200 text-sm text-gray-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 bg-white"
          >
            <option value="">All Entities</option>
            {ENTITY_LABELS.map(e => <option key={e} value={e}>{e}</option>)}
          </select>
          {(search || actionFilter || entityFilter) && (
            <button
              onClick={() => { setSearch(''); setActionFilter(''); setEntityFilter(''); }}
              className="text-sm text-gray-400 hover:text-gray-700 transition-colors"
            >
              Clear filters
            </button>
          )}
          <span className="ml-auto text-xs text-gray-400">{filtered.length} on this page</span>
        </div>

        {/* Table */}
        {loading ? <LoadingState message="Loading audit log…" /> : (
          <SectionCard>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    {['Timestamp', 'Actor', 'Action', 'Target Entity', 'Target ID', 'Details'].map(col => (
                      <th key={col} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">{col}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filtered.length === 0 ? (
                    <tr><td colSpan={6}>
                      <EmptyState
                        title="No audit events"
                        description="No events match the current filters."
                      />
                    </td></tr>
                  ) : filtered.map(e => (
                    <tr
                      key={e.id}
                      className="hover:bg-gray-50 cursor-pointer transition-colors"
                      onClick={() => setDetail(e)}
                    >
                      <td className="px-4 py-3 text-xs font-mono text-gray-500 whitespace-nowrap">
                        {new Date(e.created_at).toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-sm font-medium text-gray-900">
                        {e.actor_username || <span className="text-gray-400">System</span>}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex px-2 py-0.5 rounded-md text-xs font-semibold whitespace-nowrap ${ACTION_COLORS[e.action] || 'bg-gray-50 text-gray-600'}`}>
                          {e.action}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600 font-medium">
                        {e.target_entity}
                      </td>
                      <td className="px-4 py-3 text-xs font-mono text-gray-400">
                        #{e.target_id}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-400 max-w-[200px] truncate">
                        {e.details || '—'}
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
              onPage={load}
            />
          </SectionCard>
        )}
      </div>

      {/* Detail modal */}
      {detail && (
        <Modal title="Audit Event Detail" onClose={() => setDetail(null)}>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              {[
                { label: 'Timestamp', value: new Date(detail.created_at).toLocaleString() },
                { label: 'Actor', value: detail.actor_username || 'System' },
                { label: 'Action', value: detail.action },
                { label: 'Target Entity', value: detail.target_entity },
                { label: 'Target ID', value: `#${detail.target_id}` },
                { label: 'Details', value: detail.details || '—' },
              ].map(f => (
                <div key={f.label} className="col-span-1">
                  <p className="text-xs text-gray-400 uppercase tracking-wider font-semibold mb-0.5">{f.label}</p>
                  {f.label === 'Action' ? (
                    <span className={`inline-flex px-2 py-0.5 rounded-md text-xs font-semibold ${ACTION_COLORS[detail.action] || 'bg-gray-50 text-gray-600'}`}>{f.value}</span>
                  ) : (
                    <p className="text-sm text-gray-900 font-medium">{f.value}</p>
                  )}
                </div>
              ))}
            </div>

            {detail.new_data && typeof detail.new_data === 'object' && Object.keys(detail.new_data).length > 0 && (
              <div>
                <p className="text-xs text-gray-400 uppercase tracking-wider font-semibold mb-1.5">New Data</p>
                <pre className="text-xs bg-gray-50 border border-gray-200 rounded-lg p-3 overflow-x-auto text-gray-700 max-h-40">
                  {JSON.stringify(detail.new_data, null, 2)}
                </pre>
              </div>
            )}
            {detail.old_data && typeof detail.old_data === 'object' && Object.keys(detail.old_data).length > 0 && (
              <div>
                <p className="text-xs text-gray-400 uppercase tracking-wider font-semibold mb-1.5">Old Data</p>
                <pre className="text-xs bg-gray-50 border border-gray-200 rounded-lg p-3 overflow-x-auto text-gray-700 max-h-40">
                  {JSON.stringify(detail.old_data, null, 2)}
                </pre>
              </div>
            )}
          </div>
        </Modal>
      )}
    </div>
  );
}
