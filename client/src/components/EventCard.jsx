import { Link } from 'react-router-dom';
import StatusBadge from './StatusBadge.jsx';
import { formatDateRange, formatINR } from '../utils/helpers.js';

const categoryStyles = {
  tech: 'from-indigo-600 to-violet-500',
  cultural: 'from-rose-500 to-orange-400',
  sports: 'from-emerald-500 to-teal-400',
  business: 'from-slate-600 to-sky-500',
  music: 'from-fuchsia-600 to-purple-500',
  social: 'from-amber-400 to-orange-500',
  other: 'from-slate-500 to-slate-400',
};

function PinIcon() {
  return (
    <svg aria-hidden="true" className="h-4 w-4 shrink-0 text-slate-400" fill="none" viewBox="0 0 24 24">
      <path d="M19 10c0 5-7 11-7 11S5 15 5 10a7 7 0 1 1 14 0Z" stroke="currentColor" strokeWidth="1.7" />
      <circle cx="12" cy="10" r="2.2" stroke="currentColor" strokeWidth="1.7" />
    </svg>
  );
}

function CalendarIcon() {
  return (
    <svg aria-hidden="true" className="h-4 w-4 shrink-0 text-slate-400" fill="none" viewBox="0 0 24 24">
      <rect height="15" rx="2" stroke="currentColor" strokeWidth="1.7" width="17" x="3.5" y="5.5" />
      <path d="M7.5 3.5v4m9-4v4m-13 3h17" stroke="currentColor" strokeLinecap="round" strokeWidth="1.7" />
    </svg>
  );
}

export default function EventCard({ event, to, showStatus = false }) {
  const lowestPrice = event.tiers?.length
    ? Math.min(...event.tiers.map((tier) => tier.price))
    : null;
  const category = event.category ?? 'other';

  return (
    <article className="group overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition duration-200 hover:-translate-y-0.5 hover:shadow-md">
      <Link aria-label={`${event.title} — ${event.city}`} className="block text-slate-900 focus-visible:rounded-2xl" to={to}>
        <div className="relative aspect-video overflow-hidden bg-slate-100">
          {event.bannerUrl ? (
            <img
              alt=""
              className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.02]"
              src={event.bannerUrl}
            />
          ) : (
            <div className={`flex h-full w-full items-center justify-center bg-gradient-to-br ${categoryStyles[category] ?? categoryStyles.other}`}>
              <svg aria-hidden="true" className="absolute h-36 w-36 text-white/15" fill="none" viewBox="0 0 24 24">
                <path d="M4 19V5m0 14h16M7 15l4-4 3 2 5-6M16 7h3v3" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.2" />
              </svg>
              <span aria-hidden="true" className="relative text-7xl font-extrabold uppercase text-white/85">
                {category[0]}
              </span>
            </div>
          )}
          <span className="absolute left-3 top-3 rounded-full border border-white/60 bg-white/90 px-2.5 py-1 text-xs font-semibold capitalize text-slate-700 shadow-sm backdrop-blur">
            {event.category}
          </span>
          {showStatus && (
            <span className="absolute right-3 top-3">
              <StatusBadge status={event.status} />
            </span>
          )}
        </div>
        <div className="space-y-3 p-5">
          <h2 className="line-clamp-2 text-lg font-semibold leading-snug text-slate-900 group-hover:text-indigo-700">
            {event.title}
          </h2>
          <div className="space-y-2 text-sm text-slate-500">
            <p className="flex items-center gap-2"><PinIcon />{event.city}</p>
            <p className="flex items-center gap-2"><CalendarIcon />{formatDateRange(event.startDate, event.endDate)}</p>
          </div>
          <div className="flex items-end justify-between gap-3 border-t border-slate-100 pt-3">
            <p className="text-xs text-slate-500">
              Expected footfall
              <span className="mt-0.5 block text-sm font-medium text-slate-700">
                {event.expectedFootfall.toLocaleString('en-IN')}
              </span>
            </p>
            <p className="text-right text-xs text-slate-500">
              {lowestPrice === null ? 'No tiers yet' : 'From'}
              {lowestPrice !== null && (
                <span className="mt-0.5 block text-base font-bold text-slate-900">
                  {formatINR(lowestPrice)}
                </span>
              )}
            </p>
          </div>
        </div>
      </Link>
    </article>
  );
}
