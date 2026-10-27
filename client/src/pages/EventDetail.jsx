import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import api from '../api/axios.js';
import Empty from '../components/Empty.jsx';
import ErrorBox from '../components/ErrorBox.jsx';
import Loader from '../components/Loader.jsx';
import StatusBadge from '../components/StatusBadge.jsx';
import SendProposalForm from '../components/SendProposalForm.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { formatDateRange, formatINR } from '../utils/helpers.js';

export default function EventDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const [event, setEvent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [actionError, setActionError] = useState('');

  useEffect(() => {
    let active = true;
    setLoading(true);
    setErrorMessage('');
    api.get(`/events/${id}`)
      .then(({ data }) => {
        if (active) setEvent(data.event);
      })
      .catch((error) => {
        if (!active) return;
        setErrorMessage(error.status === 404 ? 'Event not found' : error.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [id]);

  const ownsEvent = event?.organizer?._id === user._id;
  const publish = async () => {
    setActionError('');
    try {
      const { data } = await api.post(`/events/${id}/publish`);
      setEvent(data.event);
    } catch (error) {
      setActionError(error.message);
    }
  };

  if (loading) return <Loader />;
  if (errorMessage === 'Event not found') return <Empty message="Event not found" />;
  if (errorMessage) return <ErrorBox message={errorMessage} />;
  if (!event) return <Empty message="Event not found" />;

  return (
    <article className="space-y-6">
      {event.bannerUrl ? (
        <img alt="" className="max-h-[28rem] w-full rounded-2xl object-cover shadow-sm" src={event.bannerUrl} />
      ) : (
        <div aria-hidden="true" className="flex h-56 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-600 via-violet-600 to-fuchsia-500 shadow-sm sm:h-72">
          <svg className="h-32 w-32 text-white/20" fill="none" viewBox="0 0 24 24">
            <path d="M4 19V5m0 14h16M7 15l4-4 3 2 5-6M16 7h3v3" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.2" />
          </svg>
        </div>
      )}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="page-title">{event.title}</h1>
        <StatusBadge status={event.status} />
      </div>

      {actionError && <ErrorBox message={actionError} />}
      {ownsEvent && user.role === 'organizer' && (
        <div className="flex flex-wrap gap-2">
          {event.status !== 'closed' && (
            <Link
              className="btn-secondary"
              to={`/organizer/events/${event._id}/edit`}
            >
              Edit
            </Link>
          )}
          {event.status === 'draft' && (
            <button
              className="btn-primary"
              onClick={publish}
              type="button"
            >
              Publish
            </button>
          )}
        </div>
      )}

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(20rem,0.8fr)]">
        <div className="space-y-6">
          <section className="card space-y-3">
            <h2 className="text-xl font-semibold text-slate-900">Organizer</h2>
            <div className="flex items-start gap-3">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-indigo-50 text-sm font-bold text-indigo-700">
                {event.organizer.name.split(/\s+/).map((part) => part[0]).slice(0, 2).join('').toUpperCase()}
              </span>
              <div>
                <p className="font-semibold text-slate-900">{event.organizer.name}</p>
                <p className="text-sm text-slate-500">{event.organizer.organization} · {event.organizer.city}</p>
              </div>
            </div>
            {event.organizer.bio && <p className="leading-7 text-slate-600">{event.organizer.bio}</p>}
            {event.organizer.website && <p className="text-sm text-indigo-700">Website: {event.organizer.website}</p>}
          </section>

          <section className="card space-y-4">
            <h2 className="text-xl font-semibold text-slate-900">About this event</h2>
            <p className="whitespace-pre-wrap leading-7 text-slate-600">{event.description}</p>
            <dl className="grid gap-4 border-t border-slate-100 pt-4 sm:grid-cols-2">
              <div><dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">Category</dt><dd className="mt-1 capitalize text-slate-700">{event.category}</dd></div>
              <div><dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">City</dt><dd className="mt-1 text-slate-700">{event.city}</dd></div>
              <div><dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">Venue</dt><dd className="mt-1 text-slate-700">{event.venue}</dd></div>
              <div><dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">Dates</dt><dd className="mt-1 text-slate-700">{formatDateRange(event.startDate, event.endDate)}</dd></div>
              <div><dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">Expected footfall</dt><dd className="mt-1 text-slate-700">{event.expectedFootfall.toLocaleString('en-IN')}</dd></div>
              <div><dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">Audience profile</dt><dd className="mt-1 text-slate-700">{event.audienceProfile}</dd></div>
            </dl>
          </section>
        </div>

        <section className="space-y-4 lg:sticky lg:top-24">
        <h2 className="text-xl font-semibold text-slate-900">Sponsorship tiers</h2>
        <div className="space-y-4">
          {event.tiers.map((tier) => {
            const slotsLeft = tier.slots - tier.slotsFilled;
            const fillPercent = Math.min(100, (tier.slotsFilled / tier.slots) * 100);
            return (
              <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm" key={tier._id}>
                <div className="flex items-start justify-between gap-2">
                  <h3 className="text-lg font-semibold text-slate-900">{tier.name}</h3>
                  {slotsLeft === 0 && (
                    <span className="inline-flex rounded-full bg-rose-50 px-2.5 py-1 text-xs font-semibold text-rose-700 ring-1 ring-rose-200">
                      Sold out
                    </span>
                  )}
                </div>
                <p className="text-2xl font-bold tracking-tight text-slate-900">{formatINR(tier.price)}</p>
                <div>
                  <div className="mb-1.5 flex justify-between text-xs text-slate-500">
                    <span>{slotsLeft} of {tier.slots} slots left</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                    <div className={`h-full rounded-full transition-all ${slotsLeft <= 1 ? 'bg-rose-500' : 'bg-gradient-to-r from-indigo-600 to-violet-600'}`} style={{ width: `${fillPercent}%` }} />
                  </div>
                </div>
                <ul className="space-y-2 text-sm text-slate-600">
                  {tier.benefits.map((benefit, index) => (
                    <li className="flex items-start gap-2" key={`${tier._id}-${index}`}>
                      <svg aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" fill="none" viewBox="0 0 24 24">
                        <path d="m5 12 4 4L19 6" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
                      </svg>
                      {benefit}
                    </li>
                  ))}
                </ul>
                {!ownsEvent && user.role === 'sponsor' && (
                  <SendProposalForm eventId={event._id} tier={tier} />
                )}
              </div>
            );
          })}
        </div>
      </section>
      </div>
    </article>
  );
}
