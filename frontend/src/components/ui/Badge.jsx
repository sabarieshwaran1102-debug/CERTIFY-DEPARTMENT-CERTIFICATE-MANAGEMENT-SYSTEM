const BADGE_STYLES = {
  active: 'bg-green-50 text-green-700 ring-1 ring-green-200',
  cancelled: 'bg-red-50 text-red-600 ring-1 ring-red-200',
  inactive: 'bg-gray-100 text-gray-600 ring-1 ring-gray-200',
  graduated: 'bg-blue-50 text-blue-700 ring-1 ring-blue-200',
  transferred: 'bg-purple-50 text-purple-700 ring-1 ring-purple-200',
  pending: 'bg-amber-50 text-amber-700 ring-1 ring-amber-200',
  submitted: 'bg-blue-50 text-blue-700 ring-1 ring-blue-200',
  verified: 'bg-green-50 text-green-700 ring-1 ring-green-200',
  overdue: 'bg-red-50 text-red-600 ring-1 ring-red-200',
  'late submitted': 'bg-orange-50 text-orange-700 ring-1 ring-orange-200',
  rejected: 'bg-red-50 text-red-600 ring-1 ring-red-200',
  conference: 'bg-violet-50 text-violet-700 ring-1 ring-violet-200',
  workshop: 'bg-sky-50 text-sky-700 ring-1 ring-sky-200',
  competition: 'bg-orange-50 text-orange-700 ring-1 ring-orange-200',
  internship: 'bg-teal-50 text-teal-700 ring-1 ring-teal-200',
  symposium: 'bg-pink-50 text-pink-700 ring-1 ring-pink-200',
  other: 'bg-gray-50 text-gray-600 ring-1 ring-gray-200',
};

export default function Badge({ variant, label }) {
  const key = (variant || '').toLowerCase();
  const style = BADGE_STYLES[key] || BADGE_STYLES.other;
  const display = label ?? (variant ? variant.charAt(0).toUpperCase() + variant.slice(1) : '');
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-semibold ${style}`}>
      {display}
    </span>
  );
}
