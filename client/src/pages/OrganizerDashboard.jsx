import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/axios.js';
import Empty from '../components/Empty.jsx';
import ErrorBox from '../components/ErrorBox.jsx';
import EventCard from '../components/EventCard.jsx';
import Loader from '../components/Loader.jsx';
import { useAuth } from '../context/AuthContext.jsx';

export default function OrganizerDashboard() {
  const { user } = useAuth();
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [actionError, setActionError] = useState('');
  const [pendingProposalCount, setPendingProposalCount] = useState(0);
  const [proposalsLoading, setProposalsLoading] = useState(true);
  const [proposalsError, setProposalsError] = useState('');

  const loadEvents = useCallback(async () => {
    setErrorMessage('');
    try {
      const { data } = await api.get('/events/mine/list');
      setEvents(data.events);
    } catch (error) {
      setErrorMessage(error.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadEvents();
  }, [loadEvents]);

  useEffect(() => {
    let active = true;
    api.get('/proposals', { params: { status: 'pending' } })
      .then(({ data }) => {
        if (active) setPendingProposalCount(data.proposals.length);
      })
      .catch((error) => {
        if (active) setProposalsError(error.message);
      })
      .finally(() => {
        if (active) setProposalsLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const publish = async (eventId) => {
    setActionError('');
    try {
      await api.post(`/events/${eventId}/publish`);
      await loadEvents();
    } catch (error) {
      setActionError(error.message);
    }
  };

  const remove = async (eventId) => {
    if (!window.confirm('Delete this event?')) return;
    setActionError('');
    try {
      await api.delete(`/events/${eventId}`);
      await loadEvents();
    } catch (error) {
      setActionError(error.message);
    }
  };

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Welcome, {user.name}</h1>
          <p className="text-gray-700">{user.organization} · {user.city}</p>
        </div>
        <Link
          className="rounded bg-blue-700 px-4 py-2 font-medium text-white"
          to="/organizer/events/new"
        >
          Create event
        </Link>
      </div>

      <section className="rounded border border-gray-200 bg-white p-4">
        <h2 className="font-semibold">Needs your response</h2>
        {proposalsLoading && <Loader />}
        {!proposalsLoading && proposalsError && <ErrorBox message={proposalsError} />}
        {!proposalsLoading && !proposalsError && (
          <Link className="mt-1 inline-block text-blue-700 underline" to="/proposals?status=pending">
            {pendingProposalCount} pending {pendingProposalCount === 1 ? 'proposal' : 'proposals'}
          </Link>
        )}
      </section>

      <div className="space-y-4">
        <h2 className="text-xl font-semibold">My events</h2>
        {actionError && <ErrorBox message={actionError} />}
        {loading && <Loader />}
        {!loading && errorMessage && <ErrorBox message={errorMessage} />}
        {!loading && !errorMessage && events.length === 0 && (
          <div className="space-y-3">
            <Empty message="No events yet" />
            <Link
              className="inline-block rounded bg-blue-700 px-4 py-2 font-medium text-white"
              to="/organizer/events/new"
            >
              Create event
            </Link>
          </div>
        )}
        {!loading && !errorMessage && events.length > 0 && (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {events.map((event) => (
              <div className="space-y-2" key={event._id}>
                <EventCard event={event} showStatus to={`/events/${event._id}`} />
                <div className="flex flex-wrap gap-2">
                  {event.status !== 'closed' && (
                    <Link
                      className="rounded border border-gray-300 px-3 py-1.5 text-sm"
                      to={`/organizer/events/${event._id}/edit`}
                    >
                      Edit
                    </Link>
                  )}
                  {event.status === 'draft' && (
                    <button
                      className="rounded border border-gray-300 px-3 py-1.5 text-sm"
                      onClick={() => publish(event._id)}
                      type="button"
                    >
                      Publish
                    </button>
                  )}
                  <button
                    className="rounded border border-red-300 px-3 py-1.5 text-sm text-red-700"
                    onClick={() => remove(event._id)}
                    type="button"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
