const statusStyles = {
  pending: 'bg-amber-50 text-amber-700 ring-amber-200',
  countered: 'bg-sky-50 text-sky-700 ring-sky-200',
  accepted: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  rejected: 'bg-rose-50 text-rose-700 ring-rose-200',
  withdrawn: 'bg-slate-100 text-slate-600 ring-slate-200',
  completed: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  draft: 'bg-slate-100 text-slate-600 ring-slate-200',
  published: 'bg-sky-50 text-sky-700 ring-sky-200',
  closed: 'bg-slate-100 text-slate-600 ring-slate-200',
  delivered: 'bg-amber-50 text-amber-700 ring-amber-200',
  approved: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  disputed: 'bg-rose-50 text-rose-700 ring-rose-200',
};

export default function StatusBadge({ status }) {
  const label = status ? `${status[0].toUpperCase()}${status.slice(1)}` : 'Unknown';

  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${
        statusStyles[status] ?? 'bg-slate-100 text-slate-600 ring-slate-200'
      }`}
    >
      {label}
    </span>
  );
}
