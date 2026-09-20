import { useContext, useEffect, useState, useCallback } from 'react';
import { AuthContext } from '../context/AuthContext';
import managementService from '../services/managementService';
import userService from '../services/userService';

// ── small reusable pieces ──────────────────────────────────────────────────────
const Alert = ({ type, message, onClose }) => {
    if (!message) return null;
    const base = type === 'error'
        ? 'bg-red-50 border-red-300 text-red-800'
        : 'bg-green-50 border-green-300 text-green-800';
    return (
        <div className={`border rounded px-4 py-3 mb-4 flex justify-between items-start ${base}`}>
            <span>{message}</span>
            {onClose && <button className="ml-4 font-bold" onClick={onClose}>×</button>}
        </div>
    );
};

const Tabs = ({ tabs, active, onChange }) => (
    <div className="flex border-b mb-6 overflow-x-auto">
        {tabs.map((t) => (
            <button
                key={t}
                className={`px-4 py-2 text-sm font-medium whitespace-nowrap border-b-2 -mb-px ${active === t ? 'border-blue-600 text-blue-700' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                onClick={() => onChange(t)}
            >{t}</button>
        ))}
    </div>
);

// ── Main Component ─────────────────────────────────────────────────────────────
const ManagementDashboard = () => {
    const { user, logout } = useContext(AuthContext);
    const isAdmin = ['admin', 'super_admin'].includes(user?.role);
    const isSuperAdmin = user?.role === 'super_admin';
    const isAdvisor = user?.role === 'class_advisor';

    const adminTabs = ['Students', 'Org Structure', 'Advisors', 'Representatives', 'Bulk Import', 'Audit'];
    const advisorTabs = ['Students', 'Representatives', 'Bulk Import'];
    const tabs = isAdmin ? adminTabs : advisorTabs;

    const [activeTab, setActiveTab] = useState('Students');
    const [msg, setMsg] = useState('');
    const [err, setErr] = useState('');
    const notify = (m, isErr = false) => { if (isErr) { setErr(m); setMsg(''); } else { setMsg(m); setErr(''); } };

    // ── shared state ────────────────────────────────────────────────────────────
    const [departments, setDepartments] = useState([]);
    const [academicYears, setAcademicYears] = useState([]);
    const [classes, setClasses] = useState([]);
    const [allFaculty, setAllFaculty] = useState([]);

    const loadOrg = useCallback(async () => {
        try {
            const [depts, years, cls] = await Promise.all([
                managementService.getDepartments(),
                managementService.getAcademicYears(),
                managementService.getClasses(),
            ]);
            setDepartments(depts.data || []);
            setAcademicYears(years.data || []);
            setClasses(cls.data || []);
        } catch { /* silent */ }
    }, []);

    useEffect(() => { loadOrg(); }, [loadOrg]);

    // ── Students tab ────────────────────────────────────────────────────────────
    const [students, setStudents] = useState([]);
    const [pagination, setPagination] = useState({ total: 0, limit: 25, offset: 0 });
    const [search, setSearch] = useState('');
    const [filterClass, setFilterClass] = useState('');
    const [filterStatus, setFilterStatus] = useState('');
    const [editStudent, setEditStudent] = useState(null);
    const [newStudent, setNewStudent] = useState({ register_number: '', name: '', date_of_birth: '', class_id: '' });
    const [deleteTarget, setDeleteTarget] = useState(null);
    const [deleteReason, setDeleteReason] = useState('');

    const loadStudents = useCallback(async (offset = 0) => {
        try {
            const params = { limit: pagination.limit, offset };
            if (search) params.q = search;
            if (filterClass) params.class_id = filterClass;
            if (filterStatus) params.status = filterStatus;
            const result = await managementService.getStudents(params);
            setStudents(result.data || []);
            setPagination((p) => ({ ...p, total: result.pagination?.total || 0, offset }));
        } catch (e) { notify(e?.response?.data?.error || 'Failed to load students', true); }
    }, [search, filterClass, filterStatus, pagination.limit]);

    useEffect(() => { if (activeTab === 'Students') loadStudents(0); }, [activeTab, loadStudents]);

    const addStudent = async (e) => {
        e.preventDefault();
        try {
            await managementService.createStudent(newStudent);
            notify('Student added.');
            setNewStudent({ register_number: '', name: '', date_of_birth: '', class_id: '' });
            loadStudents(0);
        } catch (e) { notify(e?.response?.data?.error || 'Failed to add student', true); }
    };

    const saveEdit = async (e) => {
        e.preventDefault();
        try {
            await managementService.updateStudent(editStudent.student_id, {
                name: editStudent.name,
                date_of_birth: editStudent.date_of_birth,
                register_number: editStudent.register_number,
                status: editStudent.status,
            });
            notify('Student updated.');
            setEditStudent(null);
            loadStudents(pagination.offset);
        } catch (e) { notify(e?.response?.data?.error || 'Failed to update student', true); }
    };

    const deactivate = async (student) => {
        if (!window.confirm(`Deactivate ${student.name}? They will lose login access.`)) return;
        try {
            await managementService.deactivateStudent(student.student_id);
            notify(`${student.name} deactivated.`);
            loadStudents(pagination.offset);
        } catch (e) { notify(e?.response?.data?.error || 'Failed to deactivate', true); }
    };

    const permanentDelete = async () => {
        if (!deleteTarget) return;
        try {
            await managementService.permanentDeleteStudent(deleteTarget.student_id, deleteReason);
            notify(`Student ${deleteTarget.register_number} permanently deleted.`);
            setDeleteTarget(null);
            setDeleteReason('');
            loadStudents(0);
        } catch (e) { notify(e?.response?.data?.error || 'Deletion blocked', true); setDeleteTarget(null); }
    };

    // ── Org Structure tab ───────────────────────────────────────────────────────
    const [deptForm, setDeptForm] = useState({ name: '', code: '' });
    const [yearForm, setYearForm] = useState({ name: '', start_date: '', end_date: '' });
    const [classForm, setClassForm] = useState({ department_id: '', academic_year_id: '', year_of_study: '', section: '', display_name: '' });

    const submitDept = async (e) => { e.preventDefault(); try { await managementService.createDepartment(deptForm); notify('Department created.'); setDeptForm({ name: '', code: '' }); loadOrg(); } catch (ex) { notify(ex?.response?.data?.error || 'Failed', true); } };
    const submitYear = async (e) => { e.preventDefault(); try { await managementService.createAcademicYear(yearForm); notify('Academic year created.'); setYearForm({ name: '', start_date: '', end_date: '' }); loadOrg(); } catch (ex) { notify(ex?.response?.data?.error || 'Failed', true); } };
    const submitClass = async (e) => { e.preventDefault(); try { await managementService.createClass(classForm); notify('Class created.'); loadOrg(); } catch (ex) { notify(ex?.response?.data?.error || 'Failed', true); } };

    // ── Advisors tab ────────────────────────────────────────────────────────────
    const [advisorClassSel, setAdvisorClassSel] = useState('');
    const [advisorUserSel, setAdvisorUserSel] = useState('');
    const [advisorReason, setAdvisorReason] = useState('');
    const [advisorHistory, setAdvisorHistory] = useState([]);

    useEffect(() => {
        if (activeTab === 'Advisors' && isAdmin) {
            managementService.getFaculty().then((r) => setAllFaculty(r.data || [])).catch(() => {});
        }
    }, [activeTab, isAdmin]);

    const assignAdvisor = async (e) => {
        e.preventDefault();
        try {
            await managementService.assignAdvisor(advisorClassSel, { user_id: advisorUserSel, reason: advisorReason });
            notify('Advisor assigned.');
            setAdvisorReason('');
        } catch (ex) { notify(ex?.response?.data?.error || 'Failed', true); }
    };

    const loadAdvisorHistory = async () => {
        if (!advisorClassSel) return;
        try {
            const r = await managementService.getAdvisorHistory(advisorClassSel);
            setAdvisorHistory(r.data || []);
        } catch (ex) { notify(ex?.response?.data?.error || 'Failed to load history', true); }
    };

    // ── Representatives tab ─────────────────────────────────────────────────────
    const [crClassSel, setCrClassSel] = useState('');
    const [crStudents, setCrStudents] = useState([]);
    const [crList, setCrList] = useState([]);
    const [crStudentSel, setCrStudentSel] = useState('');

    const loadCRData = useCallback(async () => {
        if (!crClassSel) return;
        try {
            const [studs, reps] = await Promise.all([
                managementService.getStudents({ class_id: crClassSel, status: 'ACTIVE', limit: 200 }),
                managementService.getRepresentatives(crClassSel),
            ]);
            setCrStudents(studs.data || []);
            setCrList(reps.data || []);
        } catch (ex) { notify(ex?.response?.data?.error || 'Failed', true); }
    }, [crClassSel]);

    useEffect(() => { loadCRData(); }, [loadCRData]);

    const assignCR = async () => {
        try {
            await managementService.assignRepresentative(crClassSel, crStudentSel);
            notify('Class Representative assigned.');
            setCrStudentSel('');
            loadCRData();
        } catch (ex) { notify(ex?.response?.data?.error || 'Failed', true); }
    };

    const removeCR = async (studentId) => {
        try {
            await managementService.removeRepresentative(crClassSel, studentId);
            notify('Class Representative removed.');
            loadCRData();
        } catch (ex) { notify(ex?.response?.data?.error || 'Failed', true); }
    };

    const createCRAccount = async (studentId) => {
        try {
            await managementService.createCRAccount(crClassSel, studentId);
            notify('CR login account created.');
        } catch (ex) { notify(ex?.response?.data?.error || 'Failed', true); }
    };

    // ── Bulk Import tab ─────────────────────────────────────────────────────────
    const [importClass, setImportClass] = useState('');
    const [importFile, setImportFile] = useState(null);
    const [importPreview, setImportPreview] = useState(null);
    const [importSession, setImportSession] = useState(null);
    const [importLoading, setImportLoading] = useState(false);

    const runPreview = async () => {
        setImportLoading(true);
        try {
            const result = await managementService.previewImport(importClass, importFile);
            setImportPreview(result);
            setImportSession(result.session_id);
        } catch (ex) { notify(ex?.response?.data?.error || 'Preview failed', true); }
        finally { setImportLoading(false); }
    };

    const runConfirm = async () => {
        setImportLoading(true);
        try {
            const result = await managementService.confirmImport(importSession);
            notify(`${result.imported} students imported successfully.`);
            setImportPreview(null);
            setImportSession(null);
            setImportFile(null);
            loadStudents(0);
        } catch (ex) { notify(ex?.response?.data?.error || 'Import failed', true); }
        finally { setImportLoading(false); }
    };

    // ── Audit tab ───────────────────────────────────────────────────────────────
    const [auditLog, setAuditLog] = useState([]);
    const [auditPag, setAuditPag] = useState({ total: 0, limit: 50, offset: 0 });
    const loadAudit = useCallback(async (offset = 0) => {
        try {
            const r = await managementService.getAuditLog({ limit: auditPag.limit, offset });
            setAuditLog(r.data || []);
            setAuditPag((p) => ({ ...p, total: r.pagination?.total || 0, offset }));
        } catch { /* silent */ }
    }, [auditPag.limit]);
    useEffect(() => { if (activeTab === 'Audit') loadAudit(0); }, [activeTab, loadAudit]);

    // ── render ──────────────────────────────────────────────────────────────────
    return (
        <div className="container-main p-6">
            <div className="max-w-7xl mx-auto">
                <header className="flex justify-between items-center mb-6">
                    <div>
                        <p className="text-sm uppercase tracking-wide text-blue-700">Phase 2 Management</p>
                        <h1 className="text-3xl font-bold text-gray-900">{isAdmin ? 'Administration' : 'My Class'}</h1>
                        <p className="text-gray-500 text-sm">{user?.username} · {user?.role}</p>
                    </div>
                    <button className="btn-secondary" onClick={logout}>Logout</button>
                </header>

                <Alert type="success" message={msg} onClose={() => setMsg('')} />
                <Alert type="error" message={err} onClose={() => setErr('')} />

                <Tabs tabs={tabs} active={activeTab} onChange={setActiveTab} />

                {/* ── STUDENTS ── */}
                {activeTab === 'Students' && (
                    <div className="space-y-6">
                        {/* Add form */}
                        <div className="card">
                            <h2 className="font-bold mb-3">Add Student</h2>
                            <form onSubmit={addStudent} className="grid md:grid-cols-5 gap-3">
                                <input className="form-input" placeholder="Register number" value={newStudent.register_number} onChange={(e) => setNewStudent({ ...newStudent, register_number: e.target.value })} required />
                                <input className="form-input" placeholder="Full name" value={newStudent.name} onChange={(e) => setNewStudent({ ...newStudent, name: e.target.value })} required />
                                <input className="form-input" type="date" value={newStudent.date_of_birth} onChange={(e) => setNewStudent({ ...newStudent, date_of_birth: e.target.value })} required />
                                <select className="form-input" value={newStudent.class_id} onChange={(e) => setNewStudent({ ...newStudent, class_id: e.target.value })} required>
                                    <option value="">Class</option>
                                    {classes.map((c) => <option key={c.id} value={c.id}>{c.display_name} · {c.academic_year_name}</option>)}
                                </select>
                                <button className="btn-primary" type="submit">Add</button>
                            </form>
                        </div>

                        {/* Filters */}
                        <div className="card">
                            <div className="flex flex-wrap gap-3 mb-4 items-end">
                                <input className="form-input w-48" placeholder="Search name/reg…" value={search} onChange={(e) => setSearch(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && loadStudents(0)} />
                                <select className="form-input w-48" value={filterClass} onChange={(e) => { setFilterClass(e.target.value); loadStudents(0); }}>
                                    <option value="">All classes</option>
                                    {classes.map((c) => <option key={c.id} value={c.id}>{c.display_name}</option>)}
                                </select>
                                <select className="form-input w-36" value={filterStatus} onChange={(e) => { setFilterStatus(e.target.value); loadStudents(0); }}>
                                    <option value="">All statuses</option>
                                    <option value="ACTIVE">Active</option>
                                    <option value="INACTIVE">Inactive</option>
                                    <option value="GRADUATED">Graduated</option>
                                </select>
                                <button className="btn-primary" onClick={() => loadStudents(0)}>Search</button>
                            </div>

                            <div className="overflow-x-auto">
                                <table className="w-full text-sm text-left">
                                    <thead><tr className="border-b text-gray-500"><th className="py-2 pr-3">Register</th><th className="pr-3">Name</th><th className="pr-3">Class</th><th className="pr-3">Status</th><th>Actions</th></tr></thead>
                                    <tbody>
                                        {students.map((s) => (
                                            <tr key={s.student_id} className="border-b hover:bg-gray-50">
                                                <td className="py-2 pr-3 font-mono text-xs">{s.register_number}</td>
                                                <td className="pr-3">{s.name}</td>
                                                <td className="pr-3 text-gray-500 text-xs">{s.display_name}</td>
                                                <td className="pr-3"><span className={`text-xs px-2 py-0.5 rounded-full ${s.status === 'ACTIVE' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>{s.status}</span></td>
                                                <td className="flex gap-2 py-2">
                                                    <button className="text-blue-600 text-xs hover:underline" onClick={() => setEditStudent({ ...s, date_of_birth: s.date_of_birth?.slice(0, 10) || '' })}>Edit</button>
                                                    {s.status !== 'INACTIVE' && <button className="text-orange-600 text-xs hover:underline" onClick={() => deactivate(s)}>Deactivate</button>}
                                                    {isSuperAdmin && s.status === 'INACTIVE' && <button className="text-red-600 text-xs hover:underline" onClick={() => setDeleteTarget(s)}>Delete</button>}
                                                </td>
                                            </tr>
                                        ))}
                                        {students.length === 0 && <tr><td colSpan={5} className="py-6 text-center text-gray-400">No students found</td></tr>}
                                    </tbody>
                                </table>
                            </div>
                            {/* Pagination */}
                            <div className="flex justify-between items-center mt-3 text-sm text-gray-500">
                                <span>{pagination.total} total</span>
                                <div className="flex gap-2">
                                    <button disabled={pagination.offset === 0} onClick={() => loadStudents(Math.max(0, pagination.offset - pagination.limit))} className="btn-secondary disabled:opacity-40">← Prev</button>
                                    <span>{Math.floor(pagination.offset / pagination.limit) + 1}</span>
                                    <button disabled={pagination.offset + pagination.limit >= pagination.total} onClick={() => loadStudents(pagination.offset + pagination.limit)} className="btn-secondary disabled:opacity-40">Next →</button>
                                </div>
                            </div>
                        </div>

                        {/* Edit modal */}
                        {editStudent && (
                            <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
                                <form onSubmit={saveEdit} className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md space-y-4">
                                    <h2 className="font-bold text-lg">Edit Student</h2>
                                    <input className="form-input w-full" placeholder="Register number" value={editStudent.register_number} onChange={(e) => setEditStudent({ ...editStudent, register_number: e.target.value })} required />
                                    <input className="form-input w-full" placeholder="Name" value={editStudent.name} onChange={(e) => setEditStudent({ ...editStudent, name: e.target.value })} required />
                                    <input className="form-input w-full" type="date" value={editStudent.date_of_birth} onChange={(e) => setEditStudent({ ...editStudent, date_of_birth: e.target.value })} />
                                    <select className="form-input w-full" value={editStudent.status} onChange={(e) => setEditStudent({ ...editStudent, status: e.target.value })}>
                                        <option value="ACTIVE">Active</option>
                                        <option value="INACTIVE">Inactive</option>
                                        <option value="GRADUATED">Graduated</option>
                                        <option value="TRANSFERRED">Transferred</option>
                                    </select>
                                    <div className="flex gap-3">
                                        <button className="btn-primary" type="submit">Save</button>
                                        <button className="btn-secondary" type="button" onClick={() => setEditStudent(null)}>Cancel</button>
                                    </div>
                                </form>
                            </div>
                        )}

                        {/* Permanent delete confirm */}
                        {deleteTarget && isSuperAdmin && (
                            <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
                                <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md space-y-4">
                                    <h2 className="font-bold text-lg text-red-700">⚠ Permanent Deletion</h2>
                                    <p className="text-sm">You are about to permanently delete <strong>{deleteTarget.name}</strong> ({deleteTarget.register_number}). This cannot be undone. Deletion will fail if OD or certificate records exist.</p>
                                    <input className="form-input w-full" placeholder="Reason (optional)" value={deleteReason} onChange={(e) => setDeleteReason(e.target.value)} />
                                    <div className="flex gap-3">
                                        <button className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700" onClick={permanentDelete}>Permanently Delete</button>
                                        <button className="btn-secondary" onClick={() => { setDeleteTarget(null); setDeleteReason(''); }}>Cancel</button>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* ── ORG STRUCTURE ── */}
                {activeTab === 'Org Structure' && isAdmin && (
                    <div className="grid md:grid-cols-3 gap-6">
                        <div className="card space-y-3">
                            <h2 className="font-bold">Departments</h2>
                            <form onSubmit={submitDept} className="space-y-2">
                                <input className="form-input w-full" placeholder="Name" value={deptForm.name} onChange={(e) => setDeptForm({ ...deptForm, name: e.target.value })} required />
                                <input className="form-input w-full" placeholder="Code (e.g. CSE)" value={deptForm.code} onChange={(e) => setDeptForm({ ...deptForm, code: e.target.value })} required />
                                <button className="btn-primary w-full" type="submit">Create Department</button>
                            </form>
                            <div className="divide-y text-sm">{departments.map((d) => <div key={d.id} className="py-1">{d.name} <span className="text-gray-400">({d.code})</span></div>)}</div>
                        </div>
                        <div className="card space-y-3">
                            <h2 className="font-bold">Academic Years</h2>
                            <form onSubmit={submitYear} className="space-y-2">
                                <input className="form-input w-full" placeholder="e.g. 2026-27" value={yearForm.name} onChange={(e) => setYearForm({ ...yearForm, name: e.target.value })} required />
                                <input className="form-input w-full" type="date" value={yearForm.start_date} onChange={(e) => setYearForm({ ...yearForm, start_date: e.target.value })} />
                                <input className="form-input w-full" type="date" value={yearForm.end_date} onChange={(e) => setYearForm({ ...yearForm, end_date: e.target.value })} />
                                <button className="btn-primary w-full" type="submit">Create Academic Year</button>
                            </form>
                            <div className="divide-y text-sm">{academicYears.map((y) => <div key={y.id} className="py-1">{y.name}</div>)}</div>
                        </div>
                        <div className="card space-y-3">
                            <h2 className="font-bold">Classes</h2>
                            <form onSubmit={submitClass} className="space-y-2">
                                <select className="form-input w-full" value={classForm.department_id} onChange={(e) => setClassForm({ ...classForm, department_id: e.target.value })} required>
                                    <option value="">Department</option>
                                    {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                                </select>
                                <select className="form-input w-full" value={classForm.academic_year_id} onChange={(e) => setClassForm({ ...classForm, academic_year_id: e.target.value })} required>
                                    <option value="">Academic Year</option>
                                    {academicYears.map((y) => <option key={y.id} value={y.id}>{y.name}</option>)}
                                </select>
                                <input className="form-input w-full" placeholder="Year of study" value={classForm.year_of_study} onChange={(e) => setClassForm({ ...classForm, year_of_study: e.target.value })} required />
                                <input className="form-input w-full" placeholder="Section (e.g. A)" value={classForm.section} onChange={(e) => setClassForm({ ...classForm, section: e.target.value })} required />
                                <input className="form-input w-full" placeholder="Display name (e.g. ADS-A)" value={classForm.display_name} onChange={(e) => setClassForm({ ...classForm, display_name: e.target.value })} required />
                                <button className="btn-primary w-full" type="submit">Create Class</button>
                            </form>
                            <div className="divide-y text-sm">{classes.map((c) => <div key={c.id} className="py-1">{c.display_name} <span className="text-gray-400">· {c.department_name} · {c.academic_year_name}</span></div>)}</div>
                        </div>
                    </div>
                )}

                {/* ── ADVISORS ── */}
                {activeTab === 'Advisors' && isAdmin && (
                    <div className="space-y-6">
                        <div className="card">
                            <h2 className="font-bold mb-4">Assign / Replace Class Advisor</h2>
                            <form onSubmit={assignAdvisor} className="grid md:grid-cols-4 gap-3">
                                <select className="form-input" value={advisorClassSel} onChange={(e) => setAdvisorClassSel(e.target.value)} required>
                                    <option value="">Select class</option>
                                    {classes.map((c) => <option key={c.id} value={c.id}>{c.display_name}</option>)}
                                </select>
                                <select className="form-input" value={advisorUserSel} onChange={(e) => setAdvisorUserSel(e.target.value)} required>
                                    <option value="">Select faculty</option>
                                    {allFaculty.map((f) => <option key={f.user_id} value={f.user_id}>{f.username} ({f.role})</option>)}
                                </select>
                                <input className="form-input" placeholder="Reason (optional)" value={advisorReason} onChange={(e) => setAdvisorReason(e.target.value)} />
                                <button className="btn-primary" type="submit">Assign</button>
                            </form>
                        </div>
                        <div className="card">
                            <h2 className="font-bold mb-3">Advisor History</h2>
                            <div className="flex gap-3 mb-4">
                                <select className="form-input" value={advisorClassSel} onChange={(e) => setAdvisorClassSel(e.target.value)}>
                                    <option value="">Select class</option>
                                    {classes.map((c) => <option key={c.id} value={c.id}>{c.display_name}</option>)}
                                </select>
                                <button className="btn-secondary" onClick={loadAdvisorHistory} disabled={!advisorClassSel}>Load History</button>
                            </div>
                            <div className="divide-y text-sm">
                                {advisorHistory.map((h) => (
                                    <div key={h.id} className="py-2">
                                        <strong>{h.username}</strong> <span className={h.unassigned_at ? 'text-gray-400' : 'text-green-600'}>{h.unassigned_at ? 'Former' : 'Active'}</span>
                                        <div className="text-xs text-gray-400">Assigned: {new Date(h.assigned_at).toLocaleDateString()} {h.unassigned_at && `· Removed: ${new Date(h.unassigned_at).toLocaleDateString()}`} {h.reason && `· ${h.reason}`}</div>
                                    </div>
                                ))}
                                {advisorHistory.length === 0 && <p className="text-gray-400 py-4">Select a class and load history.</p>}
                            </div>
                        </div>
                    </div>
                )}

                {/* ── REPRESENTATIVES ── */}
                {activeTab === 'Representatives' && (
                    <div className="space-y-6">
                        <div className="card">
                            <h2 className="font-bold mb-3">Manage Class Representatives</h2>
                            <div className="mb-4">
                                <select className="form-input" value={crClassSel} onChange={(e) => setCrClassSel(e.target.value)}>
                                    <option value="">Select class</option>
                                    {classes.map((c) => <option key={c.id} value={c.id}>{c.display_name}</option>)}
                                </select>
                            </div>
                            {crClassSel && (
                                <div className="grid md:grid-cols-2 gap-6">
                                    <div>
                                        <h3 className="font-medium mb-2 text-sm text-gray-600">Assign CR</h3>
                                        <select className="form-input w-full mb-3" value={crStudentSel} onChange={(e) => setCrStudentSel(e.target.value)}>
                                            <option value="">Select active student</option>
                                            {crStudents.filter((s) => !crList.some((cr) => cr.student_id === s.student_id)).map((s) => <option key={s.student_id} value={s.student_id}>{s.name} ({s.register_number})</option>)}
                                        </select>
                                        <button className="btn-primary" disabled={!crStudentSel} onClick={assignCR}>Assign as CR</button>
                                    </div>
                                    <div>
                                        <h3 className="font-medium mb-2 text-sm text-gray-600">Current CRs</h3>
                                        {crList.length === 0 && <p className="text-gray-400 text-sm">No CRs assigned yet.</p>}
                                        {crList.map((cr) => (
                                            <div key={cr.student_id} className="flex justify-between items-center border-b py-2 text-sm">
                                                <div>
                                                    <strong>{cr.name}</strong> <span className="text-gray-400 text-xs">{cr.register_number}</span>
                                                </div>
                                                <div className="flex gap-2">
                                                    <button className="text-xs text-blue-600 hover:underline" onClick={() => createCRAccount(cr.student_id)}>Create Login</button>
                                                    <button className="text-xs text-red-600 hover:underline" onClick={() => removeCR(cr.student_id)}>Remove</button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* ── BULK IMPORT ── */}
                {activeTab === 'Bulk Import' && (
                    <div className="card space-y-4">
                        <h2 className="font-bold">Bulk Student Import</h2>
                        <p className="text-sm text-gray-500">Upload an <code>.xlsx</code> or <code>.csv</code> file with columns: <code>register_number</code>, <code>name</code>, <code>date_of_birth</code> (YYYY-MM-DD).</p>
                        <div className="flex flex-wrap gap-3 items-center">
                            <select className="form-input" value={importClass} onChange={(e) => { setImportClass(e.target.value); setImportPreview(null); setImportSession(null); }}>
                                <option value="">Select target class</option>
                                {classes.map((c) => <option key={c.id} value={c.id}>{c.display_name} · {c.academic_year_name}</option>)}
                            </select>
                            <input type="file" accept=".xlsx,.csv" onChange={(e) => { setImportFile(e.target.files[0]); setImportPreview(null); setImportSession(null); }} />
                            <button className="btn-primary" onClick={runPreview} disabled={!importClass || !importFile || importLoading}>
                                {importLoading ? 'Processing…' : 'Preview Import'}
                            </button>
                        </div>
                        {importPreview && (
                            <div className="border-t pt-4 space-y-3">
                                <p className="text-sm font-medium">Preview: {importPreview.summary.total} rows · <span className="text-green-700">{importPreview.summary.valid} valid</span> · <span className="text-red-600">{importPreview.summary.duplicates} duplicate</span> · <span className="text-orange-600">{importPreview.summary.invalid} invalid</span></p>
                                <div className="max-h-40 overflow-auto border rounded p-2 text-xs space-y-1">
                                    {importPreview.rows.filter((r) => r.errors.length > 0).map((r) => (
                                        <p key={r.row_number} className="text-red-600">Row {r.row_number}: {r.errors.join(', ')}</p>
                                    ))}
                                    {importPreview.rows.filter((r) => !r.errors.length).slice(0, 5).map((r) => (
                                        <p key={r.row_number} className="text-green-600">✓ Row {r.row_number}: {r.name} ({r.register_number})</p>
                                    ))}
                                </div>
                                {importPreview.summary.valid === importPreview.summary.total && importPreview.summary.valid > 0 && (
                                    <button className="btn-primary" onClick={runConfirm} disabled={importLoading}>
                                        {importLoading ? 'Importing…' : `Confirm Import (${importPreview.summary.valid} students)`}
                                    </button>
                                )}
                                {importPreview.summary.valid !== importPreview.summary.total && (
                                    <p className="text-sm text-red-600">Fix the errors above before confirming.</p>
                                )}
                            </div>
                        )}
                    </div>
                )}

                {/* ── AUDIT ── */}
                {activeTab === 'Audit' && isSuperAdmin && (
                    <div className="card">
                        <h2 className="font-bold mb-4">Audit Log</h2>
                        <div className="overflow-x-auto max-h-[60vh] overflow-y-auto">
                            <table className="w-full text-xs text-left">
                                <thead className="sticky top-0 bg-white"><tr className="border-b text-gray-500"><th className="py-2 pr-3">Time</th><th className="pr-3">Actor</th><th className="pr-3">Action</th><th className="pr-3">Target</th><th>Details</th></tr></thead>
                                <tbody>
                                    {auditLog.map((e) => (
                                        <tr key={e.id} className="border-b hover:bg-gray-50">
                                            <td className="py-1 pr-3 whitespace-nowrap">{new Date(e.created_at).toLocaleString()}</td>
                                            <td className="pr-3">{e.actor_username || '—'}</td>
                                            <td className="pr-3 font-mono">{e.action}</td>
                                            <td className="pr-3">{e.target_entity} #{e.target_id}</td>
                                            <td className="text-gray-400 max-w-xs truncate">{e.details || ''}</td>
                                        </tr>
                                    ))}
                                    {auditLog.length === 0 && <tr><td colSpan={5} className="py-6 text-center text-gray-400">No audit records</td></tr>}
                                </tbody>
                            </table>
                        </div>
                        <div className="flex justify-between items-center mt-3 text-sm text-gray-500">
                            <span>{auditPag.total} total events</span>
                            <div className="flex gap-2">
                                <button disabled={auditPag.offset === 0} onClick={() => loadAudit(Math.max(0, auditPag.offset - auditPag.limit))} className="btn-secondary disabled:opacity-40">← Prev</button>
                                <button disabled={auditPag.offset + auditPag.limit >= auditPag.total} onClick={() => loadAudit(auditPag.offset + auditPag.limit)} className="btn-secondary disabled:opacity-40">Next →</button>
                            </div>
                        </div>
                    </div>
                )}
                {activeTab === 'Audit' && !isSuperAdmin && (
                    <div className="card text-center text-gray-400 py-12">Audit log is available to Super Admin only.</div>
                )}
            </div>
        </div>
    );
};

export default ManagementDashboard;