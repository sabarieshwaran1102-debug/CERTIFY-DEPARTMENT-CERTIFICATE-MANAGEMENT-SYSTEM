import { useContext, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import studentService from '../services/studentService';
import odService from '../services/odService';
import { PageHeader, SectionCard, SearchInput, Btn, Alert } from '../components/ui/index';
import Badge from '../components/ui/Badge';

export default function StudentRepDashboard() {
  const { user } = useContext(AuthContext);
  const navigate = useNavigate();
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
    } catch (e) {
      setError(e?.error || e?.message || 'Unable to load OD records');
    }
  };

  useEffect(() => { loadRecords(); }, []);

  const handleSearch = async (e) => {
    e.preventDefault();
    setError(''); setSuccess('');
    try {
      const result = await studentService.searchStudents(searchText, 20, 0);
      setSearchResults(result?.data || []);
      if ((result?.data || []).length === 0) setSuccess('No students found.');
    } catch (e) {
      setError(e?.error || e?.message || 'Search failed');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(''); setSuccess('');
    if (!selectedStudent) { setError('Select a student first'); return; }
    setLoading(true);
    try {
      const result = await odService.registerOD(selectedStudent.student_id, eventDetails);
      setSuccess(`OD registered: ${result.registration_number}`);
      setSelectedStudent(null); setEventDetails(''); setSearchText(''); setSearchResults([]);
      loadRecords();
    } catch (e) {
      setError(e?.error || e?.message || 'OD registration failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto">
      <PageHeader title="Student Representative" subtitle={user?.username} />

      <div className="p-6 space-y-5">
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex items-start gap-3">
          <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="#d97706" strokeWidth="2" className="flex-shrink-0 mt-0.5">
            <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
            <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
          </svg>
          <p className="text-sm text-amber-700">Student Representative access is limited to OD registration functions.</p>
        </div>

        <Alert type="success" message={success} onClose={() => setSuccess('')} />
        <Alert type="error" message={error} onClose={() => setError('')} />

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* Student Search */}
          <SectionCard title="Select Student">
            <div className="p-5 space-y-4">
              <form onSubmit={handleSearch} className="flex gap-3">
                <SearchInput value={searchText} onChange={setSearchText} placeholder="Register number or name…" className="flex-1" />
                <Btn type="submit">Search</Btn>
              </form>
              <div className="space-y-2 max-h-64 overflow-auto">
                {searchResults.length === 0 ? (
                  <p className="text-sm text-gray-400 text-center py-4">Search for a student above</p>
                ) : searchResults.map(s => (
                  <button key={s.student_id} type="button"
                    onClick={() => setSelectedStudent(s)}
                    className={`w-full text-left border rounded-lg p-3 transition-colors ${selectedStudent?.student_id === s.student_id ? 'bg-indigo-50 border-indigo-300' : 'bg-white hover:bg-gray-50 border-gray-200'}`}>
                    <p className="text-sm font-semibold text-gray-900">{s.name}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{s.register_number} · {s.department} · {s.year}/{s.section}</p>
                  </button>
                ))}
              </div>
            </div>
          </SectionCard>

          {/* Register OD */}
          <SectionCard title="Register OD">
            <div className="p-5">
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1.5">Selected Student</label>
                  <div className="px-3 py-2.5 rounded-lg border border-gray-200 bg-gray-50 text-sm text-gray-900">
                    {selectedStudent ? `${selectedStudent.name} (${selectedStudent.register_number})` : 'No student selected'}
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1.5">Event / Participation Details</label>
                  <textarea rows={5} value={eventDetails} onChange={e => setEventDetails(e.target.value)}
                    placeholder="Enter event details…" required
                    className="w-full px-3 py-2.5 rounded-lg border border-gray-200 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 resize-none transition-colors" />
                </div>
                <Btn type="submit" disabled={loading || !selectedStudent} className="w-full justify-center">
                  {loading ? 'Registering…' : 'Register OD'}
                </Btn>
              </form>
            </div>
          </SectionCard>
        </div>

        {/* Records */}
        {records.length > 0 && (
          <SectionCard title="Recent OD Records">
            <div className="divide-y divide-gray-100">
              {records.slice(0, 10).map(r => (
                <div key={r.od_id} className="flex items-center justify-between px-5 py-3.5">
                  <div>
                    <p className="text-sm font-semibold text-indigo-600 font-mono">{r.registration_number}</p>
                    <p className="text-xs text-gray-500 mt-0.5 truncate max-w-[200px]">{r.event_details}</p>
                  </div>
                  <Badge variant={(r.od_status || '').toLowerCase()} label={r.od_status} />
                </div>
              ))}
            </div>
          </SectionCard>
        )}
      </div>
    </div>
  );
}
