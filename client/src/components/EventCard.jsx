import { Link } from 'react-router-dom';
import StatusBadge from './StatusBadge.jsx';
import { formatDateRange, formatINR } from '../utils/helpers.js';

export default function EventCard({ event, to, showStatus = false }) {
  const lowestPrice = event.tiers?.length
    ? Math.min(...event.tiers.map((tier) => tier.price))
    : null;

  return (
    <article className="overflow-hidden rounded border border-gray-200 bg-white">
      <Link className="block text-gray-900 hover:bg-gray-50" to={to}>
        {event.bannerUrl ? (
          <img
            alt=""
            className="h-40 w-full object-cover"
            src={event.bannerUrl}
          />
        ) : (
          <div aria-hidden="true" className="h-40 w-full bg-gray-200" />
        )}
        <div className="space-y-2 p-4">
          <div className="flex items-start justify-between gap-3">
            <h2 className="text-lg font-semibold">{event.title}</h2>
            {showStatus && <StatusBadge status={event.status} />}
          </div>
          <p className="text-sm capitalize text-gray-600">{event.category} · {event.city}</p>
          <p className="text-sm text-gray-700">{formatDateRange(event.startDate, event.endDate)}</p>
          <p className="text-sm text-gray-700">
            Expected footfall: {event.expectedFootfall.toLocaleString('en-IN')}
          </p>
          <p className="text-sm font-medium text-gray-900">
            {lowestPrice === null ? 'No tiers yet' : `From ${formatINR(lowestPrice)}`}
          </p>
        </div>
      </Link>
    </article>
  );
}
