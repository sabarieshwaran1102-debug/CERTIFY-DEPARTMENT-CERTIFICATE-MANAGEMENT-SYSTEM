import { useContext, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import odService from '../services/odService';
import certService from '../services/certService';
import reportService from '../services/reportService';
import userService from '../services/userService';
import { PageHeader, SectionCard, StatCard, Btn, Alert } from '../components/ui/index';
import Badge from '../components/ui/Badge';

export default function FacultyDashboard() {
  const { user } = useContext(AuthContext);
  const navigate = useNavigate();
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const [summary, setSummary] = useState(null);
  const [odRecords, setOdRecords] = useState([]);
  const [certificates, setCertificates] = useState([]);
  const [representatives, setRepresentatives] = useState([]);
  const [repUsername, setRepUsername] = useState('');
  const [repPassword, setRepPassword] = useState('');
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState('');
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');

  const loadData = async () => {
    setLoading(true);
    setError('');
    try {
      const [summaryResult, odResult, certResult, repsResult] = await Promise.all([
        reportService.getMonthlySummary(month),
        odService.getODRecords({ month }),
        certService.getCertificates({ submission_month: month }),
        userService.getRepresentatives(),
      ]);
      setSummary(summaryResult);
      setOdRecords(odResult?.data || []);
      setCertificates(certResult?.data || []);
      setRepresentatives(repsResult?.data || []);
    } catch (e) {
      setError(e?.error || e?.message || 'Unable to load data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, [month]);

  const createRep = async (e) => {
    e.preventDefault();
    try {
      await userService.createRepresentative(repUsername, repPassword);
      setRepUsername(''); setRepPassword('');
      setMsg('Representative account created.');
      loadData();
    } catch (e) { setError(e?.error || 'Failed'); }
  };

  const downloadBlob = (blob, filename) => {
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click(); a.remove();
    window.URL.revokeObjectURL(url);
  };

  const downloadExcel = async () => {
    setWorking('excel');
    try { const r = await reportService.generateExcelReport(month); downloadBlob(r.data, `od-report-${month}.xlsx`); }
    catch (e) { setError(e?.error || 'Download failed'); }
    finally { setWorking(''); }
  };

  const downloadZip = async () => {
    setWorking('zip');
    try { const r = await reportService.downloadCertificatesZip(month); downloadBlob(r.data, `certificates-${month}.zip`); }
    catch (e) { setError(e?.error || 'Download failed'); }
    finally { setWorking(''); }
  };

  return (
    <div className="flex-1 overflow-y-auto">
      <PageHeader
        title="Coordination Dashboard"
        subtitle={`OD & Certificate Management · ${user?.username}`}
        action={
          <div className="flex items-center gap-3">
            <input type="month" value={month} onChange={e => setMonth(e.target.value)}
              className="px-3 py-2.5 rounded-lg border border-gray-200 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600" />
            <Btn variant="secondary" onClick={downloadExcel} disabled={working !== ''}>Download Excel</Btn>
            <Btn variant="secondary" onClick={downloadZip} disabled={working !== ''}>Download ZIP</Btn>
          </div>
        }
      />

      <div className="p-6 space-y-5">
        <Alert type="success" message={msg} onClose={() => setMsg('')} />
        <Alert type="error" message={error} onClose={() => setError('')} />

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <StatCard label="Total OD Records" value={summary?.total_od_records ?? (loading ? '…' : 0)}
            iconColor="text-indigo-600 bg-indigo-50"
            onClick={() => navigate('/ods')}
            icon={<svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8"><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2"/><rect x="9" y="3" width="6" height="4" rx="1"/></svg>} />
          <StatCard label="Certificates Submitted" value={summary?.certificates_submitted ?? (loading ? '…' : 0)}
            iconColor="text-green-600 bg-green-50"
            icon={<svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8"><circle cx="12" cy="8" r="5"/><path d="M8.21 13.89L7 23l5-3 5 3-1.21-9.12"/></svg>} />
          <StatCard label="Certificates Missing" value={summary?.certificates_missing ?? (loading ? '…' : 0)}
            changePositive={false}
            change={summary?.certificates_missing > 0 ? 'Requires attention' : undefined}
            iconColor="text-amber-600 bg-amber-50"
            icon={<svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>} />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* OD Records */}
          <SectionCard title={`OD Records — ${month}`} action={
            <button onClick={() => navigate('/ods')} className="text-xs text-indigo-600 font-medium hover:underline">View all</button>
          }>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead><tr className="bg-gray-50 border-b border-gray-200">
                  {['Registration', 'Student', 'Event', 'Status'].map(c => <th key={c} className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase">{c}</th>)}
                </tr></thead>
                <tbody className="divide-y divide-gray-100">
                  {odRecords.length === 0 ? (
                    <tr><td colSpan={4} className="py-8 text-center text-sm text-gray-400">No OD records for {month}</td></tr>
                  ) : odRecords.slice(0, 6).map(r => (
                    <tr key={r.od_id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-xs font-mono text-indigo-600 font-semibold">{r.registration_number}</td>
                      <td className="px-4 py-3 text-sm text-gray-900">{r.student_id}</td>
                      <td className="px-4 py-3 text-sm text-gray-600 max-w-[120px] truncate">{r.event_details}</td>
                      <td className="px-4 py-3"><Badge variant={(r.od_status || '').toLowerCase()} label={r.od_status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </SectionCard>

          {/* Student Representatives */}
          <SectionCard title="Student Representatives">
            <div className="p-4 border-b border-gray-100">
              <form onSubmit={createRep} className="grid grid-cols-2 gap-3">
                <input value={repUsername} onChange={e => setRepUsername(e.target.value)}
                  placeholder="Username" required
                  className="px-3 py-2.5 rounded-lg border border-gray-200 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition-colors" />
                <input type="password" value={repPassword} onChange={e => setRepPassword(e.target.value)}
                  placeholder="Password (min 8)" minLength="8" required
                  className="px-3 py-2.5 rounded-lg border border-gray-200 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition-colors" />
                <div className="col-span-2"><Btn type="submit" size="sm" className="w-full justify-center">Create Representative</Btn></div>
              </form>
            </div>
            <div className="divide-y divide-gray-100">
              {representatives.length === 0 ? (
                <p className="px-5 py-6 text-center text-sm text-gray-400">No representatives yet.</p>
              ) : representatives.map(r => (
                <div key={r.user_id} className="flex items-center justify-between px-5 py-3">
                  <span className="text-sm text-gray-900">{r.username}</span>
                  <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${r.is_active ? 'text-green-700 bg-green-50' : 'text-gray-400 bg-gray-100'}`}>
                    {r.is_active ? 'Active' : 'Inactive'}
                  </span>
                </div>
              ))}
            </div>
          </SectionCard>
        </div>

        {/* Missing Certificates */}
        {(summary?.missing_records || []).length > 0 && (
          <SectionCard title="Missing Certificates">
            <div className="divide-y divide-gray-100">
              {summary.missing_records.map(r => (
                <div key={r.od_id} className="flex items-center gap-3 px-5 py-3.5">
                  <div className="w-2 h-2 rounded-full bg-amber-400 flex-shrink-0" />
                  <div>
                    <p className="text-sm font-semibold text-gray-900">{r.registration_number}</p>
                    <p className="text-xs text-gray-400">{r.register_number} — {r.student_name}</p>
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
