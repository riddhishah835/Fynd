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
        <img alt="" className="max-h-96 w-full rounded object-cover" src={event.bannerUrl} />
      ) : (
        <div aria-hidden="true" className="h-56 rounded bg-gray-200" />
      )}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl font-semibold">{event.title}</h1>
        <StatusBadge status={event.status} />
      </div>

      {actionError && <ErrorBox message={actionError} />}
      {ownsEvent && user.role === 'organizer' && (
        <div className="flex gap-2">
          {event.status !== 'closed' && (
            <Link
              className="rounded border border-gray-300 px-3 py-2 text-sm"
              to={`/organizer/events/${event._id}/edit`}
            >
              Edit
            </Link>
          )}
          {event.status === 'draft' && (
            <button
              className="rounded bg-blue-700 px-3 py-2 text-sm font-medium text-white"
              onClick={publish}
              type="button"
            >
              Publish
            </button>
          )}
        </div>
      )}

      <section className="space-y-2 rounded border border-gray-200 bg-white p-4">
        <h2 className="text-lg font-semibold">Organizer</h2>
        <p>{event.organizer.name}</p>
        <p>{event.organizer.organization} · {event.organizer.city}</p>
        {event.organizer.bio && <p>{event.organizer.bio}</p>}
        {event.organizer.website && (
          <p>Website: {event.organizer.website}</p>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">About this event</h2>
        <p className="whitespace-pre-wrap text-gray-700">{event.description}</p>
        <dl className="grid gap-3 sm:grid-cols-2">
          <div><dt className="font-medium">Category</dt><dd className="capitalize">{event.category}</dd></div>
          <div><dt className="font-medium">City</dt><dd>{event.city}</dd></div>
          <div><dt className="font-medium">Venue</dt><dd>{event.venue}</dd></div>
          <div><dt className="font-medium">Dates</dt><dd>{formatDateRange(event.startDate, event.endDate)}</dd></div>
          <div><dt className="font-medium">Expected footfall</dt><dd>{event.expectedFootfall.toLocaleString('en-IN')}</dd></div>
          <div><dt className="font-medium">Audience profile</dt><dd>{event.audienceProfile}</dd></div>
        </dl>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">Sponsorship tiers</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          {event.tiers.map((tier) => {
            const slotsLeft = tier.slots - tier.slotsFilled;
            return (
              <div className="space-y-3 rounded border border-gray-200 bg-white p-4" key={tier._id}>
                <div className="flex items-start justify-between gap-2">
                  <h3 className="text-lg font-semibold">{tier.name}</h3>
                  {slotsLeft === 0 && (
                    <span className="inline-flex rounded-full bg-red-100 px-2.5 py-1 text-xs font-medium text-red-800">
                      Sold out
                    </span>
                  )}
                </div>
                <p className="font-medium">{formatINR(tier.price)}</p>
                <p className="text-sm text-gray-700">{slotsLeft} of {tier.slots} slots left</p>
                <ul className="list-inside list-disc text-sm text-gray-700">
                  {tier.benefits.map((benefit, index) => <li key={`${tier._id}-${index}`}>{benefit}</li>)}
                </ul>
                {!ownsEvent && user.role === 'sponsor' && (
                  <SendProposalForm eventId={event._id} tier={tier} />
                )}
              </div>
            );
          })}
        </div>
      </section>
    </article>
  );
}
