import { useContext, useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import userService from '../services/userService';
import { PageHeader, SectionCard, Btn, Field, Input, Alert } from '../components/ui/index';

export default function AdminDashboard() {
  const { user } = useContext(AuthContext);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const initSection = searchParams.get('section') || 'faculty';

  const [activeSection, setActiveSection] = useState(initSection);
  const [faculty, setFaculty] = useState([]);
  const [advisors, setAdvisors] = useState([]);
  const [fUsername, setFUsername] = useState('');
  const [fPassword, setFPassword] = useState('');
  const [aUsername, setAUsername] = useState('');
  const [aPassword, setAPassword] = useState('');
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');

  const notify = (m, isErr = false) => { if (isErr) { setErr(m); setMsg(''); } else { setMsg(m); setErr(''); } };

  const loadAll = async () => {
    try {
      const [f, a] = await Promise.all([userService.getFaculty(), userService.getClassAdvisors()]);
      setFaculty(f.data || []);
      setAdvisors(a.data || []);
    } catch (e) { notify(e?.error || 'Unable to load accounts', true); }
  };

  useEffect(() => { loadAll(); }, []);

  const createFaculty = async (e) => {
    e.preventDefault();
    try {
      await userService.createFaculty(fUsername, fPassword);
      setFUsername(''); setFPassword('');
      notify('Coordinating Faculty account created.');
      loadAll();
    } catch (e) { notify(e?.error || 'Failed', true); }
  };

  const createAdvisor = async (e) => {
    e.preventDefault();
    try {
      await userService.createClassAdvisor(aUsername, aPassword);
      setAUsername(''); setAPassword('');
      notify('Class Advisor account created.');
      loadAll();
    } catch (e) { notify(e?.error || 'Failed', true); }
  };

  const toggleFaculty = async (account) => {
    try { await userService.updateFaculty(account.user_id, { is_active: !account.is_active }); loadAll(); }
    catch (e) { notify(e?.error || 'Failed', true); }
  };

  const toggleAdvisor = async (account) => {
    try { await userService.updateClassAdvisor(account.user_id, { is_active: !account.is_active }); loadAll(); }
    catch (e) { notify(e?.error || 'Failed', true); }
  };

  const TABS = ['faculty', 'advisors'];

  return (
    <div className="flex-1 overflow-y-auto">
      <PageHeader
        title="Admin Dashboard"
        subtitle={`${user?.username} · Administrator`}
        action={
          <Btn onClick={() => navigate('/management')}>
            Student &amp; Class Management →
          </Btn>
        }
      />

      <div className="p-6 space-y-5">
        <Alert type="success" message={msg} onClose={() => setMsg('')} />
        <Alert type="error" message={err} onClose={() => setErr('')} />

        {/* Tabs */}
        <div className="flex border-b border-gray-200 mb-0">
          {TABS.map(s => (
            <button key={s} onClick={() => setActiveSection(s)}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
                activeSection === s ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-900'
              }`}>
              {s === 'faculty' ? 'Coordinating Faculty' : 'Class Advisors'}
            </button>
          ))}
        </div>

        {activeSection === 'faculty' && (
          <div className="space-y-5">
            <SectionCard title="Create Coordinating Faculty">
              <div className="p-5">
                <form onSubmit={createFaculty} className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <Field label="Username / Email" required>
                    <Input value={fUsername} onChange={e => setFUsername(e.target.value)} placeholder="faculty@college.edu" required />
                  </Field>
                  <Field label="Password" required>
                    <Input type="password" value={fPassword} onChange={e => setFPassword(e.target.value)} placeholder="Min 8 characters" minLength="8" required />
                  </Field>
                  <div className="flex items-end"><Btn type="submit" className="w-full justify-center">Create</Btn></div>
                </form>
              </div>
            </SectionCard>

            <SectionCard title="Coordinating Faculty Accounts">
              <div className="divide-y divide-gray-100">
                {faculty.length === 0 ? (
                  <p className="px-5 py-8 text-center text-sm text-gray-400">No faculty accounts.</p>
                ) : faculty.map(a => (
                  <div key={a.user_id} className="flex items-center justify-between px-5 py-3.5">
                    <div>
                      <span className="text-sm font-medium text-gray-900">{a.username}</span>
                      <span className={`ml-2 text-xs px-1.5 py-0.5 rounded font-medium ${a.is_active ? 'text-green-700 bg-green-50' : 'text-gray-400 bg-gray-100'}`}>
                        {a.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                    <button onClick={() => toggleFaculty(a)} className="text-xs px-3 py-1.5 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors text-gray-600">
                      {a.is_active ? 'Deactivate' : 'Activate'}
                    </button>
                  </div>
                ))}
              </div>
            </SectionCard>
          </div>
        )}

        {activeSection === 'advisors' && (
          <div className="space-y-5">
            <SectionCard title="Create Class Advisor">
              <div className="p-5">
                <p className="text-xs text-gray-400 mb-4">After creating, assign them to a class in Student &amp; Class Management.</p>
                <form onSubmit={createAdvisor} className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <Field label="Username / Email" required>
                    <Input value={aUsername} onChange={e => setAUsername(e.target.value)} placeholder="advisor@college.edu" required />
                  </Field>
                  <Field label="Password" required>
                    <Input type="password" value={aPassword} onChange={e => setAPassword(e.target.value)} placeholder="Min 8 characters" minLength="8" required />
                  </Field>
                  <div className="flex items-end"><Btn type="submit" className="w-full justify-center">Create</Btn></div>
                </form>
              </div>
            </SectionCard>

            <SectionCard title="Class Advisor Accounts">
              <div className="divide-y divide-gray-100">
                {advisors.length === 0 ? (
                  <p className="px-5 py-8 text-center text-sm text-gray-400">No class advisor accounts.</p>
                ) : advisors.map(a => (
                  <div key={a.user_id} className="flex items-center justify-between px-5 py-3.5">
                    <div>
                      <span className="text-sm font-medium text-gray-900">{a.username}</span>
                      <span className={`ml-2 text-xs px-1.5 py-0.5 rounded font-medium ${a.is_active ? 'text-green-700 bg-green-50' : 'text-gray-400 bg-gray-100'}`}>
                        {a.is_active ? 'Active' : 'Inactive'}
                      </span>
                      {a.assigned_class_id && (
                        <span className="ml-2 text-xs text-indigo-500">Class #{a.assigned_class_id}</span>
                      )}
                    </div>
                    <button onClick={() => toggleAdvisor(a)} className="text-xs px-3 py-1.5 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors text-gray-600">
                      {a.is_active ? 'Deactivate' : 'Activate'}
                    </button>
                  </div>
                ))}
              </div>
            </SectionCard>
          </div>
        )}
      </div>
    </div>
  );
}
