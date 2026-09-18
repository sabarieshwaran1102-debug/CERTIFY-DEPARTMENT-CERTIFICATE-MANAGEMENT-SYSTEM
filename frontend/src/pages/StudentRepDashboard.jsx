import { useContext, useEffect, useState } from 'react';
import { AuthContext } from '../context/AuthContext';
import studentService from '../services/studentService';
import odService from '../services/odService';

const StudentRepDashboard = () => {
    const { user, logout } = useContext(AuthContext);
    const [searchText, setSearchText] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [selectedStudent, setSelectedStudent] = useState(null);
    const [eventDetails, setEventDetails] = useState('');
    const [records, setRecords] = useState([]);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [loading, setLoading] = useState(false);

    const loadRecords = async () => {
        try {
            const result = await odService.getODRecords();
            setRecords(result?.data || []);
        } catch (err) {
            setError(err?.error || err?.message || 'Unable to load OD records.');
        }
    };

    useEffect(() => {
        loadRecords();
    }, []);

    const handleSearch = async (event) => {
        event.preventDefault();
        setError('');
        setSuccess('');

        try {
            const result = await studentService.searchStudents(searchText, 20, 0);
            setSearchResults(result?.data || []);
            if ((result?.data || []).length === 0) {
                setSuccess('No student matches found.');
            }
        } catch (err) {
            setError(err?.error || err?.message || 'Search failed.');
        }
    };

    const handleSubmit = async (event) => {
        event.preventDefault();
        setError('');
        setSuccess('');

        if (!selectedStudent) {
            setError('Please select a student first.');
            return;
        }

        try {
            const result = await odService.registerOD(selectedStudent.student_id, eventDetails);
            setSuccess(`OD registered successfully: ${result.registration_number}`);
            setSelectedStudent(null);
            setEventDetails('');
            setSearchText('');
            setSearchResults([]);
            await loadRecords();
        } catch (err) {
            setError(err?.error || err?.message || 'OD registration failed.');
        }
    };

    return (
        <div className="container-main p-6">
            <div className="max-w-7xl mx-auto">
                <div className="flex justify-between items-center mb-6">
                    <div>
                        <h1 className="text-3xl font-bold text-gray-900">Student Representative Dashboard</h1>
                        <p className="text-gray-600">Welcome, {user?.username || 'Representative'}</p>
                    </div>
                    <button className="btn-secondary" onClick={logout}>Logout</button>
                </div>

                {error && (
                    <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-6">
                        {error}
                    </div>
                )}

                {success && (
                    <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded mb-6">
                        {success}
                    </div>
                )}

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <div className="card">
                        <h2 className="text-xl font-bold mb-4">Select Student</h2>
                        <form onSubmit={handleSearch} className="space-y-4">
                            <div>
                                <label className="form-label">Search by register number or name</label>
                                <input
                                    type="text"
                                    className="form-input"
                                    value={searchText}
                                    onChange={(e) => setSearchText(e.target.value)}
                                    placeholder="Example: 22AD001 or Alice"
                                />
                            </div>
                            <button type="submit" className="btn-primary" disabled={loading}>
                                Search
                            </button>
                        </form>

                        <div className="mt-4 space-y-2 max-h-64 overflow-auto">
                            {searchResults.length === 0 ? (
                                <p className="text-gray-500">No students selected yet.</p>
                            ) : (
                                searchResults.map((student) => (
                                    <button
                                        key={student.student_id}
                                        type="button"
                                        className={`w-full text-left border rounded-md p-3 ${selectedStudent?.student_id === student.student_id ? 'bg-blue-50 border-blue-300' : 'bg-white'}`}
                                        onClick={() => setSelectedStudent(student)}
                                    >
                                        <div className="font-semibold">{student.name}</div>
                                        <div className="text-sm text-gray-600">{student.register_number} · {student.department} · {student.year} / {student.section}</div>
                                    </button>
                                ))
                            )}
                        </div>
                    </div>

                    <div className="card">
                        <h2 className="text-xl font-bold mb-4">Register OD</h2>
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div>
                                <label className="form-label">Selected Student</label>
                                <div className="form-input bg-gray-50">
                                    {selectedStudent ? `${selectedStudent.name} (${selectedStudent.register_number})` : 'No student selected'}
                                </div>
                            </div>
                            <div>
                                <label className="form-label">Event/Participation Details</label>
                                <textarea
                                    className="form-input"
                                    rows="5"
                                    value={eventDetails}
                                    onChange={(e) => setEventDetails(e.target.value)}
                                    placeholder="Enter event details such as workshop, conference, or participation activity..."
                                    required
                                />
                            </div>
                            <button type="submit" className="btn-primary w-full">
                                Register OD
                            </button>
                        </form>
                    </div>
                </div>

                <div className="card mt-8">
                    <h2 className="text-xl font-bold mb-4">OD Records</h2>
                    <div className="space-y-3">
                        {records.length === 0 ? (
                            <p className="text-gray-500">No OD records registered yet.</p>
                        ) : (
                            records.map((record) => (
                                <div key={record.od_id} className="border rounded-md p-4">
                                    <div className="flex justify-between items-center">
                                        <strong>{record.registration_number}</strong>
                                        <span className="text-sm text-gray-500">{record.od_status}</span>
                                    </div>
                                    <p className="text-sm mt-2 text-gray-600">Student ID: {record.student_id}</p>
                                    <p className="text-sm text-gray-600">Event: {record.event_details}</p>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default StudentRepDashboard;
