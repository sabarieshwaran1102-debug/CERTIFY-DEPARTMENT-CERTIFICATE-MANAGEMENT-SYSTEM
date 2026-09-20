import { useState, useEffect, useContext, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthContext } from '../../context/AuthContext';
import odsService from '../../services/odsService';
import Badge from '../../components/ui/Badge';
import { LoadingState, EmptyState, ErrorState, PageHeader, SectionCard, SearchInput, Pagination, Btn, StatCard } from '../../components/ui/index';

const EVENT_TYPES = ['Conference', 'Workshop', 'Competition', 'Internship', 'Symposium', 'Other'];

export default function ODRecordsPage() {
  const { user } = useContext(AuthContext);
  const navigate = useNavigate();

  const [ods, setOds] = useState([]);
  const [pagination, setPagination] = useState({ total: 0, limit: 25, offset: 0 });
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Filters
  const [search, setSearch] = useState('');
  const [eventType, setEventType] = useState('');
  const [status, setStatus] = useState('');
  const [dateFrom, setDateFrom] = useState('');

  const canCreate = ['super_admin', 'admin', 'coordinating_faculty', 'class_advisor', 'class_representative'].includes(user?.role);
  const isGlobal = ['super_admin', 'admin'].includes(user?.role);

  const load = useCallback(async (pg = 1) => {
    setLoading(true);
    setError('');
    try {
      const limit = 25;
      const offset = (pg - 1) * limit;
      const params = { limit, offset };
      if (search) params.od_number = search.startsWith('OD-') ? search : undefined;
      if (search && !search.startsWith('OD-')) params.event_name = search;
      if (eventType) params.event_type = eventType.toLowerCase();
      if (status) params.status = status.toLowerCase();
      if (dateFrom) params.event_date_from = dateFrom;
      const result = await odsService.getODs(params);
      setOds(result.data || []);
      setPagination(result.pagination || { total: 0, limit: 25, offset });
    } catch (e) {
      setError(e?.response?.data?.error || e?.error || 'Failed to load OD records');
    } finally {
      setLoading(false);
    }
  }, [search, eventType, status, dateFrom]);

  useEffect(() => { load(page); }, [page, load]);

  const handleSearch = () => { setPage(1); load(1); };

  const activeCount = ods.filter(o => o.status === 'active').length;
  const cancelledCount = ods.filter(o => o.status === 'cancelled').length;

  return (
    <div className="flex-1 overflow-y-auto">
      {/* Header */}
      <PageHeader
        title="On-Duty Records"
        subtitle="Create, track and manage student On-Duty records"
        action={canCreate && (
          <Btn onClick={() => navigate('/ods/create')}>
            <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
              <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
            Create OD
          </Btn>
        )}
      />

      <div className="p-6 space-y-5">
        {/* Summary */}
        {!loading && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              label="Total ODs"
              value={pagination.total}
              iconColor="text-indigo-600 bg-indigo-50"
              icon={<svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8"><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2"/><rect x="9" y="3" width="6" height="4" rx="1"/></svg>}
            />
            <StatCard
              label="Active ODs"
              value={activeCount}
              iconColor="text-green-600 bg-green-50"
              icon={<svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>}
            />
            <StatCard
              label="Cancelled"
              value={cancelledCount}
              iconColor="text-red-600 bg-red-50"
              icon={<svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>}
            />
            <StatCard
              label="This Page"
              value={ods.length}
              iconColor="text-blue-600 bg-blue-50"
              icon={<svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>}
            />
          </div>
        )}

        {/* Filters */}
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex flex-wrap gap-3 items-center">
            <SearchInput
              value={search}
              onChange={setSearch}
              placeholder="Search OD number or event name…"
              className="min-w-[220px]"
            />
            <select
              value={eventType}
              onChange={e => setEventType(e.target.value)}
              className="px-3 py-2.5 rounded-lg border border-gray-200 text-sm text-gray-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 bg-white"
            >
              <option value="">All Event Types</option>
              {EVENT_TYPES.map(t => <option key={t}>{t}</option>)}
            </select>
            <select
              value={status}
              onChange={e => setStatus(e.target.value)}
              className="px-3 py-2.5 rounded-lg border border-gray-200 text-sm text-gray-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 bg-white"
            >
              <option value="">All Status</option>
              <option value="active">Active</option>
              <option value="cancelled">Cancelled</option>
            </select>
            <input
              type="date"
              value={dateFrom}
              onChange={e => setDateFrom(e.target.value)}
              className="px-3 py-2.5 rounded-lg border border-gray-200 text-sm text-gray-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 bg-white"
            />
            <Btn onClick={handleSearch}>Search</Btn>
            <button
              onClick={() => { setSearch(''); setEventType(''); setStatus(''); setDateFrom(''); setPage(1); }}
              className="px-4 py-2.5 text-sm text-gray-500 hover:text-gray-900 font-medium border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Reset
            </button>
          </div>
        </div>

        {/* Table */}
        {loading ? (
          <LoadingState message="Loading OD records…" />
        ) : error ? (
          <ErrorState message={error} onRetry={() => load(page)} />
        ) : (
          <SectionCard>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50">
                    {['OD Number', 'Event', 'Type', 'Event Date', 'Participants', isGlobal && 'Class', 'Status', 'Actions'].filter(Boolean).map(col => (
                      <th key={col} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {ods.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-12 text-center text-gray-400 text-sm">
                        No OD records found. {canCreate && <button onClick={() => navigate('/ods/create')} className="text-indigo-600 hover:underline ml-1">Create one?</button>}
                      </td>
                    </tr>
                  ) : ods.map(od => (
                    <tr key={od.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3.5">
                        <button onClick={() => navigate(`/ods/${od.id}`)} className="text-indigo-600 font-semibold text-sm hover:underline font-mono">
                          {od.od_number}
                        </button>
                      </td>
                      <td className="px-4 py-3.5 text-sm font-medium text-gray-900 max-w-[180px] truncate">{od.event_name}</td>
                      <td className="px-4 py-3.5">
                        <Badge variant={(od.event_type || '').toLowerCase()} label={od.event_type} />
                      </td>
                      <td className="px-4 py-3.5 text-sm text-gray-500 whitespace-nowrap">
                        {od.event_date ? od.event_date.slice(0, 10) : '—'}
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-1.5">
                          <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="#9ca3af" strokeWidth="2">
                            <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/>
                            <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/>
                          </svg>
                          <span className="text-sm text-gray-500">{Array.isArray(od.participants) ? od.participants.length : '—'}</span>
                        </div>
                      </td>
                      {isGlobal && (
                        <td className="px-4 py-3.5 text-sm text-gray-500 whitespace-nowrap">{od.class_name || '—'}</td>
                      )}
                      <td className="px-4 py-3.5">
                        <Badge variant={od.status} />
                      </td>
                      <td className="px-4 py-3.5">
                        <button
                          onClick={() => navigate(`/ods/${od.id}`)}
                          className="px-3 py-1.5 text-xs font-medium text-indigo-600 border border-indigo-200 rounded-md hover:bg-indigo-50 transition-colors"
                        >
                          View
                        </button>
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
