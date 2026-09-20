import { useState, useEffect, useContext, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthContext } from '../../context/AuthContext';
import odsService from '../../services/odsService';
import managementService from '../../services/managementService';
import { PageHeader, Field, Input, Select, Textarea, Btn, Alert } from '../../components/ui/index';

const EVENT_TYPES = ['Conference', 'Workshop', 'Competition', 'Internship', 'Symposium', 'Other'];

export default function CreateODPage() {
  const { user } = useContext(AuthContext);
  const navigate = useNavigate();

  const [odType, setOdType] = useState('team');
  const [form, setForm] = useState({
    class_id: '',
    event_name: '',
    event_type: 'Conference',
    event_date: '',
    od_start_date: '',
    od_end_date: '',
    purpose: '',
    venue: '',
  });
  const [classes, setClasses] = useState([]);
  const [selected, setSelected] = useState([]);
  const [studentSearch, setStudentSearch] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const searchRef = useRef(null);

  const isClassScoped = ['class_advisor', 'class_representative'].includes(user?.role);
  const isGlobal = ['super_admin', 'admin', 'coordinating_faculty'].includes(user?.role);

  // Load classes on mount
  useEffect(() => {
    managementService.getClasses().then(r => {
      setClasses(r.data || []);
      // For class-scoped roles, pre-select their class
      if (isClassScoped && user.class_id) {
        setForm(f => ({ ...f, class_id: String(user.class_id) }));
      }
    }).catch(() => {});
  }, [isClassScoped, user?.class_id]);

  // Search students when class_id and search change
  useEffect(() => {
    if (!form.class_id || !studentSearch.trim()) { setSearchResults([]); return; }
    const t = setTimeout(async () => {
      try {
        const res = await managementService.getStudents({ class_id: form.class_id, q: studentSearch, status: 'ACTIVE', limit: 10 });
        setSearchResults(res.data || []);
        setShowDropdown(true);
      } catch { setSearchResults([]); }
    }, 300);
    return () => clearTimeout(t);
  }, [studentSearch, form.class_id]);

  const addStudent = (s) => {
    if (odType === 'individual') {
      setSelected([s]);
    } else if (!selected.find(x => x.student_id === s.student_id)) {
      setSelected(prev => [...prev, s]);
    }
    setStudentSearch('');
    setShowDropdown(false);
  };

  const removeStudent = (id) => setSelected(prev => prev.filter(s => s.student_id !== id));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (selected.length === 0) { setError('Add at least one participant'); return; }
    setSubmitting(true);
    setError('');
    try {
      const payload = {
        ...form,
        class_id: Number(form.class_id),
        student_ids: selected.map(s => Number(s.student_id)),
      };
      const od = await odsService.createOD(payload);
      navigate(`/ods/${od.id}`);
    } catch (e) {
      setError(e?.response?.data?.error || e?.error || 'Failed to create OD');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto">
      <PageHeader
        title="Create On-Duty Record"
        subtitle="Register an individual or team On-Duty request."
        back
        onBack={() => navigate('/ods')}
      />

      <form onSubmit={handleSubmit} className="p-6 max-w-3xl mx-auto space-y-5">
        <Alert type="error" message={error} onClose={() => setError('')} />

        {/* OD Type */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="font-display font-semibold text-sm text-gray-900 mb-3">OD Type</h2>
          <div className="grid grid-cols-2 gap-3">
            {[
              { key: 'individual', label: 'Individual OD', desc: 'Register OD for one student' },
              { key: 'team', label: 'Team OD', desc: 'Register OD for multiple students' },
            ].map(opt => (
              <button
                key={opt.key}
                type="button"
                onClick={() => { setOdType(opt.key); if (opt.key === 'individual' && selected.length > 1) setSelected([selected[0]]); }}
                className={`flex items-start gap-3 p-4 rounded-xl border-2 text-left transition-all ${
                  odType === opt.key ? 'border-indigo-600 bg-indigo-50' : 'border-gray-200 hover:border-indigo-200 hover:bg-gray-50'
                }`}
              >
                <div>
                  <div className="font-semibold text-sm text-gray-900">{opt.label}</div>
                  <div className="text-xs text-gray-500 mt-0.5">{opt.desc}</div>
                </div>
                {odType === opt.key && (
                  <div className="ml-auto mt-0.5 w-5 h-5 rounded-full bg-indigo-600 flex items-center justify-center flex-shrink-0">
                    <svg width="10" height="10" fill="none" viewBox="0 0 24 24" stroke="white" strokeWidth="3">
                      <polyline points="20 6 9 17 4 12"/>
                    </svg>
                  </div>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Event Information */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="font-display font-semibold text-sm text-gray-900 mb-4">Event Information</h2>
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <Field label="Event Name" required>
                <Input placeholder="Enter event name" value={form.event_name} onChange={e => setForm(f => ({ ...f, event_name: e.target.value }))} required />
              </Field>
            </div>
            <Field label="Event Type" required>
              <Select value={form.event_type} onChange={e => setForm(f => ({ ...f, event_type: e.target.value }))}>
                {EVENT_TYPES.map(t => <option key={t}>{t}</option>)}
              </Select>
            </Field>
            <Field label="Event Date" required>
              <Input type="date" value={form.event_date} onChange={e => setForm(f => ({ ...f, event_date: e.target.value }))} required />
            </Field>
            <Field label="OD Start Date" required>
              <Input type="date" value={form.od_start_date} onChange={e => setForm(f => ({ ...f, od_start_date: e.target.value }))} required />
            </Field>
            <Field label="OD End Date" required>
              <Input type="date" value={form.od_end_date} onChange={e => setForm(f => ({ ...f, od_end_date: e.target.value }))} required />
            </Field>
            <div className="col-span-2">
              <Field label="Purpose" required>
                <Textarea rows={3} placeholder="Describe the purpose of this On-Duty…" value={form.purpose} onChange={e => setForm(f => ({ ...f, purpose: e.target.value }))} required />
              </Field>
            </div>
            <div className="col-span-2">
              <Field label="Venue">
                <Input placeholder="Enter venue" value={form.venue} onChange={e => setForm(f => ({ ...f, venue: e.target.value }))} />
              </Field>
            </div>
          </div>
        </div>

        {/* Class Selection — only for global roles */}
        {isGlobal && (
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h2 className="font-display font-semibold text-sm text-gray-900 mb-4">Class</h2>
            <Field label="Select Class" required>
              <Select value={form.class_id} onChange={e => { setForm(f => ({ ...f, class_id: e.target.value })); setSelected([]); }} required>
                <option value="">Choose a class…</option>
                {classes.map(c => <option key={c.id} value={c.id}>{c.display_name} · {c.academic_year_name}</option>)}
              </Select>
            </Field>
          </div>
        )}

        {/* Participants */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display font-semibold text-sm text-gray-900">
              Participants
              {selected.length > 0 && (
                <span className="ml-2 inline-flex items-center justify-center w-5 h-5 rounded-full bg-indigo-600 text-white text-xs font-bold">{selected.length}</span>
              )}
            </h2>
          </div>

          {/* Search */}
          <div className="relative mb-3" ref={searchRef}>
            <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="#9ca3af" strokeWidth="2" className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none">
              <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
            <input
              value={studentSearch}
              onChange={e => { setStudentSearch(e.target.value); setShowDropdown(true); }}
              onFocus={() => studentSearch && setShowDropdown(true)}
              placeholder={form.class_id ? 'Search by register number or name…' : 'Select a class first'}
              disabled={!form.class_id}
              className="w-full pl-9 pr-3 py-2.5 rounded-lg border border-gray-200 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition-colors disabled:opacity-50"
            />
            {showDropdown && searchResults.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-20 overflow-hidden">
                {searchResults.map(s => (
                  <button
                    key={s.student_id}
                    type="button"
                    onClick={() => addStudent(s)}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-indigo-50 transition-colors"
                  >
                    <div className="w-7 h-7 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center text-xs font-bold flex-shrink-0">
                      {(s.name || '').split(' ').map(n => n[0]).join('').slice(0,2).toUpperCase()}
                    </div>
                    <div>
                      <div className="text-sm font-medium text-gray-900">{s.name}</div>
                      <div className="text-xs text-gray-400">{s.register_number}</div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Selected table */}
          {selected.length > 0 ? (
            <div className="border border-gray-200 rounded-lg overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase">Register No.</th>
                    <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase">Student</th>
                    <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase">Remove</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {selected.map(s => (
                    <tr key={s.student_id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm font-mono text-indigo-600 font-medium">{s.register_number}</td>
                      <td className="px-4 py-3 text-sm text-gray-900 font-medium">{s.name}</td>
                      <td className="px-4 py-3">
                        <button type="button" onClick={() => removeStudent(s.student_id)} className="text-gray-400 hover:text-red-500 transition-colors">
                          <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                          </svg>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="border-2 border-dashed border-gray-200 rounded-lg py-8 text-center">
              <p className="text-sm text-gray-400">No participants added yet. Search above to add students.</p>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-3 pb-6">
          <Btn variant="secondary" type="button" onClick={() => navigate('/ods')}>Cancel</Btn>
          <Btn type="submit" disabled={submitting || selected.length === 0}>
            {submitting ? 'Creating…' : 'Create OD'}
          </Btn>
        </div>
      </form>
    </div>
  );
}
