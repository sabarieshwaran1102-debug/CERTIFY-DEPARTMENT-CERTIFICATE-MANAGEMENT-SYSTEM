import { useContext, useEffect, useState } from 'react';
import { AuthContext } from '../context/AuthContext';
import studentService from '../services/studentService';
import certService from '../services/certService';

const StudentDashboard = () => {
    const { user, logout } = useContext(AuthContext);
    const [profile, setProfile] = useState(null);
    const [odRecords, setOdRecords] = useState([]);
    const [certificates, setCertificates] = useState([]);
    const [form, setForm] = useState({ registration_number: '', file: null });
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState('');

    const loadData = async () => {
        try {
            setLoading(true);
            const [studentInfo, odResult, certResult] = await Promise.all([
                studentService.getMyInfo(),
                studentService.getMyODRecords(),
                studentService.getMyCertificates(),
            ]);

            setProfile(studentInfo);
            setOdRecords(odResult?.data || []);
            setCertificates(certResult?.data || []);
        } catch (err) {
            setError(err?.error || err?.message || 'Unable to load student data.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadData();
    }, []);

    const handleChange = (event) => {
        const { name, value, files } = event.target;
        setForm((prev) => ({
            ...prev,
            [name]: files ? files[0] : value,
        }));
    };

    const handleSubmit = async (event) => {
        event.preventDefault();
        setSubmitting(true);
        setError('');

        try {
            await certService.submitCertificate(form.registration_number, form.file);
            setForm({ registration_number: '', file: null });
            await loadData();
        } catch (err) {
            setError(err?.error || err?.message || 'Certificate submission failed.');
        } finally {
            setSubmitting(false);
        }
    };

    const handleDownload = async (certId) => {
        try {
            const blob = await certService.downloadCertificate(certId);
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `certificate-${certId}.pdf`;
            document.body.appendChild(a);
            a.click();
            a.remove();
            window.URL.revokeObjectURL(url);
        } catch (err) {
            setError(err?.error || err?.message || 'Download failed.');
        }
    };

    return (
        <div className="container-main p-6">
            <div className="max-w-7xl mx-auto">
                <div className="flex justify-between items-center mb-6">
                    <div>
                        <h1 className="text-3xl font-bold text-gray-900">Student Dashboard</h1>
                        <p className="text-gray-600">Welcome, {user?.username || 'Student'}</p>
                    </div>
                    <button className="btn-secondary" onClick={logout}>Logout</button>
                </div>

                {error && (
                    <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-6">
                        {error}
                    </div>
                )}

                {loading ? (
                    <div className="card">Loading student data...</div>
                ) : (
                    <>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                            <div className="card">
                                <p className="text-sm text-gray-500">Register Number</p>
                                <p className="text-2xl font-bold">{profile?.register_number || 'N/A'}</p>
                            </div>
                            <div className="card">
                                <p className="text-sm text-gray-500">Department</p>
                                <p className="text-2xl font-bold">{profile?.department || 'N/A'}</p>
                            </div>
                            <div className="card">
                                <p className="text-sm text-gray-500">Year / Section</p>
                                <p className="text-2xl font-bold">{profile?.year || 'N/A'} / {profile?.section || 'N/A'}</p>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            <div className="card">
                                <h2 className="text-xl font-bold mb-4">Submit Certificate</h2>
                                <form onSubmit={handleSubmit} className="space-y-4">
                                    <div>
                                        <label className="form-label">OD Registration Number</label>
                                        <input
                                            type="text"
                                            name="registration_number"
                                            className="form-input"
                                            value={form.registration_number}
                                            onChange={handleChange}
                                            placeholder="OD-0001"
                                            required
                                        />
                                    </div>
                                    <div>
                                        <label className="form-label">Certificate File</label>
                                        <input
                                            type="file"
                                            name="file"
                                            className="form-input"
                                            onChange={handleChange}
                                            accept=".pdf,.jpg,.jpeg,.png"
                                            required
                                        />
                                    </div>
                                    <button className="btn-primary w-full" type="submit" disabled={submitting}>
                                        {submitting ? 'Submitting...' : 'Submit Certificate'}
                                    </button>
                                </form>
                            </div>

                            <div className="card">
                                <h2 className="text-xl font-bold mb-4">My OD Records</h2>
                                <div className="space-y-3 max-h-[400px] overflow-auto">
                                    {odRecords.length === 0 ? (
                                        <p className="text-gray-500">No OD records found.</p>
                                    ) : (
                                        odRecords.map((record) => (
                                            <div key={record.od_id} className="border rounded-md p-3">
                                                <div className="flex justify-between items-center">
                                                    <strong>{record.registration_number}</strong>
                                                    <span className="text-sm text-gray-500">{record.od_status}</span>
                                                </div>
                                                <p className="text-sm text-gray-600 mt-1">{record.event_details}</p>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>
                        </div>

                        <div className="card mt-8">
                            <h2 className="text-xl font-bold mb-4">Certificate History</h2>
                            <div className="space-y-3">
                                {certificates.length === 0 ? (
                                    <p className="text-gray-500">No certificates submitted yet.</p>
                                ) : (
                                    certificates.map((certificate) => (
                                        <div key={certificate.certificate_id} className="flex justify-between items-center border-b py-3">
                                            <div>
                                                <p className="font-semibold">{certificate.file_name}</p>
                                                <p className="text-sm text-gray-500">Submitted: {certificate.submitted_at || 'N/A'}</p>
                                            </div>
                                            <button
                                                className="btn-primary"
                                                onClick={() => handleDownload(certificate.certificate_id)}
                                            >
                                                Download
                                            </button>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};

export default StudentDashboard;
