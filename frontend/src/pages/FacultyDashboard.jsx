import { useContext, useEffect, useState } from 'react';
import { AuthContext } from '../context/AuthContext';
import odService from '../services/odService';
import certService from '../services/certService';
import reportService from '../services/reportService';
import userService from '../services/userService';

const FacultyDashboard = () => {
    const { user, logout } = useContext(AuthContext);
    const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
    const [summary, setSummary] = useState(null);
    const [odRecords, setOdRecords] = useState([]);
    const [certificates, setCertificates] = useState([]);
    const [loading, setLoading] = useState(true);
    const [working, setWorking] = useState('');
    const [error, setError] = useState('');
    const [representatives, setRepresentatives] = useState([]);
    const [representativeUsername, setRepresentativeUsername] = useState('');
    const [representativePassword, setRepresentativePassword] = useState('');

    const loadData = async () => {
        setLoading(true);
        setError('');
        try {
            const [summaryResult, odResult, certificateResult, representativesResult] = await Promise.all([
                reportService.getMonthlySummary(month),
                odService.getODRecords({ month }),
                certService.getCertificates({ submission_month: month }),
                userService.getRepresentatives(),
            ]);
            setSummary(summaryResult);
            setOdRecords(odResult?.data || []);
            setCertificates(certificateResult?.data || []);
            setRepresentatives(representativesResult?.data || []);
        } catch (err) {
            setError(err?.error || err?.message || 'Unable to load faculty records.');
        } finally {
            setLoading(false);
        }
    };

    const createRepresentative = async (event) => {
        event.preventDefault();
        setError('');
        try {
            await userService.createRepresentative(representativeUsername, representativePassword);
            setRepresentativeUsername('');
            setRepresentativePassword('');
            await loadData();
        } catch (requestError) {
            setError(requestError?.error || 'Unable to create representative account.');
        }
    };

    useEffect(() => {
        loadData();
    }, [month]);

    const downloadBlob = (blob, filename) => {
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.URL.revokeObjectURL(url);
    };

    const downloadExcel = async () => {
        setWorking('excel');
        try {
            const response = await reportService.generateExcelReport(month);
            downloadBlob(response.data, `od-report-${month}.xlsx`);
        } catch (err) {
            setError(err?.error || err?.message || 'Excel report download failed.');
        } finally {
            setWorking('');
        }
    };

    const downloadZip = async () => {
        setWorking('zip');
        try {
            const response = await reportService.downloadCertificatesZip(month);
            downloadBlob(response.data, `certificates-${month}.zip`);
        } catch (err) {
            setError(err?.error || err?.message || 'Certificate ZIP download failed.');
        } finally {
            setWorking('');
        }
    };

    const downloadCertificate = async (certificateId, fileName) => {
        setWorking(`certificate-${certificateId}`);
        try {
            const blob = await certService.downloadCertificate(certificateId);
            downloadBlob(blob, fileName);
        } catch (err) {
            setError(err?.error || err?.message || 'Certificate download failed.');
        } finally {
            setWorking('');
        }
    };

    return (
        <div className="container-main p-6">
            <div className="max-w-5xl mx-auto">
                <div className="flex justify-between items-center mb-6">
                    <div>
                        <h1 className="text-3xl font-bold text-gray-900">Coordinating Faculty Dashboard</h1>
                        <p className="text-gray-600">Welcome, {user?.username || 'Faculty'}</p>
                    </div>
                    <button className="btn-secondary" onClick={logout}>Logout</button>
                </div>

                {error && <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-6">{error}</div>}

                <div className="card mb-6">
                    <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
                        <div>
                            <label className="form-label" htmlFor="report-month">Reporting month</label>
                            <input id="report-month" type="month" className="form-input" value={month} onChange={(event) => setMonth(event.target.value)} />
                        </div>
                        <div className="flex flex-wrap gap-3">
                            <button className="btn-primary" onClick={downloadExcel} disabled={working !== ''}>Download Excel</button>
                            <button className="btn-secondary" onClick={downloadZip} disabled={working !== ''}>Download Certificates ZIP</button>
                        </div>
                    </div>
                </div>

                <div className="card mb-8">
                    <h2 className="text-xl font-bold mb-4">Student Representatives</h2>
                    <form onSubmit={createRepresentative} className="grid gap-4 md:grid-cols-3 mb-4">
                        <input className="form-input" value={representativeUsername} onChange={(event) => setRepresentativeUsername(event.target.value)} placeholder="Username" required />
                        <input className="form-input" type="password" value={representativePassword} onChange={(event) => setRepresentativePassword(event.target.value)} placeholder="Password" minLength="8" required />
                        <button className="btn-primary" type="submit">Create Representative</button>
                    </form>
                    <div className="space-y-2">
                        {representatives.map((account) => <div key={account.user_id} className="border-b py-2">{account.username} ({account.is_active ? 'Active' : 'Inactive'})</div>)}
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="card">
                        <p className="text-sm text-gray-500">Total OD records</p>
                        <p className="text-2xl font-bold">{summary?.total_od_records ?? (loading ? '...' : 0)}</p>
                    </div>
                    <div className="card">
                        <p className="text-sm text-gray-500">Certificates submitted</p>
                        <p className="text-2xl font-bold">{summary?.certificates_submitted ?? (loading ? '...' : 0)}</p>
                    </div>
                    <div className="card">
                        <p className="text-sm text-gray-500">Certificates missing</p>
                        <p className="text-2xl font-bold">{summary?.certificates_missing ?? (loading ? '...' : 0)}</p>
                    </div>
                </div>

                <div className="card mt-8">
                    <h2 className="text-xl font-bold mb-4">OD records for {month}</h2>
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm">
                            <thead><tr className="border-b"><th className="py-2">Registration</th><th>Student</th><th>Event</th><th>Status</th></tr></thead>
                            <tbody>
                                {odRecords.map((record) => <tr key={record.od_id} className="border-b"><td className="py-2 font-semibold">{record.registration_number}</td><td>{record.student_id}</td><td>{record.event_details}</td><td>{record.od_status}</td></tr>)}
                            </tbody>
                        </table>
                        {!loading && odRecords.length === 0 && <p className="text-gray-500 py-4">No OD records for this month.</p>}
                    </div>
                </div>

                <div className="card mt-8">
                    <h2 className="text-xl font-bold mb-4">Submitted certificates for {month}</h2>
                    <div className="space-y-3">
                        {certificates.map((certificate) => <div key={certificate.certificate_id} className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2 border-b py-3">
                            <div><p className="font-semibold">{certificate.register_number} / {certificate.file_name}</p><p className="text-sm text-gray-500">OD: {certificate.registration_number || certificate.od_id} | Submitted: {certificate.submitted_at}</p></div>
                            <button className="btn-primary" onClick={() => downloadCertificate(certificate.certificate_id, certificate.file_name)} disabled={working !== ''}>Download</button>
                        </div>)}
                        {!loading && certificates.length === 0 && <p className="text-gray-500">No submitted certificates for this month.</p>}
                    </div>
                </div>

                <div className="card mt-8">
                    <h2 className="text-xl font-bold mb-4">Missing certificates</h2>
                    <div className="space-y-2">
                        {(summary?.missing_records || []).map((record) => <div key={record.od_id} className="border-b py-2"><strong>{record.registration_number}</strong> <span className="text-gray-600">{record.register_number} - {record.student_name}</span></div>)}
                        {!loading && (summary?.missing_records || []).length === 0 && <p className="text-gray-500">No missing certificates identified for this month.</p>}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default FacultyDashboard;
