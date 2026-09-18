import { useContext, useEffect, useState } from 'react';
import { AuthContext } from '../context/AuthContext';
import managementService from '../services/managementService';

const emptyStudent = { register_number: '', name: '', date_of_birth: '', class_id: '' };

const ManagementDashboard = () => {
    const { user, logout } = useContext(AuthContext);
    const canAdminister = ['admin', 'super_admin'].includes(user?.role);
    const [departments, setDepartments] = useState([]);
    const [academicYears, setAcademicYears] = useState([]);
    const [classes, setClasses] = useState([]);
    const [students, setStudents] = useState([]);
    const [faculty, setFaculty] = useState([]);
    const [selectedClass, setSelectedClass] = useState('');
    const [student, setStudent] = useState(emptyStudent);
    const [departmentForm, setDepartmentForm] = useState({ name: '', code: '' });
    const [yearForm, setYearForm] = useState({ name: '', start_date: '', end_date: '' });
    const [classForm, setClassForm] = useState({ department_id: '', academic_year_id: '', year_of_study: '', section: '', display_name: '' });
    const [file, setFile] = useState(null);
    const [preview, setPreview] = useState(null);
    const [message, setMessage] = useState('');
    const [error, setError] = useState('');

    const load = async () => {
        try {
            const [departmentResult, yearResult, classResult, studentResult] = await Promise.all([
                managementService.getDepartments(),
                managementService.getAcademicYears(),
                managementService.getClasses(),
                managementService.getStudents(),
            ]);
            setDepartments(departmentResult.data || []);
            setAcademicYears(yearResult.data || []);
            setClasses(classResult.data || []);
            setStudents(studentResult.data || []);
        } catch (requestError) { setError(requestError?.response?.data?.error || 'Unable to load management data.'); }
    };

    useEffect(() => { load(); }, []);

    const run = async (operation, success) => {
        setError(''); setMessage('');
        try { await operation(); setMessage(success); await load(); } catch (requestError) { setError(requestError?.response?.data?.error || 'Operation failed.'); }
    };

    const submitStudent = (event) => {
        event.preventDefault();
        run(() => managementService.createStudent(student), 'Student added and login account created.');
        setStudent(emptyStudent);
    };

    const selectClass = (value) => {
        setSelectedClass(value);
        setStudent((current) => ({ ...current, class_id: value }));
    };

    const previewFile = async () => {
        setError(''); setMessage('');
        try { setPreview(await managementService.previewImport(selectedClass, file)); } catch (requestError) { setError(requestError?.response?.data?.error || 'Import preview failed.'); }
    };

    const confirmImport = () => run(
        () => managementService.confirmImport(selectedClass, preview.rows),
        `${preview.summary.valid} students imported successfully.`,
    ).then(() => setPreview(null));

    const addDepartment = (event) => { event.preventDefault(); run(() => managementService.createDepartment(departmentForm), 'Department created.'); setDepartmentForm({ name: '', code: '' }); };
    const addYear = (event) => { event.preventDefault(); run(() => managementService.createAcademicYear(yearForm), 'Academic year created.'); setYearForm({ name: '', start_date: '', end_date: '' }); };
    const addClass = (event) => { event.preventDefault(); run(() => managementService.createClass(classForm), 'Class created.'); };

    return (
        <div className="container-main p-6">
            <div className="max-w-6xl mx-auto">
                <header className="flex justify-between items-center mb-6">
                    <div><p className="text-sm uppercase tracking-wide text-blue-700">Management</p><h1 className="text-3xl font-bold text-gray-900">{canAdminister ? 'Administration' : 'My Classes'}</h1><p className="text-gray-600">{user?.username}</p></div>
                    <button className="btn-secondary" onClick={logout}>Logout</button>
                </header>
                {message && <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded mb-4">{message}</div>}
                {error && <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">{error}</div>}

                {canAdminister && <section className="grid md:grid-cols-3 gap-4 mb-6">
                    <form className="card space-y-3" onSubmit={addDepartment}><h2 className="font-bold">Departments</h2><input className="form-input" placeholder="Name" value={departmentForm.name} onChange={(event) => setDepartmentForm({ ...departmentForm, name: event.target.value })} required /><input className="form-input" placeholder="Code" value={departmentForm.code} onChange={(event) => setDepartmentForm({ ...departmentForm, code: event.target.value })} required /><button className="btn-primary" type="submit">Create Department</button></form>
                    <form className="card space-y-3" onSubmit={addYear}><h2 className="font-bold">Academic Years</h2><input className="form-input" placeholder="2026-27" value={yearForm.name} onChange={(event) => setYearForm({ ...yearForm, name: event.target.value })} required /><input className="form-input" type="date" value={yearForm.start_date} onChange={(event) => setYearForm({ ...yearForm, start_date: event.target.value })} /><input className="form-input" type="date" value={yearForm.end_date} onChange={(event) => setYearForm({ ...yearForm, end_date: event.target.value })} /><button className="btn-primary" type="submit">Create Academic Year</button></form>
                    <form className="card space-y-3" onSubmit={addClass}><h2 className="font-bold">Classes</h2><select className="form-input" value={classForm.department_id} onChange={(event) => setClassForm({ ...classForm, department_id: event.target.value })} required><option value="">Department</option>{departments.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select><select className="form-input" value={classForm.academic_year_id} onChange={(event) => setClassForm({ ...classForm, academic_year_id: event.target.value })} required><option value="">Academic year</option>{academicYears.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select><input className="form-input" placeholder="Year of study" value={classForm.year_of_study} onChange={(event) => setClassForm({ ...classForm, year_of_study: event.target.value })} required /><input className="form-input" placeholder="Section" value={classForm.section} onChange={(event) => setClassForm({ ...classForm, section: event.target.value })} required /><input className="form-input" placeholder="Display name, e.g. ADS-A" value={classForm.display_name} onChange={(event) => setClassForm({ ...classForm, display_name: event.target.value })} required /><button className="btn-primary" type="submit">Create Class</button></form>
                </section>}

                <section className="card mb-6"><div className="flex justify-between items-center mb-4"><h2 className="text-xl font-bold">Student Management</h2><span className="text-sm text-gray-500">{students.length} visible</span></div><form onSubmit={submitStudent} className="grid md:grid-cols-5 gap-3 mb-5"><input className="form-input" placeholder="Register number" value={student.register_number} onChange={(event) => setStudent({ ...student, register_number: event.target.value })} required /><input className="form-input" placeholder="Name" value={student.name} onChange={(event) => setStudent({ ...student, name: event.target.value })} required /><input className="form-input" type="date" value={student.date_of_birth} onChange={(event) => setStudent({ ...student, date_of_birth: event.target.value })} required /><select className="form-input" value={student.class_id} onChange={(event) => selectClass(event.target.value)} required><option value="">Class</option>{classes.map((item) => <option key={item.id} value={item.id}>{item.display_name} · {item.academic_year_name}</option>)}</select><button className="btn-primary" type="submit">Add Student</button></form><div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr className="border-b"><th className="py-2">Register</th><th>Name</th><th>Class</th><th>Status</th></tr></thead><tbody>{students.map((item) => <tr className="border-b" key={item.student_id}><td className="py-2">{item.register_number}</td><td>{item.name}</td><td>{item.display_name}</td><td>{item.status}</td></tr>)}</tbody></table></div></section>

                <section className="card mb-6"><h2 className="text-xl font-bold mb-3">Bulk Import</h2><p className="text-sm text-gray-600 mb-3">Select a class before uploading an `.xlsx` or `.csv` file with `register_number`, `name`, and `date_of_birth` columns.</p><div className="flex flex-wrap gap-3 items-center"><select className="form-input" value={selectedClass} onChange={(event) => setSelectedClass(event.target.value)}><option value="">Target class</option>{classes.map((item) => <option key={item.id} value={item.id}>{item.display_name} · {item.academic_year_name}</option>)}</select><input type="file" accept=".xlsx,.csv" onChange={(event) => setFile(event.target.files[0])} /><button className="btn-primary" onClick={previewFile} disabled={!selectedClass || !file}>Preview Import</button></div>{preview && <div className="mt-4 border-t pt-4"><p>Total: {preview.summary.total} · Valid: {preview.summary.valid} · Duplicates: {preview.summary.duplicates} · Invalid: {preview.summary.invalid}</p>{preview.summary.valid === preview.summary.total && <button className="btn-primary mt-3" onClick={confirmImport}>Confirm Import</button>}<div className="mt-3 max-h-40 overflow-auto text-sm">{preview.rows.filter((row) => row.errors.length).map((row) => <p key={row.row_number} className="text-red-700">Row {row.row_number}: {row.errors.join(', ')}</p>)}</div></div>}</section>

                <section className="card"><h2 className="text-xl font-bold mb-3">Classes</h2><div className="grid md:grid-cols-3 gap-3">{classes.map((item) => <div className="border p-3" key={item.id}><strong>{item.display_name}</strong><p className="text-sm text-gray-600">{item.department_name} · {item.academic_year_name}</p></div>)}</div></section>
            </div>
        </div>
    );
};

export default ManagementDashboard;
