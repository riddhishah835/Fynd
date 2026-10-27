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
    <section className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="page-title">Welcome, {user.name}</h1>
          <p className="mt-2 text-slate-600">{user.organization} · {user.city}</p>
        </div>
        <Link className="btn-primary" to="/organizer/events/new">
          Create event
        </Link>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        {[
          { label: 'Events', value: events.length, color: 'bg-indigo-50 text-indigo-700', icon: 'M4 5h16v14H4zM8 9h8m-8 4h5' },
          { label: 'Published', value: events.filter((event) => event.status === 'published').length, color: 'bg-emerald-50 text-emerald-700', icon: 'm5 12 4 4L19 6' },
          { label: 'Pending proposals', value: pendingProposalCount, color: 'bg-amber-50 text-amber-700', icon: 'M12 8v4l3 2m5-2a8 8 0 1 1-16 0 8 8 0 0 1 16 0Z' },
        ].map((stat) => (
          <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm" key={stat.label}>
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-slate-500">{stat.label}</span>
              <span className={`flex h-10 w-10 items-center justify-center rounded-xl ${stat.color}`}>
                <svg aria-hidden="true" className="h-5 w-5" fill="none" viewBox="0 0 24 24">
                  <path d={stat.icon} stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
                </svg>
              </span>
            </div>
            <p className="mt-3 text-3xl font-bold tracking-tight text-slate-900">{stat.value}</p>
          </article>
        ))}
      </div>

      <section className="card">
        <h2 className="text-xl font-semibold text-slate-900">Needs your response</h2>
        <p className="mb-3 mt-1 text-sm text-slate-500">Proposals waiting for your review.</p>
        {proposalsLoading && <Loader />}
        {!proposalsLoading && proposalsError && <ErrorBox message={proposalsError} />}
        {!proposalsLoading && !proposalsError && (
          <Link className="inline-flex items-center gap-2 font-semibold text-indigo-700 hover:text-indigo-800" to="/proposals?status=pending">
            {pendingProposalCount} pending {pendingProposalCount === 1 ? 'proposal' : 'proposals'}
            <svg aria-hidden="true" className="h-4 w-4" fill="none" viewBox="0 0 24 24">
              <path d="M5 12h14m-6-6 6 6-6 6" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
            </svg>
          </Link>
        )}
      </section>

      <div className="space-y-5">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">My events</h2>
          <p className="mt-1 text-sm text-slate-500">Manage your published opportunities and drafts.</p>
        </div>
        {actionError && <ErrorBox message={actionError} />}
        {loading && <Loader />}
        {!loading && errorMessage && <ErrorBox message={errorMessage} />}
        {!loading && !errorMessage && events.length === 0 && (
          <div className="space-y-4">
            <Empty message="No events yet" />
            <Link className="btn-primary" to="/organizer/events/new">
              Create event
            </Link>
          </div>
        )}
        {!loading && !errorMessage && events.length > 0 && (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {events.map((event) => (
              <div className="space-y-2" key={event._id}>
                <EventCard event={event} showStatus to={`/events/${event._id}`} />
                <div className="flex flex-wrap gap-2">
                  {event.status !== 'closed' && (
                    <Link
                      className="btn-secondary min-h-9 px-3 py-1.5"
                      to={`/organizer/events/${event._id}/edit`}
                    >
                      Edit
                    </Link>
                  )}
                  {event.status === 'draft' && (
                    <button
                      className="btn-secondary min-h-9 px-3 py-1.5"
                      onClick={() => publish(event._id)}
                      type="button"
                    >
                      Publish
                    </button>
                  )}
                  <button
                    className="btn-danger min-h-9 px-3 py-1.5"
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
