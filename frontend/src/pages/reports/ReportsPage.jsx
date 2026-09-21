import { useState, useContext, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthContext } from '../../context/AuthContext';
import reportService from '../../services/reportService';
import odsService from '../../services/odsService';
import odCertService from '../../services/odCertService';
import managementService from '../../services/managementService';
import Badge from '../../components/ui/Badge';
import {
  PageHeader, SectionCard, Field, Input, Select, Btn,
  LoadingState, ErrorState, EmptyState, Pagination, SearchInput
} from '../../components/ui/index';

const REPORT_TYPES = [
  { id: 'monthly-od',     label: 'Monthly OD Report',         desc: 'All OD records for a given month',           icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2" /><rect x="9" y="3" width="6" height="4" rx="1"/><line x1="9" y1="12" x2="15" y2="12"/><line x1="9" y1="16" x2="13" y2="16' },
  { id: 'certificate',    label: 'Certificate Status Report',  desc: 'Certificate submission status by student',    icon: 'M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138' },
  { id: 'pending-cert',   label: 'Pending Certificates',       desc: 'Certificates awaiting submission or review',  icon: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z' },
  { id: 'overdue-cert',   label: 'Overdue Certificates',       desc: 'Students with past-deadline submissions',     icon: 'M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z' },
  { id: 'class-wise',     label: 'Class-Wise OD Report',       desc: 'OD records for a specific class',             icon: 'M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4' },
  { id: 'student-history',label: 'Student OD History',          desc: 'Complete OD record for a student',            icon: 'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z' },
  { id: 'department',     label: 'Department-Wise Report',     desc: 'OD & certificate overview by department',     icon: 'M3 21h18M9 21V10.5M15 21V10.5M5 10.5l7-7 7 7' },
];

function downloadBlob(blob, filename) {
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  window.URL.revokeObjectURL(url);
}

export default function ReportsPage() {
  const { user } = useContext(AuthContext);
  const navigate = useNavigate();
  const isAdmin = ['super_admin', 'admin'].includes(user?.role);
  const isFaculty = user?.role === 'coordinating_faculty';
  const canExcel = isFaculty;

  const [selected, setSelected] = useState('monthly-od');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [results, setResults] = useState(null);
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ total: 0, limit: 25 });

  // Filter state
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const [department, setDepartment] = useState('');
  const [classId, setClassId] = useState('');
  const [studentSearch, setStudentSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  // Org data for filters
  const [classes, setClasses] = useState([]);
  const [departments, setDepartments] = useState([]);

  useEffect(() => {
    managementService.getClasses().then(r => setClasses(r.data || [])).catch(() => {});
    managementService.getDepartments().then(r => setDepartments(r.data || [])).catch(() => {});
  }, []);

  // Reset results when report type changes
  useEffect(() => {
    setResults(null);
    setError('');
    setPage(1);
  }, [selected]);

  const generate = async (pg = 1) => {
    setLoading(true);
    setError('');
    try {
      const limit = 25;
      const offset = (pg - 1) * limit;
      let data = null;

      if (selected === 'monthly-od') {
        const r = await reportService.getMonthlySummary(month, {
          ...(department && { department }),
        });
        data = { type: 'monthly-od', summary: r.data, records: r.data?.records || [] };
      }

      else if (selected === 'certificate') {
        const params = { limit, offset };
        if (classId) params.class_id = classId;
        if (statusFilter) params.status = statusFilter;
        const r = await odCertService.getAll(params);
        data = { type: 'certificate', rows: r.data || [], total: r.pagination?.total || 0 };
        setPagination({ total: r.pagination?.total || 0, limit });
      }

      else if (selected === 'pending-cert') {
        const r = await odCertService.getPending({ include_late: 'true', limit, offset });
        data = { type: 'pending-cert', rows: r.data || [], total: r.pagination?.total || 0 };
        setPagination({ total: r.pagination?.total || 0, limit });
      }

      else if (selected === 'overdue-cert') {
        const params = { status: 'overdue', limit, offset };
        if (classId) params.class_id = classId;
        const r = await odCertService.getAll(params);
        data = { type: 'overdue-cert', rows: r.data || [], total: r.pagination?.total || 0 };
        setPagination({ total: r.pagination?.total || 0, limit });
      }

      else if (selected === 'class-wise') {
        const params = { limit, offset };
        if (classId) params.class_id = classId;
        if (dateFrom) params.event_date_from = dateFrom;
        if (dateTo) params.event_date_to = dateTo;
        const r = await odsService.getODs(params);
        data = { type: 'class-wise', rows: r.data || [], total: r.pagination?.total || 0 };
        setPagination({ total: r.pagination?.total || 0, limit });
      }

      else if (selected === 'student-history') {
        if (!studentSearch.trim()) { setError('Enter a student register number or name.'); setLoading(false); return; }
        const params = { limit, offset };
        if (studentSearch.startsWith('OD-') || /^\d/.test(studentSearch)) {
          params.student_register = studentSearch;
        } else {
          params.student_name = studentSearch;
        }
        if (classId) params.class_id = classId;
        const r = await odsService.getODs(params);
        data = { type: 'student-history', rows: r.data || [], total: r.pagination?.total || 0 };
        setPagination({ total: r.pagination?.total || 0, limit });
      }

      else if (selected === 'department') {
        const params = { limit, offset };
        if (dateFrom) params.event_date_from = dateFrom;
        if (dateTo) params.event_date_to = dateTo;
        if (classId) params.class_id = classId;
        const r = await odsService.getODs(params);
        data = { type: 'department', rows: r.data || [], total: r.pagination?.total || 0 };
        setPagination({ total: r.pagination?.total || 0, limit });
      }

      setResults(data);
      setPage(pg);
    } catch (e) {
      setError(e?.response?.data?.error || e?.error || 'Failed to generate report. Please check your filters.');
    } finally {
      setLoading(false);
    }
  };

  const handleExcelDownload = async () => {
    setLoading(true);
    try {
      const r = await reportService.generateExcelReport(month, department ? { department } : {});
      downloadBlob(r.data, `od-report-${month}.xlsx`);
    } catch (e) { setError('Excel download failed.'); }
    finally { setLoading(false); }
  };

  const handleZipDownload = async () => {
    setLoading(true);
    try {
      const r = await reportService.downloadCertificatesZip(month, department ? { department } : {});
      downloadBlob(r.data, `certificates-${month}.zip`);
    } catch (e) { setError('ZIP download failed.'); }
    finally { setLoading(false); }
  };

  const reportType = REPORT_TYPES.find(r => r.id === selected);

  return (
    <div className="flex-1 overflow-y-auto">
      <PageHeader
        title="Reports"
        subtitle="Generate and export OD & certificate reports"
      />

      <div className="p-6 grid lg:grid-cols-3 gap-5">
        {/* Left: Report type picker */}
        <div>
          <SectionCard title="Report Type">
            <div className="p-3 space-y-1">
              {REPORT_TYPES.map(r => (
                <button
                  key={r.id}
                  onClick={() => setSelected(r.id)}
                  className={`w-full flex items-start gap-3 p-3 rounded-lg text-left transition-colors ${
                    selected === r.id
                      ? 'bg-indigo-50 border border-indigo-200'
                      : 'hover:bg-gray-50 border border-transparent'
                  }`}
                >
                  <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke={selected === r.id ? '#4f46e5' : '#9ca3af'} strokeWidth="1.7" className="flex-shrink-0 mt-0.5">
                    <path d={r.icon} />
                  </svg>
                  <div>
                    <p className={`text-sm font-semibold ${selected === r.id ? 'text-indigo-700' : 'text-gray-900'}`}>{r.label}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{r.desc}</p>
                  </div>
                </button>
              ))}
            </div>
          </SectionCard>
        </div>

        {/* Right: Filters + Results */}
        <div className="lg:col-span-2 space-y-5">
          {/* Filters */}
          <SectionCard title="Filters">
            <div className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                {/* Month filter — shown for monthly/cert */}
                {['monthly-od'].includes(selected) && (
                  <Field label="Month">
                    <Input type="month" value={month} onChange={e => setMonth(e.target.value)} />
                  </Field>
                )}

                {/* Department filter */}
                {['monthly-od', 'department'].includes(selected) && (
                  <Field label="Department">
                    <Select value={department} onChange={e => setDepartment(e.target.value)}>
                      <option value="">All Departments</option>
                      {departments.map(d => <option key={d.id} value={d.name}>{d.name}</option>)}
                    </Select>
                  </Field>
                )}

                {/* Class filter */}
                {['certificate', 'pending-cert', 'overdue-cert', 'class-wise', 'student-history', 'department'].includes(selected) && (
                  <Field label="Class">
                    <Select value={classId} onChange={e => setClassId(e.target.value)}>
                      <option value="">All Classes</option>
                      {classes.map(c => <option key={c.id} value={c.id}>{c.display_name} · {c.academic_year_name}</option>)}
                    </Select>
                  </Field>
                )}

                {/* Status filter for certs */}
                {selected === 'certificate' && (
                  <Field label="Certificate Status">
                    <Select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
                      <option value="">All Statuses</option>
                      <option value="submitted">Submitted</option>
                      <option value="verified">Verified</option>
                      <option value="rejected">Rejected</option>
                      <option value="pending">Pending</option>
                      <option value="overdue">Overdue</option>
                      <option value="late_submitted">Late Submitted</option>
                    </Select>
                  </Field>
                )}

                {/* Student search */}
                {selected === 'student-history' && (
                  <Field label="Register Number or Name" required>
                    <Input
                      value={studentSearch}
                      onChange={e => setStudentSearch(e.target.value)}
                      placeholder="e.g. 22AD001 or Alice Johnson"
                    />
                  </Field>
                )}

                {/* Date range filters */}
                {['class-wise', 'student-history', 'department'].includes(selected) && (
                  <>
                    <Field label="From Date">
                      <Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
                    </Field>
                    <Field label="To Date">
                      <Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} />
                    </Field>
                  </>
                )}
              </div>

              <div className="flex flex-wrap gap-3 pt-1">
                <Btn onClick={() => generate(1)} disabled={loading}>
                  {loading && !results ? (
                    <><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" className="animate-spin"><circle cx="12" cy="12" r="10" strokeOpacity="0.3"/><path d="M12 2a10 10 0 0110 10" strokeLinecap="round"/></svg> Generating…</>
                  ) : 'Generate Report'}
                </Btn>
                {canExcel && selected === 'monthly-od' && (
                  <>
                    <Btn variant="secondary" onClick={handleExcelDownload} disabled={loading}>
                      <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                      Export Excel
                    </Btn>
                    <Btn variant="secondary" onClick={handleZipDownload} disabled={loading}>
                      <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                      Download ZIP
                    </Btn>
                  </>
                )}
              </div>
            </div>
          </SectionCard>

          {/* Error */}
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm">{error}</div>
          )}

          {/* Results */}
          {loading && !results && <LoadingState message="Generating report…" />}

          {results && !loading && (
            <SectionCard title={`${reportType?.label} — Results`}>
              {/* Monthly OD Summary */}
              {results.type === 'monthly-od' && (
                <>
                  <div className="grid grid-cols-3 gap-4 p-5 border-b border-gray-100">
                    {[
                      { label: 'Total OD Records', value: results.summary?.total_od_records ?? 0, color: 'text-indigo-600 bg-indigo-50' },
                      { label: 'Certificates Submitted', value: results.summary?.certificates_submitted ?? 0, color: 'text-green-600 bg-green-50' },
                      { label: 'Missing Certificates', value: results.summary?.certificates_missing ?? 0, color: 'text-red-600 bg-red-50' },
                    ].map(s => (
                      <div key={s.label} className="bg-white rounded-xl border border-gray-200 p-4 text-center">
                        <div className="font-display font-bold text-3xl text-gray-900">{s.value}</div>
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-md inline-flex mt-1 ${s.color}`}>{s.label}</span>
                      </div>
                    ))}
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="bg-gray-50 border-b border-gray-200">
                          {['OD ID', 'Register', 'Student', 'Department', 'Event', 'Status', 'Certificate'].map(c => (
                            <th key={c} className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">{c}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {(results.records || []).length === 0 ? (
                          <tr><td colSpan={7} className="py-8 text-center text-sm text-gray-400">No records for {month}</td></tr>
                        ) : (results.records || []).map((r, i) => (
                          <tr key={r.od_id || i} className="hover:bg-gray-50">
                            <td className="px-4 py-3 text-xs font-mono text-indigo-600">{r.registration_number}</td>
                            <td className="px-4 py-3 text-xs font-mono text-gray-600">{r.register_number}</td>
                            <td className="px-4 py-3 text-sm text-gray-900">{r.student_name}</td>
                            <td className="px-4 py-3 text-sm text-gray-500">{r.department}</td>
                            <td className="px-4 py-3 text-sm text-gray-700 max-w-[140px] truncate">{r.event_details}</td>
                            <td className="px-4 py-3"><Badge variant={(r.od_status || 'active').toLowerCase()} label={r.od_status} /></td>
                            <td className="px-4 py-3">
                              {r.certificate_id
                                ? <Badge variant="verified" label="Submitted" />
                                : <Badge variant="overdue" label="Missing" />}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}

              {/* Certificate / pending / overdue tables */}
              {['certificate', 'pending-cert', 'overdue-cert'].includes(results.type) && (
                <>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="bg-gray-50 border-b border-gray-200">
                          {['OD Number', 'Student', 'Register', 'Event', 'Deadline', 'Status', 'Late'].map(c => (
                            <th key={c} className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">{c}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {(results.rows || []).length === 0 ? (
                          <tr><td colSpan={7}>
                            <EmptyState title="No records found" description="Try adjusting your filters." />
                          </td></tr>
                        ) : (results.rows || []).map(r => (
                          <tr key={r.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => navigate(`/certificates/${r.id}`)}>
                            <td className="px-4 py-3 text-xs font-mono text-indigo-600">{r.od_number}</td>
                            <td className="px-4 py-3 text-sm text-gray-900">{r.student_name}</td>
                            <td className="px-4 py-3 text-xs font-mono text-gray-500">{r.register_number}</td>
                            <td className="px-4 py-3 text-sm text-gray-700 max-w-[120px] truncate">{r.event_name}</td>
                            <td className="px-4 py-3 text-sm text-gray-500">{r.deadline ? r.deadline.slice(0,10) : '—'}</td>
                            <td className="px-4 py-3"><Badge variant={r.status} label={r.status?.replace('_',' ')} /></td>
                            <td className="px-4 py-3">{r.is_late ? <Badge variant="overdue" label="Late" /> : '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <Pagination total={pagination.total} perPage={pagination.limit} page={page} onPage={p => generate(p)} />
                </>
              )}

              {/* OD list tables (class-wise / student-history / department) */}
              {['class-wise', 'student-history', 'department'].includes(results.type) && (
                <>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="bg-gray-50 border-b border-gray-200">
                          {['OD Number', 'Event', 'Type', 'Event Date', 'Class', 'Participants', 'Status'].map(c => (
                            <th key={c} className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">{c}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {(results.rows || []).length === 0 ? (
                          <tr><td colSpan={7}>
                            <EmptyState title="No OD records found" description="Try adjusting your filters." />
                          </td></tr>
                        ) : (results.rows || []).map(r => (
                          <tr key={r.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => navigate(`/ods/${r.id}`)}>
                            <td className="px-4 py-3 text-xs font-mono text-indigo-600">{r.od_number}</td>
                            <td className="px-4 py-3 text-sm text-gray-900 max-w-[160px] truncate">{r.event_name}</td>
                            <td className="px-4 py-3"><Badge variant={(r.event_type || '').toLowerCase()} label={r.event_type} /></td>
                            <td className="px-4 py-3 text-sm text-gray-500 whitespace-nowrap">{r.event_date ? r.event_date.slice(0,10) : '—'}</td>
                            <td className="px-4 py-3 text-sm text-gray-500">{r.class_name || '—'}</td>
                            <td className="px-4 py-3 text-sm text-gray-500">{Array.isArray(r.participants) ? r.participants.length : '—'}</td>
                            <td className="px-4 py-3"><Badge variant={r.status} /></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <Pagination total={pagination.total} perPage={pagination.limit} page={page} onPage={p => generate(p)} />
                </>
              )}
            </SectionCard>
          )}
        </div>
      </div>
    </div>
  );
}
