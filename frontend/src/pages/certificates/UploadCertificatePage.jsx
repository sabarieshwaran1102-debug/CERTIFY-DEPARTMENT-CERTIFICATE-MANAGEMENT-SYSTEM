import { useState, useEffect, useContext } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { AuthContext } from '../../context/AuthContext';
import odCertService from '../../services/odCertService';
import odsService from '../../services/odsService';
import { PageHeader, SectionCard, Btn, Field, Select } from '../../components/ui/index';

const MAX_SIZE = 5 * 1024 * 1024; // 5MB

export default function UploadCertificatePage() {
  const { user } = useContext(AuthContext);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const preselectedOdId = searchParams.get('od_id');
  const isReplace = searchParams.get('replace') === 'true';

  const [odId, setOdId] = useState(preselectedOdId || '');
  const [myOds, setMyOds] = useState([]);
  const [odDetail, setOdDetail] = useState(null);
  const [file, setFile] = useState(null);
  const [dragging, setDragging] = useState(false);
  const [lateReason, setLateReason] = useState('');
  const [step, setStep] = useState('select'); // select | uploading | success | error
  const [errorMsg, setErrorMsg] = useState('');
  const [isLate, setIsLate] = useState(false);

  // Load student's eligible ODs
  useEffect(() => {
    if (user?.role === 'student') {
      odsService.getODs({ status: 'active', limit: 100 }).then(r => setMyOds(r.data || [])).catch(() => {});
    }
  }, [user?.role]);

  // Load OD detail to check if submission will be late
  useEffect(() => {
    if (!odId) { setOdDetail(null); setIsLate(false); return; }
    odsService.getOD(odId).then(od => {
      setOdDetail(od);
      if (od?.od_end_date) {
        // Compute last day of that month
        const d = new Date(od.od_end_date + 'T00:00:00Z');
        const lastDay = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0));
        lastDay.setUTCHours(23, 59, 59);
        setIsLate(new Date() > lastDay);
      }
    }).catch(() => {});
  }, [odId]);

  const handleFile = (f) => {
    if (!f) return;
    const allowed = ['application/pdf', 'image/jpeg', 'image/png'];
    if (!allowed.includes(f.type)) { setErrorMsg('Only PDF, JPG, PNG files are accepted.'); return; }
    if (f.size > MAX_SIZE) { setErrorMsg('File must be under 5 MB.'); return; }
    setErrorMsg('');
    setFile(f);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    handleFile(e.dataTransfer.files[0]);
  };

  const handleSubmit = async () => {
    if (!file || !odId) return;
    if (isLate && !lateReason.trim()) { setErrorMsg('A reason is required for late submissions.'); return; }

    setStep('uploading');
    setErrorMsg('');
    try {
      await odCertService.submit(Number(odId), file, { lateReason: isLate ? lateReason.trim() : undefined });
      setStep('success');
    } catch (e) {
      setErrorMsg(e?.response?.data?.error || e?.error || 'Upload failed. Please try again.');
      setStep('error');
    }
  };

  return (
    <div className="flex-1 overflow-y-auto">
      <PageHeader
        title={isReplace ? 'Replace Certificate' : 'Upload Certificate'}
        subtitle={odDetail ? `${odDetail.od_number} · ${odDetail.event_name}` : 'Submit your participation certificate'}
        back
        onBack={() => navigate('/certificates')}
      />

      <div className="p-6 max-w-lg mx-auto space-y-5">
        {isReplace && odDetail && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3.5">
            <p className="text-sm font-semibold text-amber-700">Replacing existing certificate</p>
            <p className="text-xs text-amber-600 mt-0.5">Previous version will be preserved in version history.</p>
          </div>
        )}

        {/* OD selector (if not pre-selected) */}
        {!preselectedOdId && user?.role === 'student' && (
          <SectionCard title="Select On-Duty Record">
            <div className="p-5">
              <Field label="OD Record" required>
                <Select value={odId} onChange={e => setOdId(e.target.value)} required>
                  <option value="">Choose an OD…</option>
                  {myOds.map(od => (
                    <option key={od.id} value={od.id}>{od.od_number} · {od.event_name}</option>
                  ))}
                </Select>
              </Field>
            </div>
          </SectionCard>
        )}

        {/* Late warning */}
        {isLate && odId && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3.5 space-y-3">
            <div className="flex items-start gap-2">
              <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="#d97706" strokeWidth="2" className="flex-shrink-0 mt-0.5">
                <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
                <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
              </svg>
              <p className="text-sm text-amber-700">The certificate deadline has passed. A reason for late submission is required.</p>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1.5">Late Submission Reason <span className="text-red-500">*</span></label>
              <textarea
                value={lateReason}
                onChange={e => setLateReason(e.target.value)}
                rows={3}
                placeholder="Explain why the certificate is being submitted late…"
                className="w-full px-3 py-2.5 rounded-lg border border-amber-300 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-amber-400/30 focus:border-amber-400 resize-none transition-colors"
              />
            </div>
          </div>
        )}

        {/* File upload */}
        <SectionCard title="Certificate File">
          <div className="p-5 space-y-4">
            {step === 'select' && (
              <>
                <div
                  onDragOver={e => { e.preventDefault(); setDragging(true); }}
                  onDragLeave={() => setDragging(false)}
                  onDrop={handleDrop}
                  onClick={() => document.getElementById('cert-file-input').click()}
                  className={`border-2 border-dashed rounded-xl py-10 text-center cursor-pointer transition-colors ${
                    dragging ? 'border-indigo-600 bg-indigo-50' :
                    file ? 'border-green-400 bg-green-50' :
                    'border-gray-200 hover:border-indigo-300 hover:bg-gray-50'
                  }`}
                >
                  <input id="cert-file-input" type="file" accept=".pdf,.jpg,.jpeg,.png" className="hidden"
                    onChange={e => handleFile(e.target.files[0])} />
                  {file ? (
                    <>
                      <svg width="32" height="32" fill="none" viewBox="0 0 24 24" stroke="#16a34a" strokeWidth="1.5" className="mx-auto mb-2">
                        <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/>
                        <polyline points="9 15 12 18 15 15"/><line x1="12" y1="18" x2="12" y2="9"/>
                      </svg>
                      <p className="text-sm font-semibold text-gray-900">{file.name}</p>
                      <p className="text-xs text-green-600 mt-0.5">{(file.size / 1024).toFixed(1)} KB · Click to change</p>
                    </>
                  ) : (
                    <>
                      <svg width="36" height="36" fill="none" viewBox="0 0 24 24" stroke="#9ca3af" strokeWidth="1.5" className="mx-auto mb-3">
                        <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
                      </svg>
                      <p className="text-sm font-medium text-gray-700">Drop file here or <span className="text-indigo-600">browse</span></p>
                      <p className="text-xs text-gray-400 mt-1">PDF, JPG, PNG · Max 5 MB</p>
                    </>
                  )}
                </div>

                {errorMsg && (
                  <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{errorMsg}</p>
                )}

                <div className="flex justify-end gap-3">
                  <Btn variant="secondary" onClick={() => navigate('/certificates')}>Cancel</Btn>
                  <Btn
                    disabled={!file || !odId || (isLate && !lateReason.trim())}
                    onClick={handleSubmit}
                  >
                    {isReplace ? 'Replace Certificate' : 'Upload Certificate'}
                  </Btn>
                </div>
              </>
            )}

            {step === 'uploading' && (
              <div className="py-10 flex flex-col items-center">
                <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#4f46e5" strokeWidth="2" className="animate-spin mb-3">
                  <circle cx="12" cy="12" r="10" strokeOpacity="0.2"/>
                  <path d="M12 2a10 10 0 0110 10" strokeLinecap="round"/>
                </svg>
                <p className="text-sm font-medium text-gray-900">Uploading…</p>
                <p className="text-xs text-gray-400 mt-1">{file?.name}</p>
              </div>
            )}

            {step === 'success' && (
              <div className="py-10 flex flex-col items-center text-center">
                <div className="w-14 h-14 rounded-full bg-green-50 flex items-center justify-center mb-4">
                  <svg width="28" height="28" fill="none" viewBox="0 0 24 24" stroke="#16a34a" strokeWidth="2"><polyline points="20 6 9 17 4 12"/></svg>
                </div>
                <h3 className="font-display font-bold text-lg text-gray-900">
                  Certificate {isReplace ? 'Replaced' : 'Uploaded'}
                </h3>
                <p className="text-sm text-gray-400 mt-1">
                  {file?.name} · {new Date().toLocaleDateString()}
                  {isLate && <span className="ml-2 text-orange-500 font-medium">(Late — pending approval)</span>}
                </p>
                <div className="flex gap-3 mt-5">
                  <Btn variant="secondary" onClick={() => { setStep('select'); setFile(null); setLateReason(''); }}>
                    Upload Another
                  </Btn>
                  <Btn onClick={() => navigate('/certificates')}>View Certificates</Btn>
                </div>
              </div>
            )}

            {step === 'error' && (
              <div className="py-10 flex flex-col items-center text-center">
                <div className="w-14 h-14 rounded-full bg-red-50 flex items-center justify-center mb-4">
                  <svg width="28" height="28" fill="none" viewBox="0 0 24 24" stroke="#dc2626" strokeWidth="2">
                    <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                  </svg>
                </div>
                <h3 className="font-display font-bold text-lg text-gray-900">Upload Failed</h3>
                <p className="text-sm text-gray-400 mt-1">{errorMsg || 'Please try again.'}</p>
                <Btn className="mt-5" onClick={() => { setStep('select'); setErrorMsg(''); }}>Try Again</Btn>
              </div>
            )}
          </div>
        </SectionCard>
      </div>
    </div>
  );
}
