import { useState, useEffect, useContext } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { AuthContext } from '../../context/AuthContext';
import odsService from '../../services/odsService';
import Badge from '../../components/ui/Badge';
import CancelModal from '../../components/ui/CancelModal';
import { LoadingState, ErrorState, PageHeader, SectionCard, Btn } from '../../components/ui/index';

const CAN_CANCEL = ['super_admin', 'admin', 'coordinating_faculty', 'class_advisor'];

export default function ODDetailsPage() {
  const { id } = useParams();
  const { user } = useContext(AuthContext);
  const navigate = useNavigate();

  const [od, setOd] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [cancelError, setCancelError] = useState('');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await odsService.getOD(id);
      setOd(data);
    } catch (e) {
      setError(e?.response?.data?.error || e?.error || 'Failed to load OD record');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [id]);

  const handleCancel = async (reason) => {
    setCancelling(true);
    setCancelError('');
    try {
      await odsService.cancelOD(id, reason);
      setCancelOpen(false);
      await load();
    } catch (e) {
      setCancelError(e?.response?.data?.error || e?.error || 'Failed to cancel OD');
    } finally {
      setCancelling(false);
    }
  };

  const canCancel = CAN_CANCEL.includes(user?.role) && od?.status === 'active';

  if (loading) return <LoadingState message="Loading OD record…" />;
  if (error) return <div className="p-6"><ErrorState message={error} onRetry={load} /></div>;
  if (!od) return null;

  const infoFields = [
    { label: 'OD Number', value: od.od_number },
    { label: 'Event Type', value: od.event_type },
    { label: 'Event Date', value: od.event_date ? od.event_date.slice(0,10) : '—' },
    { label: 'OD Start Date', value: od.od_start_date ? od.od_start_date.slice(0,10) : '—' },
    { label: 'OD End Date', value: od.od_end_date ? od.od_end_date.slice(0,10) : '—' },
    { label: 'Department', value: od.department_name },
    { label: 'Academic Year', value: od.academic_year_name },
    { label: 'Class', value: od.class_name },
    { label: 'Created By', value: od.created_by_username },
    { label: 'Created At', value: od.created_at ? new Date(od.created_at).toLocaleString() : '—' },
  ];

  return (
    <div className="flex-1 overflow-y-auto">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-[#f5f6fa] border-b border-gray-200 px-6 py-4 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/ods')}
            className="w-8 h-8 flex items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-500 hover:text-gray-900 hover:bg-gray-50 transition-colors"
          >
            <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6"/></svg>
          </button>
          <div className="flex items-center gap-2.5">
            <h1 className="font-display font-bold text-xl text-gray-900">{od.od_number}</h1>
            <Badge variant={od.status} />
          </div>
        </div>
        {canCancel && (
          <button
            onClick={() => setCancelOpen(true)}
            className="px-4 py-2.5 text-sm font-semibold text-red-600 border border-red-200 rounded-lg hover:bg-red-50 transition-colors"
          >
            Cancel OD
          </button>
        )}
        {od.status === 'cancelled' && od.cancelled_by_username && (
          <span className="text-xs text-gray-400">Cancelled by {od.cancelled_by_username}</span>
        )}
      </div>

      {cancelError && (
        <div className="mx-6 mt-4 bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">
          {cancelError}
        </div>
      )}

      <div className="p-6 grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Left column */}
        <div className="lg:col-span-2 space-y-5">
          {/* Event header */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-xl bg-indigo-50 flex items-center justify-center flex-shrink-0">
                <svg width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="#4f46e5" strokeWidth="1.7">
                  <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/>
                  <line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
                </svg>
              </div>
              <div>
                <h2 className="font-display font-bold text-lg text-gray-900">{od.event_name}</h2>
                <div className="flex items-center flex-wrap gap-2 mt-1.5">
                  <Badge variant={(od.event_type || '').toLowerCase()} label={od.event_type} />
                  <span className="text-xs text-gray-400">·</span>
                  <span className="text-sm text-gray-500">{od.event_date ? od.event_date.slice(0,10) : '—'}</span>
                  {od.venue && <><span className="text-xs text-gray-400">·</span><span className="text-sm text-gray-500">{od.venue}</span></>}
                </div>
              </div>
            </div>
          </div>

          {/* OD Information */}
          <SectionCard title="OD Information">
            <div className="p-5 grid grid-cols-2 gap-x-8 gap-y-4">
              {infoFields.map(f => (
                <div key={f.label}>
                  <p className="text-xs text-gray-400 font-semibold uppercase tracking-wider mb-0.5">{f.label}</p>
                  <p className="text-sm text-gray-900 font-medium">{f.value || '—'}</p>
                </div>
              ))}
              <div className="col-span-2">
                <p className="text-xs text-gray-400 font-semibold uppercase tracking-wider mb-0.5">Purpose</p>
                <p className="text-sm text-gray-700 leading-relaxed">{od.purpose || '—'}</p>
              </div>
              {od.cancellation_reason && (
                <div className="col-span-2">
                  <p className="text-xs text-red-400 font-semibold uppercase tracking-wider mb-0.5">Cancellation Reason</p>
                  <p className="text-sm text-red-700 leading-relaxed">{od.cancellation_reason}</p>
                </div>
              )}
            </div>
          </SectionCard>

          {/* Participants */}
          <SectionCard
            title={
              <span>
                Participants
                <span className="ml-2 inline-flex items-center justify-center w-5 h-5 rounded-full bg-indigo-50 text-indigo-600 text-xs font-bold">
                  {Array.isArray(od.participants) ? od.participants.length : 0}
                </span>
              </span>
            }
          >
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    {['Register Number', 'Student Name', 'Status', 'Certificate'].map(c => (
                      <th key={c} className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">{c}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {(od.participants || []).length === 0 ? (
                    <tr><td colSpan={4} className="px-4 py-8 text-center text-sm text-gray-400">No participants</td></tr>
                  ) : (od.participants || []).map(p => (
                    <tr key={p.student_id || p.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm font-mono text-indigo-600 font-medium">{p.register_number}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center text-xs font-bold flex-shrink-0">
                            {(p.name || '').split(' ').map(n => n[0]).join('').slice(0,2).toUpperCase()}
                          </div>
                          <span className="text-sm text-gray-900 font-medium">{p.name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3"><Badge variant={(p.status || '').toLowerCase()} label={p.status} /></td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => navigate('/certificates/upload?od_id=' + od.id)}
                          className="px-2.5 py-1.5 text-xs font-medium text-indigo-600 border border-indigo-200 rounded-md hover:bg-indigo-50 transition-colors"
                        >
                          Upload
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </SectionCard>
        </div>

        {/* Right column */}
        <div className="space-y-5">
          <SectionCard title="Summary">
            <div className="p-4 space-y-3 text-sm">
              {od.status === 'active' && (
                <button
                  onClick={() => navigate('/certificates?od_id=' + od.id)}
                  className="w-full text-left px-3 py-2 rounded-lg text-sm text-gray-700 hover:bg-indigo-50 hover:text-indigo-600 transition-colors font-medium flex items-center gap-2"
                >
                  <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="8" r="5"/><path d="M8.21 13.89L7 23l5-3 5 3-1.21-9.12"/></svg>
                  View Certificates
                </button>
              )}
              <div className="flex justify-between"><span className="text-gray-500">Status</span><Badge variant={od.status} /></div>
              <div className="flex justify-between"><span className="text-gray-500">Participants</span><span className="font-semibold text-gray-900">{Array.isArray(od.participants) ? od.participants.length : '—'}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Class</span><span className="font-medium text-gray-900 text-right ml-2">{od.class_name || '—'}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Department</span><span className="font-medium text-gray-900 text-right ml-2">{od.department_name || '—'}</span></div>
            </div>
          </SectionCard>
        </div>
      </div>

      {cancelOpen && (
        <CancelModal
          odNumber={od.od_number}
          eventName={od.event_name}
          onClose={() => setCancelOpen(false)}
          onConfirm={handleCancel}
          loading={cancelling}
        />
      )}
    </div>
  );
}
