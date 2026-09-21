import { useState, useEffect, useContext } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { AuthContext } from '../../context/AuthContext';
import odCertService from '../../services/odCertService';
import Badge from '../../components/ui/Badge';
import { LoadingState, ErrorState, PageHeader, SectionCard, Btn, ConfirmModal } from '../../components/ui/index';

const STAFF_ROLES = ['super_admin', 'admin', 'coordinating_faculty', 'class_advisor'];

export default function CertificateDetailPage() {
  const { id } = useParams();
  const { user } = useContext(AuthContext);
  const navigate = useNavigate();
  const isStaff = STAFF_ROLES.includes(user?.role);

  const [cert, setCert] = useState(null);
  const [versions, setVersions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionLoading, setActionLoading] = useState('');
  const [actionError, setActionError] = useState('');
  const [rejectModal, setRejectModal] = useState(null); // 'reject' | 'reject-late'
  const [rejectReason, setRejectReason] = useState('');
  const [lateModal, setLateModal] = useState(false);

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const [c, v] = await Promise.all([
        odCertService.getById(id),
        odCertService.getVersions(id).catch(() => ({ data: [], current_version: 1 })),
      ]);
      setCert(c);
      setVersions(v.data || []);
    } catch (e) {
      setError(e?.response?.data?.error || e?.error || 'Failed to load certificate');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [id]);

  const doAction = async (action, ...args) => {
    setActionLoading(action);
    setActionError('');
    try {
      switch (action) {
        case 'verify':      await odCertService.verify(id); break;
        case 'reject':      await odCertService.reject(id, args[0]); break;
        case 'approve-late': await odCertService.approveLate(id); break;
        case 'reject-late': await odCertService.rejectLate(id, args[0]); break;
      }
      await load();
      setRejectModal(null);
      setRejectReason('');
      setLateModal(false);
    } catch (e) {
      setActionError(e?.response?.data?.error || e?.error || 'Action failed');
    } finally {
      setActionLoading('');
    }
  };

  const downloadCert = async () => {
    try {
      const blob = await odCertService.download(id);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = cert.file_name;
      document.body.appendChild(a); a.click(); a.remove();
      window.URL.revokeObjectURL(url);
    } catch (e) { setActionError('Download failed'); }
  };

  if (loading) return <LoadingState message="Loading certificate…" />;
  if (error)   return <div className="p-6"><ErrorState message={error} onRetry={load} /></div>;
  if (!cert)   return null;

  const canReplace = ['submitted', 'rejected', 'overdue'].includes(cert.status) && user?.role === 'student';
  const canVerify  = isStaff && cert.status === 'submitted';
  const canReject  = isStaff && ['submitted', 'late_submitted'].includes(cert.status);
  const canApproveLate = isStaff && cert.status === 'late_submitted';

  const infoFields = [
    { label: 'OD Number',    value: cert.od_number },
    { label: 'Event',        value: cert.event_name },
    { label: 'Event Date',   value: cert.event_date ? cert.event_date.slice(0, 10) : '—' },
    { label: 'Student',      value: cert.student_name },
    { label: 'Register No.', value: cert.register_number },
    { label: 'Class',        value: cert.class_name },
    { label: 'File',         value: cert.file_name },
    { label: 'Version',      value: `v${cert.version}` },
    { label: 'Deadline',     value: cert.deadline ? cert.deadline.slice(0, 10) : '—' },
    { label: 'Submitted',    value: cert.submitted_at ? new Date(cert.submitted_at).toLocaleString() : '—' },
    { label: 'Submitted By', value: cert.submitted_by_username },
    { label: 'Status',       value: null },
    ...(cert.verified_at ? [{ label: 'Verified', value: `${cert.verified_by_username} · ${new Date(cert.verified_at).toLocaleDateString()}` }] : []),
    ...(cert.rejected_at ? [{ label: 'Rejected', value: `${cert.rejected_by_username} · ${new Date(cert.rejected_at).toLocaleDateString()}` }] : []),
  ];

  return (
    <div className="flex-1 overflow-y-auto">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-[#f5f6fa] border-b border-gray-200 px-6 py-4 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/certificates')} className="w-8 h-8 flex items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-500 hover:bg-gray-50 transition-colors">
            <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6"/></svg>
          </button>
          <div className="flex items-center gap-2.5">
            <h1 className="font-display font-bold text-xl text-gray-900">{cert.od_number}</h1>
            <Badge variant={cert.status} label={cert.status.replace('_', ' ')} />
            {cert.is_late && <Badge variant="overdue" label="Late" />}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {cert.file_name && <Btn variant="secondary" onClick={downloadCert}>Download</Btn>}
          {canReplace && (
            <Btn variant="secondary" onClick={() => navigate(`/certificates/upload?od_id=${cert.od_id}&replace=true`)}>
              Replace
            </Btn>
          )}
          {canApproveLate && (
            <Btn onClick={() => setLateModal(true)} disabled={!!actionLoading}>
              {actionLoading === 'approve-late' ? 'Approving…' : 'Approve Late'}
            </Btn>
          )}
          {canVerify && (
            <Btn onClick={() => doAction('verify')} disabled={!!actionLoading}>
              {actionLoading === 'verify' ? 'Verifying…' : 'Verify'}
            </Btn>
          )}
          {canReject && (
            <Btn variant="danger" onClick={() => setRejectModal(cert.status === 'late_submitted' ? 'reject-late' : 'reject')} disabled={!!actionLoading}>
              Reject
            </Btn>
          )}
        </div>
      </div>

      {actionError && (
        <div className="mx-6 mt-4 bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">{actionError}</div>
      )}

      <div className="p-6 grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Left */}
        <div className="lg:col-span-2 space-y-5">
          <SectionCard title="Certificate Information">
            <div className="p-5 grid grid-cols-2 gap-x-8 gap-y-4">
              {infoFields.map(f => (
                <div key={f.label}>
                  <p className="text-xs text-gray-400 font-semibold uppercase tracking-wider mb-0.5">{f.label}</p>
                  {f.value === null
                    ? <Badge variant={cert.status} label={cert.status.replace('_', ' ')} />
                    : <p className="text-sm text-gray-900 font-medium">{f.value}</p>
                  }
                </div>
              ))}
            </div>
          </SectionCard>

          {cert.rejection_reason && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4">
              <p className="text-xs font-semibold text-red-600 uppercase tracking-wider mb-1">Rejection Reason</p>
              <p className="text-sm text-red-800">{cert.rejection_reason}</p>
            </div>
          )}

          {cert.is_late && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-2">
              <p className="text-xs font-semibold text-amber-700 uppercase tracking-wider">Late Submission</p>
              {cert.late_reason && <p className="text-sm text-amber-800"><strong>Student reason:</strong> {cert.late_reason}</p>}
              {cert.late_approved_at && (
                <p className="text-sm text-green-700">
                  Approved by {cert.late_approved_by_username} on {new Date(cert.late_approved_at).toLocaleDateString()}
                </p>
              )}
              {cert.late_rejected_at && (
                <p className="text-sm text-red-700">
                  Rejected by {cert.late_rejected_by_username} on {new Date(cert.late_rejected_at).toLocaleDateString()}
                </p>
              )}
            </div>
          )}

          {/* Version History */}
          {versions.length > 0 && (
            <SectionCard title="Version History">
              <div className="divide-y divide-gray-100">
                {versions.map(v => (
                  <div key={v.id} className="flex items-center gap-3 px-5 py-3.5">
                    <div className="w-7 h-7 rounded-lg bg-gray-100 flex items-center justify-center text-xs font-bold text-gray-600 flex-shrink-0">
                      v{v.version}
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-900">{v.file_name}</p>
                      <p className="text-xs text-gray-400">
                        Replaced {new Date(v.replaced_at).toLocaleDateString()} · by {v.replaced_by_username}
                      </p>
                    </div>
                    <Badge variant="cancelled" label="Superseded" />
                  </div>
                ))}
              </div>
            </SectionCard>
          )}
        </div>

        {/* Right */}
        <div className="space-y-5">
          <SectionCard title="Quick Actions">
            <div className="p-4 space-y-2">
              <button onClick={() => navigate(`/ods/${cert.od_id}`)} className="w-full text-left px-3 py-2 rounded-lg text-sm text-gray-700 hover:bg-indigo-50 hover:text-indigo-600 transition-colors font-medium flex items-center gap-2">
                <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><polyline points="9 18 15 12 9 6"/></svg>
                View OD Record
              </button>
              {cert.file_name && (
                <button onClick={downloadCert} className="w-full text-left px-3 py-2 rounded-lg text-sm text-gray-700 hover:bg-indigo-50 hover:text-indigo-600 transition-colors font-medium flex items-center gap-2">
                  <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                  Download Certificate
                </button>
              )}
            </div>
          </SectionCard>
        </div>
      </div>

      {/* Reject modal */}
      {rejectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setRejectModal(null)} />
          <div className="relative bg-white rounded-2xl border border-gray-200 shadow-2xl w-full max-w-md mx-4 overflow-hidden">
            <div className="h-1 bg-red-500 w-full" />
            <div className="p-6 space-y-4">
              <h2 className="font-display font-bold text-base text-gray-900">
                {rejectModal === 'reject-late' ? 'Reject Late Submission' : 'Reject Certificate'}
              </h2>
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1.5">Reason <span className="text-red-500">*</span></label>
                <textarea
                  value={rejectReason}
                  onChange={e => setRejectReason(e.target.value)}
                  rows={3}
                  placeholder="Enter reason for rejection…"
                  className="w-full px-3 py-2.5 rounded-lg border border-gray-200 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-red-400/30 focus:border-red-400 resize-none transition-colors"
                />
              </div>
              <div className="flex gap-3">
                <button onClick={() => { setRejectModal(null); setRejectReason(''); }} className="flex-1 py-2.5 text-sm font-semibold text-gray-700 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
                  Cancel
                </button>
                <button
                  onClick={() => doAction(rejectModal, rejectReason)}
                  disabled={!rejectReason.trim() || !!actionLoading}
                  className="flex-1 py-2.5 text-sm font-semibold bg-red-600 hover:bg-red-700 text-white rounded-lg shadow-sm transition-colors disabled:opacity-40"
                >
                  {actionLoading === rejectModal ? 'Rejecting…' : 'Confirm Reject'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Approve late confirmation */}
      {lateModal && (
        <ConfirmModal
          title="Approve Late Submission"
          message={`Approve the late certificate submission from ${cert.student_name}?${cert.late_reason ? `\n\nStudent reason: "${cert.late_reason}"` : ''}`}
          confirmLabel="Approve"
          onClose={() => setLateModal(false)}
          onConfirm={() => doAction('approve-late')}
        />
      )}
    </div>
  );
}
