import { useContext, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import studentService from '../services/studentService';
import certService from '../services/certService';
import { LoadingState, PageHeader, SectionCard, StatCard, Btn } from '../components/ui/index';
import Badge from '../components/ui/Badge';

export default function StudentDashboard() {
  const { user } = useContext(AuthContext);
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [odRecords, setOdRecords] = useState([]);
  const [certificates, setCertificates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [certForm, setCertForm] = useState({ registration_number: '', file: null });
  const [submitting, setSubmitting] = useState(false);
  const [certMsg, setCertMsg] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const [p, od, cert] = await Promise.all([
          studentService.getMyInfo(),
          studentService.getMyODRecords(),
          studentService.getMyCertificates(),
        ]);
        setProfile(p);
        setOdRecords(od?.data || []);
        setCertificates(cert?.data || []);
      } catch (e) {
        setError(e?.error || e?.message || 'Unable to load data');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const handleCertSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setCertMsg('');
    try {
      await certService.submitCertificate(certForm.registration_number, certForm.file);
      setCertMsg('Certificate submitted successfully.');
      setCertForm({ registration_number: '', file: null });
    } catch (e) {
      setCertMsg(e?.error || e?.message || 'Submission failed');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <LoadingState message="Loading your dashboard…" />;

  const totalODs = odRecords.length;
  const activeODs = odRecords.filter(o => o.od_status === 'active').length;
  const submittedCerts = certificates.length;

  return (
    <div className="flex-1 overflow-y-auto">
      <PageHeader
        title="My Dashboard"
        subtitle={profile ? `${profile.register_number} · ${profile.department} · ${profile.year}/${profile.section}` : user?.username}
      />

      {error && (
        <div className="mx-6 mt-4 bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">{error}</div>
      )}

      <div className="p-6 space-y-5">
        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
          <StatCard label="Total ODs" value={totalODs} onClick={() => navigate('/ods')}
            iconColor="text-indigo-600 bg-indigo-50"
            icon={<svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8"><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2"/><rect x="9" y="3" width="6" height="4" rx="1"/></svg>} />
          <StatCard label="Active ODs" value={activeODs} onClick={() => navigate('/ods')}
            iconColor="text-green-600 bg-green-50"
            icon={<svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>} />
          <StatCard label="Certificates" value={submittedCerts}
            iconColor="text-blue-600 bg-blue-50"
            icon={<svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8"><circle cx="12" cy="8" r="5"/><path d="M8.21 13.89L7 23l5-3 5 3-1.21-9.12"/></svg>} />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* My ODs */}
          <SectionCard title="My On-Duty Records" action={
            <button onClick={() => navigate('/ods')} className="text-xs text-indigo-600 font-medium hover:underline">View all</button>
          }>
            <div className="divide-y divide-gray-100">
              {odRecords.length === 0 ? (
                <p className="px-5 py-8 text-center text-sm text-gray-400">No OD records yet.</p>
              ) : odRecords.slice(0, 5).map(od => (
                <div key={od.od_id} className="flex items-center justify-between px-5 py-3.5">
                  <div>
                    <p className="text-sm font-semibold text-indigo-600 font-mono">{od.registration_number}</p>
                    <p className="text-xs text-gray-500 mt-0.5 truncate max-w-[180px]">{od.event_details}</p>
                  </div>
                  <Badge variant={(od.od_status || '').toLowerCase()} label={od.od_status} />
                </div>
              ))}
            </div>
          </SectionCard>

          {/* Submit Certificate */}
          <SectionCard title="Submit Certificate">
            <div className="p-5">
              {certMsg && (
                <div className={`mb-4 text-sm px-3 py-2.5 rounded-lg border ${certMsg.includes('success') ? 'bg-green-50 border-green-200 text-green-700' : 'bg-red-50 border-red-200 text-red-700'}`}>
                  {certMsg}
                </div>
              )}
              <form onSubmit={handleCertSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1.5">OD Registration Number</label>
                  <input type="text" value={certForm.registration_number}
                    onChange={e => setCertForm(f => ({ ...f, registration_number: e.target.value }))}
                    placeholder="OD-2026-000001"
                    required className="w-full px-3 py-2.5 rounded-lg border border-gray-200 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition-colors font-mono" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1.5">Certificate File</label>
                  <input type="file" accept=".pdf,.jpg,.jpeg,.png" required
                    onChange={e => setCertForm(f => ({ ...f, file: e.target.files[0] }))}
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm text-gray-900 file:mr-3 file:py-1 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100" />
                </div>
                <Btn type="submit" disabled={submitting} className="w-full justify-center">
                  {submitting ? 'Submitting…' : 'Submit Certificate'}
                </Btn>
              </form>
            </div>
          </SectionCard>
        </div>

        {/* Certificate History */}
        {certificates.length > 0 && (
          <SectionCard title="Certificate History">
            <div className="divide-y divide-gray-100">
              {certificates.map(cert => (
                <div key={cert.certificate_id} className="flex items-center justify-between px-5 py-3.5">
                  <div>
                    <p className="text-sm font-semibold text-gray-900">{cert.file_name}</p>
                    <p className="text-xs text-gray-400 mt-0.5">Submitted: {cert.submitted_at ? new Date(cert.submitted_at).toLocaleDateString() : '—'}</p>
                  </div>
                  <button onClick={async () => {
                    try {
                      const blob = await certService.downloadCertificate(cert.certificate_id);
                      const url = window.URL.createObjectURL(blob);
                      const a = document.createElement('a');
                      a.href = url; a.download = cert.file_name;
                      document.body.appendChild(a); a.click(); a.remove();
                      window.URL.revokeObjectURL(url);
                    } catch {}
                  }} className="px-3 py-1.5 text-xs font-medium text-indigo-600 border border-indigo-200 rounded-md hover:bg-indigo-50 transition-colors">
                    Download
                  </button>
                </div>
              ))}
            </div>
          </SectionCard>
        )}
      </div>
    </div>
  );
}
