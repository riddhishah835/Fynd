const statusStyles = {
  pending: 'bg-amber-100 text-amber-800',
  countered: 'bg-purple-100 text-purple-800',
  accepted: 'bg-green-100 text-green-800',
  rejected: 'bg-red-100 text-red-800',
  withdrawn: 'bg-gray-100 text-gray-700',
  completed: 'bg-blue-100 text-blue-800',
  draft: 'bg-gray-100 text-gray-700',
  published: 'bg-green-100 text-green-800',
  closed: 'bg-slate-200 text-slate-800',
  delivered: 'bg-blue-100 text-blue-800',
  approved: 'bg-green-100 text-green-800',
  disputed: 'bg-red-100 text-red-800',
};

export default function StatusBadge({ status }) {
  const label = status ? `${status[0].toUpperCase()}${status.slice(1)}` : 'Unknown';

  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${
        statusStyles[status] ?? 'bg-gray-100 text-gray-700'
      }`}
    >
      {label}
    </span>
  );
}
