import { useState } from 'react';

export default function CancelModal({ odNumber, eventName, onClose, onConfirm, loading = false }) {
  const [reason, setReason] = useState('');

  const handleConfirm = () => {
    if (!reason.trim()) return;
    onConfirm(reason.trim());
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl border border-gray-200 shadow-2xl w-full max-w-md mx-4 overflow-hidden">
        <div className="h-1 bg-amber-400 w-full" />
        <div className="p-6">
          <div className="flex items-start gap-4 mb-4">
            <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center flex-shrink-0">
              <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="#d97706" strokeWidth="2">
                <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
                <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
              </svg>
            </div>
            <div>
              <h2 className="font-display font-bold text-lg text-gray-900 leading-tight">Cancel On-Duty Record?</h2>
              <p className="text-sm text-gray-500 mt-1 leading-relaxed">
                Cancelling this OD will preserve the record and participant history but mark the OD as cancelled.
              </p>
            </div>
          </div>

          {(odNumber || eventName) && (
            <div className="bg-gray-50 border border-gray-200 rounded-lg px-4 py-3 mb-4 flex items-center gap-3">
              <div className="w-2 h-2 rounded-full bg-amber-400 flex-shrink-0" />
              <div>
                <p className="text-xs text-gray-400 font-medium">On-Duty Record</p>
                <p className="text-sm font-semibold text-gray-900">{odNumber}{eventName ? ` — ${eventName}` : ''}</p>
              </div>
            </div>
          )}

          <div className="mb-5">
            <label className="block text-xs font-semibold text-gray-700 mb-1.5">
              Cancellation Reason <span className="text-red-500">*</span>
            </label>
            <textarea
              value={reason}
              onChange={e => setReason(e.target.value)}
              rows={3}
              placeholder="Enter the reason for cancellation..."
              className="w-full px-3 py-2.5 rounded-lg border border-gray-200 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-amber-400/30 focus:border-amber-400 resize-none transition-colors"
            />
            {reason.trim() === '' && (
              <p className="text-xs text-gray-400 mt-1">A reason is required to cancel this OD.</p>
            )}
          </div>

          <div className="flex items-center gap-3">
            <button onClick={onClose} disabled={loading} className="flex-1 py-2.5 text-sm font-semibold text-gray-700 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-40">
              Keep OD
            </button>
            <button
              onClick={handleConfirm}
              disabled={loading || !reason.trim()}
              className="flex-1 py-2.5 text-sm font-semibold bg-red-600 hover:bg-red-700 text-white rounded-lg shadow-sm transition-colors disabled:opacity-40"
            >
              {loading ? 'Cancelling…' : 'Cancel OD'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
