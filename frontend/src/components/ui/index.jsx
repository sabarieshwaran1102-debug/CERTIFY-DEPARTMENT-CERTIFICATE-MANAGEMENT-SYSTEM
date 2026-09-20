// Shared UI primitives — adapted from Figma design to React 18 / Tailwind 3

// ─── Loading State ────────────────────────────────────────────────────────────
export function LoadingState({ message = 'Loading...' }) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center py-20">
      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#4f46e5" strokeWidth="2" className="animate-spin mb-3">
        <circle cx="12" cy="12" r="10" strokeOpacity="0.2"/>
        <path d="M12 2a10 10 0 0110 10" strokeLinecap="round"/>
      </svg>
      <p className="text-sm text-gray-400">{message}</p>
    </div>
  );
}

// ─── Empty State ──────────────────────────────────────────────────────────────
export function EmptyState({ icon, title, description, action }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
      <div className="w-14 h-14 rounded-2xl bg-indigo-50 flex items-center justify-center mb-4 text-indigo-600">
        {icon ?? (
          <svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
            <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2"/>
            <rect x="9" y="3" width="6" height="4" rx="1"/>
          </svg>
        )}
      </div>
      <h3 className="font-display font-semibold text-sm text-gray-900 mb-1">{title}</h3>
      {description && <p className="text-xs text-gray-400 max-w-xs mb-4">{description}</p>}
      {action}
    </div>
  );
}

// ─── Error State ──────────────────────────────────────────────────────────────
export function ErrorState({ message = 'Something went wrong. Please try again.', onRetry }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
      <div className="w-14 h-14 rounded-2xl bg-red-50 flex items-center justify-center mb-4">
        <svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="#dc2626" strokeWidth="1.8">
          <circle cx="12" cy="12" r="10"/>
          <line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
        </svg>
      </div>
      <h3 className="font-display font-semibold text-sm text-gray-900 mb-1">Error</h3>
      <p className="text-xs text-gray-400 max-w-xs mb-4">{message}</p>
      {onRetry && (
        <button onClick={onRetry} className="px-4 py-2 text-sm font-medium text-indigo-600 border border-indigo-200 rounded-lg hover:bg-indigo-50 transition-colors">
          Try Again
        </button>
      )}
    </div>
  );
}

// ─── Stat Card ────────────────────────────────────────────────────────────────
export function StatCard({ label, value, change, changePositive, icon, iconColor, onClick }) {
  return (
    <div
      onClick={onClick}
      className={`bg-white rounded-xl border border-gray-200 p-5 hover:shadow-sm transition-shadow ${onClick ? 'cursor-pointer hover:border-indigo-200' : ''}`}
    >
      <div className={`w-9 h-9 rounded-lg flex items-center justify-center mb-3 ${iconColor}`}>
        {icon}
      </div>
      <div className="font-display font-bold text-3xl text-gray-900 leading-none mb-1">{value}</div>
      <div className="text-xs font-medium text-gray-500 mb-1">{label}</div>
      {change && (
        <div className={`text-xs font-medium ${changePositive ? 'text-green-600' : 'text-red-500'}`}>{change}</div>
      )}
    </div>
  );
}

// ─── Pagination ───────────────────────────────────────────────────────────────
export function Pagination({ total, perPage = 25, page, onPage }) {
  const totalPages = Math.ceil(total / perPage);
  if (totalPages <= 1) return null;

  const pages = [];
  if (totalPages <= 7) {
    for (let i = 1; i <= totalPages; i++) pages.push(i);
  } else {
    pages.push(1);
    if (page > 3) pages.push('...');
    for (let i = Math.max(2, page - 1); i <= Math.min(totalPages - 1, page + 1); i++) pages.push(i);
    if (page < totalPages - 2) pages.push('...');
    pages.push(totalPages);
  }

  const start = (page - 1) * perPage + 1;
  const end = Math.min(page * perPage, total);

  return (
    <div className="px-4 py-3 border-t border-gray-200 flex items-center justify-between bg-gray-50">
      <span className="text-xs text-gray-500">Showing {start}–{end} of {total} records</span>
      <div className="flex items-center gap-1">
        <button disabled={page === 1} onClick={() => onPage(page - 1)} className="px-3 py-1.5 text-xs text-gray-500 border border-gray-200 rounded-md hover:bg-white disabled:opacity-40 transition-colors">Previous</button>
        {pages.map((p, i) => p === '...' ? (
          <span key={`dots-${i}`} className="px-2 text-gray-400 text-xs">…</span>
        ) : (
          <button key={p} onClick={() => onPage(p)} className={`w-8 h-8 text-xs rounded-md transition-colors ${p === page ? 'bg-indigo-600 text-white font-semibold' : 'text-gray-500 hover:bg-white border border-transparent hover:border-gray-200'}`}>{p}</button>
        ))}
        <button disabled={page === totalPages} onClick={() => onPage(page + 1)} className="px-3 py-1.5 text-xs text-gray-500 border border-gray-200 rounded-md hover:bg-white disabled:opacity-40 transition-colors">Next</button>
      </div>
    </div>
  );
}

// ─── Modal ────────────────────────────────────────────────────────────────────
export function Modal({ title, children, onClose, footer }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl border border-gray-200 shadow-2xl w-full max-w-lg mx-4 max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="font-display font-bold text-base text-gray-900">{title}</h2>
          <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors">
            <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.2">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-5">{children}</div>
        {footer && <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-end gap-3">{footer}</div>}
      </div>
    </div>
  );
}

// ─── Confirm Modal ────────────────────────────────────────────────────────────
export function ConfirmModal({ title, message, confirmLabel = 'Confirm', confirmDanger = false, onClose, onConfirm }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl border border-gray-200 shadow-2xl w-full max-w-md mx-4">
        <div className="p-6">
          <div className="flex items-start gap-4 mb-5">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${confirmDanger ? 'bg-red-50' : 'bg-amber-50'}`}>
              <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke={confirmDanger ? '#dc2626' : '#d97706'} strokeWidth="2">
                <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
                <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
              </svg>
            </div>
            <div>
              <h2 className="font-display font-bold text-base text-gray-900">{title}</h2>
              <p className="text-sm text-gray-500 mt-1 leading-relaxed">{message}</p>
            </div>
          </div>
          <div className="flex gap-3">
            <button onClick={onClose} className="flex-1 py-2.5 text-sm font-semibold text-gray-700 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">Cancel</button>
            <button onClick={onConfirm} className={`flex-1 py-2.5 text-sm font-semibold text-white rounded-lg shadow-sm transition-colors ${confirmDanger ? 'bg-red-600 hover:bg-red-700' : 'bg-amber-500 hover:bg-amber-600'}`}>{confirmLabel}</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Form Field ───────────────────────────────────────────────────────────────
export function Field({ label, required, error, children }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-gray-700 mb-1.5">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      {children}
      {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
    </div>
  );
}

export function Input({ className = '', ...props }) {
  return (
    <input
      {...props}
      className={`w-full px-3 py-2.5 rounded-lg border border-gray-200 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition-colors ${className}`}
    />
  );
}

export function Select({ className = '', children, ...props }) {
  return (
    <select
      {...props}
      className={`w-full px-3 py-2.5 rounded-lg border border-gray-200 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 bg-white transition-colors ${className}`}
    >
      {children}
    </select>
  );
}

export function Textarea({ className = '', ...props }) {
  return (
    <textarea
      {...props}
      className={`w-full px-3 py-2.5 rounded-lg border border-gray-200 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 resize-none transition-colors ${className}`}
    />
  );
}

// ─── Search Input ─────────────────────────────────────────────────────────────
export function SearchInput({ value, onChange, placeholder, className = '' }) {
  return (
    <div className="relative">
      <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="#9ca3af" strokeWidth="2" className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none">
        <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
      </svg>
      <input
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder ?? 'Search…'}
        className={`pl-8 pr-3 py-2.5 rounded-lg border border-gray-200 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition-colors bg-white ${className}`}
      />
    </div>
  );
}

// ─── Page Header ──────────────────────────────────────────────────────────────
export function PageHeader({ title, subtitle, back, onBack, action }) {
  return (
    <div className="sticky top-0 z-10 bg-[#f5f6fa] border-b border-gray-200 px-6 py-4 flex items-start justify-between gap-4">
      <div className="flex items-center gap-3">
        {back && (
          <button onClick={onBack} className="w-8 h-8 flex items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-500 hover:text-gray-900 hover:bg-gray-50 transition-colors flex-shrink-0">
            <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6"/></svg>
          </button>
        )}
        <div>
          <h1 className="font-display font-bold text-xl text-gray-900 leading-tight">{title}</h1>
          {subtitle && <p className="text-sm text-gray-500 mt-0.5">{subtitle}</p>}
        </div>
      </div>
      {action && <div className="flex items-center gap-2 flex-shrink-0">{action}</div>}
    </div>
  );
}

// ─── Section Card ─────────────────────────────────────────────────────────────
export function SectionCard({ title, children, action }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      {title && (
        <div className="px-5 py-4 border-b border-gray-200 flex items-center justify-between">
          <h3 className="font-display font-semibold text-sm text-gray-900">{title}</h3>
          {action}
        </div>
      )}
      {children}
    </div>
  );
}

// ─── Button ───────────────────────────────────────────────────────────────────
export function Btn({ children, variant = 'primary', size = 'md', onClick, disabled, type = 'button', className = '' }) {
  const base = 'inline-flex items-center gap-2 font-semibold rounded-lg transition-colors';
  const sizes = { sm: 'px-3 py-1.5 text-xs', md: 'px-4 py-2.5 text-sm' };
  const variants = {
    primary: 'bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 text-white shadow-sm',
    secondary: 'border border-gray-200 text-gray-700 hover:bg-gray-50 hover:text-gray-900',
    danger: 'bg-red-600 hover:bg-red-700 text-white shadow-sm',
    ghost: 'text-gray-500 hover:text-gray-900 hover:bg-gray-100',
  };
  return (
    <button type={type} onClick={onClick} disabled={disabled} className={`${base} ${sizes[size]} ${variants[variant]} ${className}`}>
      {children}
    </button>
  );
}

// ─── Alert Banner ─────────────────────────────────────────────────────────────
export function Alert({ type = 'info', message, onClose }) {
  if (!message) return null;
  const styles = {
    success: 'bg-green-50 border-green-200 text-green-800',
    error: 'bg-red-50 border-red-200 text-red-800',
    warning: 'bg-amber-50 border-amber-200 text-amber-800',
    info: 'bg-blue-50 border-blue-200 text-blue-800',
  };
  return (
    <div className={`border rounded-lg px-4 py-3 mb-4 flex justify-between items-start ${styles[type]}`}>
      <span className="text-sm">{message}</span>
      {onClose && <button className="ml-4 font-bold text-lg leading-none" onClick={onClose}>×</button>}
    </div>
  );
}
