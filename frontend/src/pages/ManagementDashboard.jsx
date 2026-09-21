import { useContext, useEffect, useState, useCallback } from 'react';
import { AuthContext } from '../context/AuthContext';
import managementService from '../services/managementService';
import userService from '../services/userService';
import Badge from '../components/ui/Badge';
import {
    Alert, LoadingState, EmptyState, PageHeader, SectionCard,
    SearchInput, Pagination, Btn, Field, Input, Select, Textarea,
    Modal, ConfirmModal
} from '../components/ui/index';

// ── Tab bar ───────────────────────────────────────────────────────────────────
const Tabs = ({ tabs, active, onChange }) => (
    <div className="flex border-b border-gray-200 mb-6 overflow-x-auto">
        {tabs.map((t) => (
            <button
                key={t}
                onClick={() => onChange(t)}
                className={`px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 -mb-px transition-colors ${
                    active === t
                        ? 'border-indigo-600 text-indigo-600'
                        : 'border-transparent text-gray-500 hover:text-gray-900'
                }`}
            >{t}</button>
        ))}
    </div>
);

// ── Main Component ────────────────────────────────────────────────────────────
const ManagementDashboard = () => {
    const { user } = useContext(AuthContext);
    const isAdmin = ['admin', 'super_admin'].includes(user?.role);
    const isSuperAdmin = user?.role === 'super_admin';

    const adminTabs = ['Students', 'Org Structure', 'Advisors', 'Representatives', 'Bulk Import', 'Audit'];
    const advisorTabs = ['Students', 'Representatives', 'Bulk Import'];
    const tabs = isAdmin ? adminTabs : advisorTabs;

    const [activeTab, setActiveTab] = useState('Students');
    const [msg, setMsg] = useState('');
    const [err, setErr] = useState('');
    const notify = (m, isErr = false) => {
        if (isErr) { setErr(m); setMsg(''); } else { setMsg(m); setErr(''); }
    };

    // ── shared org state ──────────────────────────────────────────────────────
    const [departments, setDepartments] = useState([]);
    const [academicYears, setAcademicYears] = useState([]);
    const [classes, setClasses] = useState([]);
    const [allFaculty, setAllFaculty] = useState([]);
    const [orgLoading, setOrgLoading] = useState(true);

    const loadOrg = useCallback(async () => {
        setOrgLoading(true);
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
        finally { setOrgLoading(false); }
    }, []);

    useEffect(() => { loadOrg(); }, [loadOrg]);

    // ── Students ──────────────────────────────────────────────────────────────
    const [students, setStudents] = useState([]);
    const [studLoading, setStudLoading] = useState(false);
    const [pagination, setPagination] = useState({ total: 0, limit: 25, offset: 0 });
    const [search, setSearch] = useState('');
    const [filterClass, setFilterClass] = useState('');
    const [filterStatus, setFilterStatus] = useState('');
    const [editStudent, setEditStudent] = useState(null);
    const [newStudent, setNewStudent] = useState({ register_number: '', name: '', date_of_birth: '', class_id: '' });
    const [addOpen, setAddOpen] = useState(false);
    const [deleteTarget, setDeleteTarget] = useState(null);
    const [deleteReason, setDeleteReason] = useState('');

    const loadStudents = useCallback(async (offset = 0) => {
        setStudLoading(true);
        try {
            const params = { limit: pagination.limit, offset };
            if (search) params.q = search;
            if (filterClass) params.class_id = filterClass;
            if (filterStatus) params.status = filterStatus;
            const result = await managementService.getStudents(params);
            setStudents(result.data || []);
            setPagination((p) => ({ ...p, total: result.pagination?.total || 0, offset }));
        } catch (e) { notify(e?.response?.data?.error || 'Failed to load students', true); }
        finally { setStudLoading(false); }
    }, [search, filterClass, filterStatus, pagination.limit]);

    useEffect(() => { if (activeTab === 'Students') loadStudents(0); }, [activeTab, loadStudents]);

    const addStudent = async (e) => {
        e.preventDefault();
        try {
            await managementService.createStudent(newStudent);
            notify('Student added.');
            setNewStudent({ register_number: '', name: '', date_of_birth: '', class_id: '' });
            setAddOpen(false);
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
        try {
            await managementService.deactivateStudent(student.student_id);
            notify(`${student.name} deactivated.`);
            loadStudents(pagination.offset);
        } catch (e) { notify(e?.response?.data?.error || 'Failed to deactivate', true); }
    };

    const [deactivateTarget, setDeactivateTarget] = useState(null);

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

    // ── Org Structure ─────────────────────────────────────────────────────────
    const [deptForm, setDeptForm] = useState({ name: '', code: '' });
    const [yearForm, setYearForm] = useState({ name: '', start_date: '', end_date: '' });
    const [classForm, setClassForm] = useState({ department_id: '', academic_year_id: '', year_of_study: '', section: '', display_name: '' });

    const submitDept = async (e) => {
        e.preventDefault();
        try { await managementService.createDepartment(deptForm); notify('Department created.'); setDeptForm({ name: '', code: '' }); loadOrg(); }
        catch (ex) { notify(ex?.response?.data?.error || 'Failed', true); }
    };
    const submitYear = async (e) => {
        e.preventDefault();
        try { await managementService.createAcademicYear(yearForm); notify('Academic year created.'); setYearForm({ name: '', start_date: '', end_date: '' }); loadOrg(); }
        catch (ex) { notify(ex?.response?.data?.error || 'Failed', true); }
    };
    const submitClass = async (e) => {
        e.preventDefault();
        try { await managementService.createClass(classForm); notify('Class created.'); loadOrg(); }
        catch (ex) { notify(ex?.response?.data?.error || 'Failed', true); }
    };

    // ── Advisors ──────────────────────────────────────────────────────────────
    const [advisorClassSel, setAdvisorClassSel] = useState('');
    const [advisorUserSel, setAdvisorUserSel] = useState('');
    const [advisorReason, setAdvisorReason] = useState('');
    const [advisorHistory, setAdvisorHistory] = useState([]);
    const [advisorHistLoading, setAdvisorHistLoading] = useState(false);

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
        setAdvisorHistLoading(true);
        try {
            const r = await managementService.getAdvisorHistory(advisorClassSel);
            setAdvisorHistory(r.data || []);
        } catch (ex) { notify(ex?.response?.data?.error || 'Failed to load history', true); }
        finally { setAdvisorHistLoading(false); }
    };

    // ── Representatives ───────────────────────────────────────────────────────
    const [crClassSel, setCrClassSel] = useState('');
    const [crStudents, setCrStudents] = useState([]);
    const [crList, setCrList] = useState([]);
    const [crStudentSel, setCrStudentSel] = useState('');
    const [crLoading, setCrLoading] = useState(false);

    const loadCRData = useCallback(async () => {
        if (!crClassSel) return;
        setCrLoading(true);
        try {
            const [studs, reps] = await Promise.all([
                managementService.getStudents({ class_id: crClassSel, status: 'ACTIVE', limit: 200 }),
                managementService.getRepresentatives(crClassSel),
            ]);
            setCrStudents(studs.data || []);
            setCrList(reps.data || []);
        } catch (ex) { notify(ex?.response?.data?.error || 'Failed', true); }
        finally { setCrLoading(false); }
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

    // ── Bulk Import ───────────────────────────────────────────────────────────
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

    // ── Audit ─────────────────────────────────────────────────────────────────
    const [auditLog, setAuditLog] = useState([]);
    const [auditLoading, setAuditLoading] = useState(false);
    const [auditSearch, setAuditSearch] = useState('');
    const [auditPag, setAuditPag] = useState({ total: 0, limit: 50, offset: 0 });
    const [auditDetail, setAuditDetail] = useState(null);

    const loadAudit = useCallback(async (offset = 0) => {
        setAuditLoading(true);
        try {
            const r = await managementService.getAuditLog({ limit: auditPag.limit, offset });
            setAuditLog(r.data || []);
            setAuditPag((p) => ({ ...p, total: r.pagination?.total || 0, offset }));
        } catch { /* silent */ }
        finally { setAuditLoading(false); }
    }, [auditPag.limit]);

    useEffect(() => { if (activeTab === 'Audit') loadAudit(0); }, [activeTab, loadAudit]);

    const filteredAudit = auditSearch
        ? auditLog.filter(e =>
            (e.actor_username || '').toLowerCase().includes(auditSearch.toLowerCase()) ||
            (e.action || '').toLowerCase().includes(auditSearch.toLowerCase()) ||
            (e.target_entity || '').toLowerCase().includes(auditSearch.toLowerCase()) ||
            (e.details || '').toLowerCase().includes(auditSearch.toLowerCase())
          )
        : auditLog;

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
        OD_CREATED: 'bg-green-50 text-green-700',
        OD_CANCELLED: 'bg-red-50 text-red-600',
        CERTIFICATE_SUBMITTED: 'bg-blue-50 text-blue-700',
        CERTIFICATE_VERIFIED: 'bg-green-50 text-green-700',
        CERTIFICATE_REJECTED: 'bg-red-50 text-red-600',
    };

    // ── render ────────────────────────────────────────────────────────────────
    return (
        <div className="flex-1 overflow-y-auto">
            <PageHeader
                title={isAdmin ? 'Administration' : 'My Class'}
                subtitle={`${user?.username} · ${user?.role}`}
            />

            <div className="p-6">
                <Alert type="success" message={msg} onClose={() => setMsg('')} />
                <Alert type="error" message={err} onClose={() => setErr('')} />

                <Tabs tabs={tabs} active={activeTab} onChange={setActiveTab} />

                {/* ═══════════════════════════════════════════════════════════
                    STUDENTS TAB
                ═══════════════════════════════════════════════════════════ */}
                {activeTab === 'Students' && (
                    <div className="space-y-5">
                        {/* Toolbar */}
                        <div className="flex flex-wrap gap-3 items-center justify-between">
                            <div className="flex flex-wrap gap-3 items-center">
                                <SearchInput
                                    value={search}
                                    onChange={setSearch}
                                    placeholder="Search name or register…"
                                    className="min-w-[200px]"
                                />
                                <select
                                    value={filterClass}
                                    onChange={(e) => { setFilterClass(e.target.value); loadStudents(0); }}
                                    className="px-3 py-2.5 rounded-lg border border-gray-200 text-sm text-gray-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 bg-white"
                                >
                                    <option value="">All classes</option>
                                    {classes.map((c) => <option key={c.id} value={c.id}>{c.display_name}</option>)}
                                </select>
                                <select
                                    value={filterStatus}
                                    onChange={(e) => { setFilterStatus(e.target.value); loadStudents(0); }}
                                    className="px-3 py-2.5 rounded-lg border border-gray-200 text-sm text-gray-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 bg-white"
                                >
                                    <option value="">All statuses</option>
                                    <option value="ACTIVE">Active</option>
                                    <option value="INACTIVE">Inactive</option>
                                    <option value="GRADUATED">Graduated</option>
                                </select>
                                <Btn onClick={() => loadStudents(0)}>Search</Btn>
                            </div>
                            <Btn onClick={() => setAddOpen(true)}>
                                <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                                    <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
                                </svg>
                                Add Student
                            </Btn>
                        </div>

                        {/* Table */}
                        {studLoading ? (
                            <LoadingState message="Loading students…" />
                        ) : (
                            <SectionCard>
                                <div className="overflow-x-auto">
                                    <table className="w-full">
                                        <thead>
                                            <tr className="bg-gray-50 border-b border-gray-200">
                                                {['Register', 'Name', 'Class', 'Status', 'Actions'].map(col => (
                                                    <th key={col} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">{col}</th>
                                                ))}
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-100">
                                            {students.length === 0 ? (
                                                <tr>
                                                    <td colSpan={5}>
                                                        <EmptyState
                                                            title="No students found"
                                                            description="Try adjusting your search or filters."
                                                            action={<Btn size="sm" onClick={() => setAddOpen(true)}>Add Student</Btn>}
                                                        />
                                                    </td>
                                                </tr>
                                            ) : students.map((s) => (
                                                <tr key={s.student_id} className="hover:bg-gray-50 transition-colors">
                                                    <td className="px-4 py-3 text-sm font-mono text-indigo-600 font-medium">{s.register_number}</td>
                                                    <td className="px-4 py-3 text-sm text-gray-900 font-medium">{s.name}</td>
                                                    <td className="px-4 py-3 text-sm text-gray-500">{s.display_name || '—'}</td>
                                                    <td className="px-4 py-3">
                                                        <Badge variant={(s.status || '').toLowerCase()} label={s.status} />
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        <div className="flex items-center gap-2">
                                                            <button
                                                                onClick={() => setEditStudent({ ...s, date_of_birth: s.date_of_birth?.slice(0, 10) || '' })}
                                                                className="px-2.5 py-1.5 text-xs font-medium text-indigo-600 border border-indigo-200 rounded-md hover:bg-indigo-50 transition-colors"
                                                            >Edit</button>
                                                            {s.status !== 'INACTIVE' && (
                                                                <button
                                                                    onClick={() => setDeactivateTarget(s)}
                                                                    className="px-2.5 py-1.5 text-xs font-medium text-amber-600 border border-amber-200 rounded-md hover:bg-amber-50 transition-colors"
                                                                >Deactivate</button>
                                                            )}
                                                            {isSuperAdmin && s.status === 'INACTIVE' && (
                                                                <button
                                                                    onClick={() => setDeleteTarget(s)}
                                                                    className="px-2.5 py-1.5 text-xs font-medium text-red-600 border border-red-200 rounded-md hover:bg-red-50 transition-colors"
                                                                >Delete</button>
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
                                    page={Math.floor(pagination.offset / pagination.limit) + 1}
                                    onPage={(p) => loadStudents((p - 1) * pagination.limit)}
                                />
                            </SectionCard>
                        )}

                        {/* Add Student Modal */}
                        {addOpen && (
                            <Modal title="Add Student" onClose={() => setAddOpen(false)}>
                                <form onSubmit={addStudent} className="space-y-4">
                                    <Field label="Register Number" required>
                                        <Input placeholder="e.g. 22AD001" value={newStudent.register_number} onChange={(e) => setNewStudent({ ...newStudent, register_number: e.target.value })} required />
                                    </Field>
                                    <Field label="Full Name" required>
                                        <Input placeholder="Student name" value={newStudent.name} onChange={(e) => setNewStudent({ ...newStudent, name: e.target.value })} required />
                                    </Field>
                                    <Field label="Date of Birth" required>
                                        <Input type="date" value={newStudent.date_of_birth} onChange={(e) => setNewStudent({ ...newStudent, date_of_birth: e.target.value })} required />
                                    </Field>
                                    <Field label="Class" required>
                                        <Select value={newStudent.class_id} onChange={(e) => setNewStudent({ ...newStudent, class_id: e.target.value })} required>
                                            <option value="">Select class…</option>
                                            {classes.map((c) => <option key={c.id} value={c.id}>{c.display_name} · {c.academic_year_name}</option>)}
                                        </Select>
                                    </Field>
                                    <div className="flex gap-3 justify-end pt-2">
                                        <Btn variant="secondary" type="button" onClick={() => setAddOpen(false)}>Cancel</Btn>
                                        <Btn type="submit">Add Student</Btn>
                                    </div>
                                </form>
                            </Modal>
                        )}

                        {/* Edit Student Modal */}
                        {editStudent && (
                            <Modal title="Edit Student" onClose={() => setEditStudent(null)}>
                                <form onSubmit={saveEdit} className="space-y-4">
                                    <Field label="Register Number" required>
                                        <Input value={editStudent.register_number} onChange={(e) => setEditStudent({ ...editStudent, register_number: e.target.value })} required />
                                    </Field>
                                    <Field label="Name" required>
                                        <Input value={editStudent.name} onChange={(e) => setEditStudent({ ...editStudent, name: e.target.value })} required />
                                    </Field>
                                    <Field label="Date of Birth">
                                        <Input type="date" value={editStudent.date_of_birth} onChange={(e) => setEditStudent({ ...editStudent, date_of_birth: e.target.value })} />
                                    </Field>
                                    <Field label="Status">
                                        <Select value={editStudent.status} onChange={(e) => setEditStudent({ ...editStudent, status: e.target.value })}>
                                            <option value="ACTIVE">Active</option>
                                            <option value="INACTIVE">Inactive</option>
                                            <option value="GRADUATED">Graduated</option>
                                            <option value="TRANSFERRED">Transferred</option>
                                        </Select>
                                    </Field>
                                    <div className="flex gap-3 justify-end pt-2">
                                        <Btn variant="secondary" type="button" onClick={() => setEditStudent(null)}>Cancel</Btn>
                                        <Btn type="submit">Save Changes</Btn>
                                    </div>
                                </form>
                            </Modal>
                        )}

                        {/* Deactivate confirm */}
                        {deactivateTarget && (
                            <ConfirmModal
                                title="Deactivate Student"
                                message={`Deactivate ${deactivateTarget.name} (${deactivateTarget.register_number})? They will lose login access but their records will be preserved.`}
                                confirmLabel="Deactivate"
                                onClose={() => setDeactivateTarget(null)}
                                onConfirm={() => { deactivate(deactivateTarget); setDeactivateTarget(null); }}
                            />
                        )}

                        {/* Permanent delete */}
                        {deleteTarget && isSuperAdmin && (
                            <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50">
                                <div className="relative bg-white rounded-2xl border border-gray-200 shadow-2xl w-full max-w-md mx-4 overflow-hidden">
                                    <div className="h-1 bg-red-500 w-full" />
                                    <div className="p-6 space-y-4">
                                        <div className="flex items-start gap-4">
                                            <div className="w-10 h-10 rounded-xl bg-red-50 flex items-center justify-center flex-shrink-0">
                                                <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="#dc2626" strokeWidth="2">
                                                    <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
                                                    <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
                                                </svg>
                                            </div>
                                            <div>
                                                <h2 className="font-display font-bold text-base text-gray-900">Permanent Deletion</h2>
                                                <p className="text-sm text-gray-500 mt-1">
                                                    Permanently delete <strong>{deleteTarget.name}</strong> ({deleteTarget.register_number})? This cannot be undone and will fail if OD or certificate records exist.
                                                </p>
                                            </div>
                                        </div>
                                        <Field label="Reason (optional)">
                                            <Input value={deleteReason} onChange={(e) => setDeleteReason(e.target.value)} placeholder="Reason for deletion…" />
                                        </Field>
                                        <div className="flex gap-3">
                                            <button onClick={() => { setDeleteTarget(null); setDeleteReason(''); }} className="flex-1 py-2.5 text-sm font-semibold text-gray-700 border border-gray-200 rounded-lg hover:bg-gray-50">Cancel</button>
                                            <button onClick={permanentDelete} className="flex-1 py-2.5 text-sm font-semibold bg-red-600 hover:bg-red-700 text-white rounded-lg shadow-sm">Permanently Delete</button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* ═══════════════════════════════════════════════════════════
                    ORG STRUCTURE TAB
                ═══════════════════════════════════════════════════════════ */}
                {activeTab === 'Org Structure' && isAdmin && (
                    <div className="grid md:grid-cols-3 gap-5">
                        {/* Departments */}
                        <SectionCard title="Departments" action={
                            <span className="text-xs text-gray-400">{departments.length} total</span>
                        }>
                            <div className="p-5 space-y-4">
                                <form onSubmit={submitDept} className="space-y-3">
                                    <Field label="Name" required><Input placeholder="e.g. Computer Science" value={deptForm.name} onChange={(e) => setDeptForm({ ...deptForm, name: e.target.value })} required /></Field>
                                    <Field label="Code" required><Input placeholder="e.g. CSE" value={deptForm.code} onChange={(e) => setDeptForm({ ...deptForm, code: e.target.value })} required /></Field>
                                    <Btn type="submit" className="w-full justify-center">Create Department</Btn>
                                </form>
                                <div className="border-t border-gray-100 pt-3 space-y-1 max-h-48 overflow-y-auto">
                                    {orgLoading ? <LoadingState message="" /> : departments.length === 0 ? (
                                        <p className="text-sm text-gray-400 text-center py-4">No departments yet.</p>
                                    ) : departments.map((d) => (
                                        <div key={d.id} className="flex items-center justify-between py-2 px-1">
                                            <span className="text-sm text-gray-900">{d.name}</span>
                                            <span className="text-xs font-mono text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">{d.code}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </SectionCard>

                        {/* Academic Years */}
                        <SectionCard title="Academic Years" action={
                            <span className="text-xs text-gray-400">{academicYears.length} total</span>
                        }>
                            <div className="p-5 space-y-4">
                                <form onSubmit={submitYear} className="space-y-3">
                                    <Field label="Name" required><Input placeholder="e.g. 2026-27" value={yearForm.name} onChange={(e) => setYearForm({ ...yearForm, name: e.target.value })} required /></Field>
                                    <Field label="Start Date"><Input type="date" value={yearForm.start_date} onChange={(e) => setYearForm({ ...yearForm, start_date: e.target.value })} /></Field>
                                    <Field label="End Date"><Input type="date" value={yearForm.end_date} onChange={(e) => setYearForm({ ...yearForm, end_date: e.target.value })} /></Field>
                                    <Btn type="submit" className="w-full justify-center">Create Academic Year</Btn>
                                </form>
                                <div className="border-t border-gray-100 pt-3 space-y-1 max-h-48 overflow-y-auto">
                                    {orgLoading ? <LoadingState message="" /> : academicYears.length === 0 ? (
                                        <p className="text-sm text-gray-400 text-center py-4">No academic years yet.</p>
                                    ) : academicYears.map((y) => (
                                        <div key={y.id} className="flex items-center justify-between py-2 px-1">
                                            <span className="text-sm text-gray-900">{y.name}</span>
                                            {y.active && <Badge variant="active" label="Active" />}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </SectionCard>

                        {/* Classes */}
                        <SectionCard title="Classes" action={
                            <span className="text-xs text-gray-400">{classes.length} total</span>
                        }>
                            <div className="p-5 space-y-4">
                                <form onSubmit={submitClass} className="space-y-3">
                                    <Field label="Department" required>
                                        <Select value={classForm.department_id} onChange={(e) => setClassForm({ ...classForm, department_id: e.target.value })} required>
                                            <option value="">Select…</option>
                                            {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                                        </Select>
                                    </Field>
                                    <Field label="Academic Year" required>
                                        <Select value={classForm.academic_year_id} onChange={(e) => setClassForm({ ...classForm, academic_year_id: e.target.value })} required>
                                            <option value="">Select…</option>
                                            {academicYears.map((y) => <option key={y.id} value={y.id}>{y.name}</option>)}
                                        </Select>
                                    </Field>
                                    <Field label="Year of Study" required><Input placeholder="e.g. 2nd Year" value={classForm.year_of_study} onChange={(e) => setClassForm({ ...classForm, year_of_study: e.target.value })} required /></Field>
                                    <Field label="Section" required><Input placeholder="e.g. A" value={classForm.section} onChange={(e) => setClassForm({ ...classForm, section: e.target.value })} required /></Field>
                                    <Field label="Display Name" required><Input placeholder="e.g. ADS-A" value={classForm.display_name} onChange={(e) => setClassForm({ ...classForm, display_name: e.target.value })} required /></Field>
                                    <Btn type="submit" className="w-full justify-center">Create Class</Btn>
                                </form>
                                <div className="border-t border-gray-100 pt-3 space-y-1 max-h-48 overflow-y-auto">
                                    {orgLoading ? <LoadingState message="" /> : classes.length === 0 ? (
                                        <p className="text-sm text-gray-400 text-center py-4">No classes yet.</p>
                                    ) : classes.map((c) => (
                                        <div key={c.id} className="py-2 px-1">
                                            <p className="text-sm font-medium text-gray-900">{c.display_name}</p>
                                            <p className="text-xs text-gray-400">{c.department_name} · {c.academic_year_name}</p>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </SectionCard>
                    </div>
                )}

                {/* ═══════════════════════════════════════════════════════════
                    ADVISORS TAB
                ═══════════════════════════════════════════════════════════ */}
                {activeTab === 'Advisors' && isAdmin && (
                    <div className="space-y-5">
                        <SectionCard title="Assign / Replace Class Advisor">
                            <div className="p-5">
                                <form onSubmit={assignAdvisor} className="grid md:grid-cols-4 gap-4">
                                    <Field label="Class" required>
                                        <Select value={advisorClassSel} onChange={(e) => setAdvisorClassSel(e.target.value)} required>
                                            <option value="">Select class…</option>
                                            {classes.map((c) => <option key={c.id} value={c.id}>{c.display_name}</option>)}
                                        </Select>
                                    </Field>
                                    <Field label="Faculty" required>
                                        <Select value={advisorUserSel} onChange={(e) => setAdvisorUserSel(e.target.value)} required>
                                            <option value="">Select faculty…</option>
                                            {allFaculty.map((f) => <option key={f.user_id} value={f.user_id}>{f.username} ({f.role})</option>)}
                                        </Select>
                                    </Field>
                                    <Field label="Reason">
                                        <Input placeholder="Optional reason" value={advisorReason} onChange={(e) => setAdvisorReason(e.target.value)} />
                                    </Field>
                                    <div className="flex items-end"><Btn type="submit" className="w-full justify-center">Assign</Btn></div>
                                </form>
                            </div>
                        </SectionCard>

                        <SectionCard title="Advisor History" action={
                            <div className="flex items-center gap-2">
                                <Select value={advisorClassSel} onChange={(e) => setAdvisorClassSel(e.target.value)} className="!w-auto">
                                    <option value="">Select class…</option>
                                    {classes.map((c) => <option key={c.id} value={c.id}>{c.display_name}</option>)}
                                </Select>
                                <Btn size="sm" variant="secondary" onClick={loadAdvisorHistory} disabled={!advisorClassSel || advisorHistLoading}>
                                    {advisorHistLoading ? 'Loading…' : 'Load'}
                                </Btn>
                            </div>
                        }>
                            {advisorHistLoading ? <LoadingState message="Loading history…" /> : advisorHistory.length === 0 ? (
                                <EmptyState title="No history loaded" description="Select a class and click Load." />
                            ) : (
                                <div className="divide-y divide-gray-100">
                                    {advisorHistory.map((h) => (
                                        <div key={h.id} className="flex items-center gap-4 px-5 py-3.5">
                                            <div className={`w-2 h-2 rounded-full flex-shrink-0 ${h.unassigned_at ? 'bg-gray-300' : 'bg-green-500'}`} />
                                            <div className="flex-1">
                                                <p className="text-sm font-semibold text-gray-900">{h.username}
                                                    <span className={`ml-2 text-xs font-medium ${h.unassigned_at ? 'text-gray-400' : 'text-green-600'}`}>
                                                        {h.unassigned_at ? 'Former' : 'Active'}
                                                    </span>
                                                </p>
                                                <p className="text-xs text-gray-400">
                                                    Assigned {new Date(h.assigned_at).toLocaleDateString()}
                                                    {h.unassigned_at && ` · Removed ${new Date(h.unassigned_at).toLocaleDateString()}`}
                                                    {h.reason && ` · ${h.reason}`}
                                                </p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </SectionCard>
                    </div>
                )}

                {/* ═══════════════════════════════════════════════════════════
                    REPRESENTATIVES TAB
                ═══════════════════════════════════════════════════════════ */}
                {activeTab === 'Representatives' && (
                    <div className="space-y-5">
                        <div className="flex items-center gap-3">
                            <Select value={crClassSel} onChange={(e) => setCrClassSel(e.target.value)} className="!w-auto min-w-[200px]">
                                <option value="">Select class…</option>
                                {classes.map((c) => <option key={c.id} value={c.id}>{c.display_name}</option>)}
                            </Select>
                        </div>

                        {crClassSel ? (
                            crLoading ? <LoadingState message="Loading class data…" /> : (
                                <div className="grid md:grid-cols-2 gap-5">
                                    {/* Assign CR */}
                                    <SectionCard title="Assign Class Representative">
                                        <div className="p-5 space-y-4">
                                            <Field label="Active student">
                                                <Select value={crStudentSel} onChange={(e) => setCrStudentSel(e.target.value)}>
                                                    <option value="">Select student…</option>
                                                    {crStudents
                                                        .filter((s) => !crList.some((cr) => cr.student_id === s.student_id))
                                                        .map((s) => <option key={s.student_id} value={s.student_id}>{s.name} ({s.register_number})</option>)
                                                    }
                                                </Select>
                                            </Field>
                                            <Btn disabled={!crStudentSel} onClick={assignCR} className="w-full justify-center">Assign as CR</Btn>
                                        </div>
                                    </SectionCard>

                                    {/* Current CRs */}
                                    <SectionCard title="Current Class Representatives" action={
                                        <span className="text-xs text-gray-400">{crList.length} assigned</span>
                                    }>
                                        {crList.length === 0 ? (
                                            <EmptyState title="No CRs assigned" description="Use the form to assign a student as CR." />
                                        ) : (
                                            <div className="divide-y divide-gray-100">
                                                {crList.map((cr) => (
                                                    <div key={cr.student_id} className="flex items-center justify-between px-5 py-3.5">
                                                        <div>
                                                            <p className="text-sm font-semibold text-gray-900">{cr.name}</p>
                                                            <p className="text-xs font-mono text-gray-400">{cr.register_number}</p>
                                                        </div>
                                                        <div className="flex items-center gap-2">
                                                            <button onClick={() => createCRAccount(cr.student_id)} className="px-2.5 py-1.5 text-xs font-medium text-indigo-600 border border-indigo-200 rounded-md hover:bg-indigo-50 transition-colors">
                                                                Create Login
                                                            </button>
                                                            <button onClick={() => removeCR(cr.student_id)} className="px-2.5 py-1.5 text-xs font-medium text-red-600 border border-red-200 rounded-md hover:bg-red-50 transition-colors">
                                                                Remove
                                                            </button>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </SectionCard>
                                </div>
                            )
                        ) : (
                            <EmptyState title="Select a class" description="Choose a class above to manage its Class Representatives." />
                        )}
                    </div>
                )}

                {/* ═══════════════════════════════════════════════════════════
                    BULK IMPORT TAB
                ═══════════════════════════════════════════════════════════ */}
                {activeTab === 'Bulk Import' && (
                    <div className="max-w-2xl space-y-5">
                        <SectionCard title="Bulk Student Import">
                            <div className="p-5 space-y-5">
                                <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3">
                                    <p className="text-sm text-blue-700">
                                        Upload a <code className="bg-blue-100 px-1 rounded">.xlsx</code> or <code className="bg-blue-100 px-1 rounded">.csv</code> file with columns:
                                        <code className="bg-blue-100 px-1 rounded ml-1">register_number</code>,
                                        <code className="bg-blue-100 px-1 rounded ml-1">name</code>,
                                        <code className="bg-blue-100 px-1 rounded ml-1">date_of_birth</code> (YYYY-MM-DD).
                                    </p>
                                </div>

                                <div className="grid md:grid-cols-2 gap-4">
                                    <Field label="Target Class" required>
                                        <Select value={importClass} onChange={(e) => { setImportClass(e.target.value); setImportPreview(null); setImportSession(null); }} required>
                                            <option value="">Select class…</option>
                                            {classes.map((c) => <option key={c.id} value={c.id}>{c.display_name} · {c.academic_year_name}</option>)}
                                        </Select>
                                    </Field>
                                    <Field label="File (.xlsx or .csv)" required>
                                        <input
                                            type="file"
                                            accept=".xlsx,.csv"
                                            onChange={(e) => { setImportFile(e.target.files[0]); setImportPreview(null); setImportSession(null); }}
                                            className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm text-gray-900 file:mr-3 file:py-1 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"
                                        />
                                    </Field>
                                </div>

                                <Btn
                                    onClick={runPreview}
                                    disabled={!importClass || !importFile || importLoading}
                                    className="w-full justify-center"
                                >
                                    {importLoading && !importPreview ? (
                                        <><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" className="animate-spin"><circle cx="12" cy="12" r="10" strokeOpacity="0.3"/><path d="M12 2a10 10 0 0110 10" strokeLinecap="round"/></svg> Processing…</>
                                    ) : 'Preview Import'}
                                </Btn>
                            </div>
                        </SectionCard>

                        {importPreview && (
                            <SectionCard title="Import Preview">
                                <div className="p-5 space-y-4">
                                    {/* Summary badges */}
                                    <div className="flex flex-wrap gap-3">
                                        <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
                                            <span className="text-xs text-gray-500">Total</span>
                                            <span className="text-sm font-bold text-gray-900">{importPreview.summary.total}</span>
                                        </div>
                                        <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
                                            <span className="text-xs text-green-600">Valid</span>
                                            <span className="text-sm font-bold text-green-700">{importPreview.summary.valid}</span>
                                        </div>
                                        <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                                            <span className="text-xs text-red-500">Duplicates</span>
                                            <span className="text-sm font-bold text-red-600">{importPreview.summary.duplicates}</span>
                                        </div>
                                        <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                                            <span className="text-xs text-amber-600">Invalid</span>
                                            <span className="text-sm font-bold text-amber-700">{importPreview.summary.invalid}</span>
                                        </div>
                                    </div>

                                    {/* Row details */}
                                    <div className="max-h-48 overflow-y-auto border border-gray-200 rounded-lg p-3 space-y-1 bg-gray-50">
                                        {importPreview.rows.filter((r) => r.errors.length > 0).map((r) => (
                                            <p key={r.row_number} className="text-xs text-red-600">
                                                <span className="font-mono font-semibold">Row {r.row_number}:</span> {r.errors.join(', ')}
                                            </p>
                                        ))}
                                        {importPreview.rows.filter((r) => !r.errors.length).slice(0, 5).map((r) => (
                                            <p key={r.row_number} className="text-xs text-green-600">
                                                <span className="font-mono">✓ Row {r.row_number}:</span> {r.name} ({r.register_number})
                                            </p>
                                        ))}
                                        {importPreview.rows.filter((r) => !r.errors.length).length > 5 && (
                                            <p className="text-xs text-gray-400">…and {importPreview.rows.filter((r) => !r.errors.length).length - 5} more valid rows</p>
                                        )}
                                    </div>

                                    {importPreview.summary.valid === importPreview.summary.total && importPreview.summary.valid > 0 ? (
                                        <Btn onClick={runConfirm} disabled={importLoading} className="w-full justify-center">
                                            {importLoading ? (
                                                <><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" className="animate-spin"><circle cx="12" cy="12" r="10" strokeOpacity="0.3"/><path d="M12 2a10 10 0 0110 10" strokeLinecap="round"/></svg> Importing…</>
                                            ) : `Confirm Import (${importPreview.summary.valid} students)`}
                                        </Btn>
                                    ) : (
                                        <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3">
                                            <p className="text-sm text-red-700">Fix the errors above before confirming the import.</p>
                                        </div>
                                    )}
                                </div>
                            </SectionCard>
                        )}
                    </div>
                )}

                {/* ═══════════════════════════════════════════════════════════
                    AUDIT TAB
                ═══════════════════════════════════════════════════════════ */}
                {activeTab === 'Audit' && isSuperAdmin && (
                    <div className="space-y-5">
                        <div className="flex flex-wrap gap-3 items-center">
                            <SearchInput
                                value={auditSearch}
                                onChange={setAuditSearch}
                                placeholder="Filter by actor, action, entity…"
                                className="min-w-[240px]"
                            />
                            <Btn variant="secondary" size="sm" onClick={() => loadAudit(0)}>
                                <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                                    <path d="M23 4v6h-6M1 20v-6h6M20.49 9A9 9 0 005.64 5.64L1 10M23 14l-4.64 4.36A9 9 0 013.51 15"/>
                                </svg>
                                Refresh
                            </Btn>
                        </div>

                        {auditLoading ? <LoadingState message="Loading audit log…" /> : (
                            <SectionCard>
                                <div className="overflow-x-auto">
                                    <table className="w-full">
                                        <thead>
                                            <tr className="bg-gray-50 border-b border-gray-200">
                                                {['Timestamp', 'Actor', 'Action', 'Target', 'Details'].map(col => (
                                                    <th key={col} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">{col}</th>
                                                ))}
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-100">
                                            {filteredAudit.length === 0 ? (
                                                <tr><td colSpan={5}>
                                                    <EmptyState title="No audit records" description="Audit events will appear here as actions are performed." />
                                                </td></tr>
                                            ) : filteredAudit.map((e) => (
                                                <tr
                                                    key={e.id}
                                                    className="hover:bg-gray-50 cursor-pointer transition-colors"
                                                    onClick={() => setAuditDetail(e)}
                                                >
                                                    <td className="px-4 py-3 text-xs font-mono text-gray-500 whitespace-nowrap">{new Date(e.created_at).toLocaleString()}</td>
                                                    <td className="px-4 py-3 text-sm font-medium text-gray-900">{e.actor_username || '—'}</td>
                                                    <td className="px-4 py-3">
                                                        <span className={`inline-flex px-2 py-0.5 rounded-md text-xs font-semibold ${ACTION_COLORS[e.action] || 'bg-gray-50 text-gray-600'}`}>
                                                            {e.action}
                                                        </span>
                                                    </td>
                                                    <td className="px-4 py-3 text-sm text-gray-500 whitespace-nowrap">
                                                        <span className="font-medium text-gray-700">{e.target_entity}</span> #{e.target_id}
                                                    </td>
                                                    <td className="px-4 py-3 text-sm text-gray-400 max-w-[200px] truncate">{e.details || '—'}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                                <Pagination
                                    total={auditPag.total}
                                    perPage={auditPag.limit}
                                    page={Math.floor(auditPag.offset / auditPag.limit) + 1}
                                    onPage={(p) => loadAudit((p - 1) * auditPag.limit)}
                                />
                            </SectionCard>
                        )}
                    </div>
                )}
                {activeTab === 'Audit' && !isSuperAdmin && (
                    <div className="flex items-center justify-center py-16">
                        <div className="text-center">
                            <div className="w-14 h-14 rounded-2xl bg-amber-50 flex items-center justify-center mx-auto mb-4">
                                <svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="#d97706" strokeWidth="1.8">
                                    <rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/>
                                </svg>
                            </div>
                            <p className="text-sm font-semibold text-gray-900">Restricted Access</p>
                            <p className="text-xs text-gray-400 mt-1">Audit log is available to Super Admin only.</p>
                        </div>
                    </div>
                )}
            </div>

            {/* Audit detail modal */}
            {auditDetail && (
                <Modal title="Audit Event Detail" onClose={() => setAuditDetail(null)}>
                    <div className="space-y-3">
                        {[
                            { label: 'Timestamp',  value: new Date(auditDetail.created_at).toLocaleString() },
                            { label: 'Actor',      value: auditDetail.actor_username || '—' },
                            { label: 'Action',     value: auditDetail.action },
                            { label: 'Target',     value: `${auditDetail.target_entity} #${auditDetail.target_id}` },
                            { label: 'Details',    value: auditDetail.details || '—' },
                        ].map(f => (
                            <div key={f.label}>
                                <p className="text-xs text-gray-400 uppercase tracking-wider font-semibold">{f.label}</p>
                                <p className="text-sm text-gray-900 mt-0.5 font-medium">{f.value}</p>
                            </div>
                        ))}
                        {auditDetail.new_data && (
                            <div>
                                <p className="text-xs text-gray-400 uppercase tracking-wider font-semibold">New Data</p>
                                <pre className="text-xs bg-gray-50 border border-gray-200 rounded-lg p-3 mt-1 overflow-x-auto text-gray-700">{JSON.stringify(auditDetail.new_data, null, 2)}</pre>
                            </div>
                        )}
                        {auditDetail.old_data && (
                            <div>
                                <p className="text-xs text-gray-400 uppercase tracking-wider font-semibold">Old Data</p>
                                <pre className="text-xs bg-gray-50 border border-gray-200 rounded-lg p-3 mt-1 overflow-x-auto text-gray-700">{JSON.stringify(auditDetail.old_data, null, 2)}</pre>
                            </div>
                        )}
                    </div>
                </Modal>
            )}
        </div>
    );
};

export default ManagementDashboard;
