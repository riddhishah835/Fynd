import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import api from '../api/axios.js';
import Empty from '../components/Empty.jsx';
import ErrorBox from '../components/ErrorBox.jsx';
import EventCard from '../components/EventCard.jsx';
import Loader from '../components/Loader.jsx';
import { useAuth } from '../context/AuthContext.jsx';

const categories = ['tech', 'cultural', 'sports', 'business', 'music', 'social', 'other'];
const filtersFromParams = (params) => ({
  q: params.get('q') ?? '',
  city: params.get('city') ?? '',
  category: params.get('category') ?? '',
  from: params.get('from') ?? '',
  to: params.get('to') ?? '',
  maxPrice: params.get('maxPrice') ?? '',
  minFootfall: params.get('minFootfall') ?? '',
});

const inputClass = 'input';

export default function Events() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useAuth();
  const queryString = searchParams.toString();
  const [filterDraft, setFilterDraft] = useState(() => ({
    queryString,
    values: filtersFromParams(searchParams),
  }));
  const filters = filterDraft.queryString === queryString
    ? filterDraft.values
    : filtersFromParams(searchParams);
  const [events, setEvents] = useState([]);
  const [page, setPage] = useState(Number(searchParams.get('page')) || 1);
  const [totalPages, setTotalPages] = useState(0);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [recommendations, setRecommendations] = useState([]);
  const [recommendationsLoading, setRecommendationsLoading] = useState(false);
  const hasActiveFilters = ['q', 'city', 'category', 'from', 'to', 'maxPrice', 'minFootfall']
    .some((key) => Boolean(searchParams.get(key)));

  const loadEvents = useCallback(async () => {
    setLoading(true);
    setErrorMessage('');
    try {
      const { data } = await api.get('/events', { params: Object.fromEntries(searchParams) });
      setEvents(data.events);
      setPage(data.page);
      setTotalPages(data.totalPages);
    } catch (error) {
      setErrorMessage(error.message);
    } finally {
      setLoading(false);
    }
  }, [searchParams]);

  useEffect(() => {
    loadEvents();
  }, [loadEvents]);

  useEffect(() => {
    if (user?.role !== 'sponsor' || hasActiveFilters) {
      setRecommendations([]);
      setRecommendationsLoading(false);
      return undefined;
    }

    let active = true;
    setRecommendationsLoading(true);
    api.get('/ai/matches')
      .then(({ data }) => {
        if (active) setRecommendations(data.matches?.slice(0, 5) ?? []);
      })
      .catch(() => {
        if (active) setRecommendations([]);
      })
      .finally(() => {
        if (active) setRecommendationsLoading(false);
      });

    return () => {
      active = false;
    };
  }, [hasActiveFilters, user?.role]);

  const updateFilter = (event) => {
    const { name, value } = event.target;
    setFilterDraft((current) => {
      const values = current.queryString === queryString
        ? current.values
        : filtersFromParams(searchParams);
      return { queryString, values: { ...values, [name]: value } };
    });
  };

  const applyFilters = (event) => {
    event.preventDefault();
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(filters)) {
      if (value) params.set(key, value);
    }
    params.set('page', '1');
    setSearchParams(params);
  };

  const resetFilters = () => {
    setSearchParams({ page: '1' });
  };

  const goToPage = (nextPage) => {
    const params = new URLSearchParams(searchParams);
    params.set('page', String(nextPage));
    setSearchParams(params);
  };

  return (
    <section className="space-y-8">
      {user?.role === 'sponsor'
        && !hasActiveFilters
        && (recommendationsLoading || recommendations.length > 0) && (
        <section aria-label="Recommended for you" className="space-y-5 rounded-2xl border border-indigo-100 bg-gradient-to-br from-indigo-50 via-white to-violet-50 p-5 shadow-sm sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="flex items-center gap-2 text-xl font-semibold text-slate-900">
              <svg aria-hidden="true" className="h-5 w-5 text-amber-500" fill="none" viewBox="0 0 24 24">
                <path d="m12 3 1.7 5.3L19 10l-5.3 1.7L12 17l-1.7-5.3L5 10l5.3-1.7L12 3Zm7 12 .8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8L19 15Z" stroke="currentColor" strokeLinejoin="round" strokeWidth="1.5" />
              </svg>
              Recommended for you
            </h2>
            <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-800">AI matched</span>
          </div>
          {recommendationsLoading && <Loader />}
          {!recommendationsLoading && recommendations.length > 0 && (
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {recommendations.map((match) => (
                <div className="space-y-2" key={match.event._id}>
                  <p className="flex justify-end">
                    <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-1 text-xs font-bold text-amber-800">
                      <svg aria-hidden="true" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24">
                        <path d="m12 3 1.7 5.3L19 10l-5.3 1.7L12 17l-1.7-5.3L5 10l5.3-1.7L12 3Z" stroke="currentColor" strokeLinejoin="round" strokeWidth="1.7" />
                      </svg>
                      {match.score}% match
                    </span>
                  </p>
                  <EventCard event={match.event} to={`/events/${match.event._id}`} />
                  <p className="px-1 text-sm leading-6 text-slate-600">{match.reason}</p>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      <h1 className="page-title">Browse events</h1>
      <form className="grid gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:grid-cols-2 lg:grid-cols-4" onSubmit={applyFilters}>
        <label className="label" htmlFor="q">
          Search
          <input className={inputClass} id="q" name="q" onChange={updateFilter} value={filters.q} />
        </label>
        <label className="label" htmlFor="city">
          City
          <input className={inputClass} id="city" name="city" onChange={updateFilter} value={filters.city} />
        </label>
        <label className="label" htmlFor="category">
          Category
          <select className={inputClass} id="category" name="category" onChange={updateFilter} value={filters.category}>
            <option value="">All</option>
            {categories.map((category) => (
              <option key={category} value={category}>{category}</option>
            ))}
          </select>
        </label>
        <label className="label" htmlFor="from">
          From
          <input className={inputClass} id="from" name="from" onChange={updateFilter} type="date" value={filters.from} />
        </label>
        <label className="label" htmlFor="to">
          To
          <input className={inputClass} id="to" name="to" onChange={updateFilter} type="date" value={filters.to} />
        </label>
        <label className="label" htmlFor="maxPrice">
          Maximum tier price (INR)
          <input className={inputClass} id="maxPrice" min="0" name="maxPrice" onChange={updateFilter} type="number" value={filters.maxPrice} />
        </label>
        <label className="label" htmlFor="minFootfall">
          Minimum footfall
          <input className={inputClass} id="minFootfall" min="0" name="minFootfall" onChange={updateFilter} type="number" value={filters.minFootfall} />
        </label>
        <div className="flex items-end gap-2">
          <button className="btn-primary" type="submit">
            Apply
          </button>
          <button className="btn-ghost" onClick={resetFilters} type="button">
            Reset
          </button>
        </div>
      </form>

      {loading && <Loader />}
      {!loading && errorMessage && <ErrorBox message={errorMessage} />}
      {!loading && !errorMessage && events.length === 0 && (
        <Empty message="No events match your filters" />
      )}
      {!loading && !errorMessage && events.length > 0 && (
        <>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {events.map((event) => (
              <EventCard event={event} key={event._id} to={`/events/${event._id}`} />
            ))}
          </div>
          <div className="flex items-center justify-center gap-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
            <button
              className="btn-secondary"
              disabled={page <= 1 || loading}
              onClick={() => goToPage(page - 1)}
              type="button"
            >
              Previous
            </button>
            <span className="px-2 text-sm font-medium text-slate-600">
              Page {page} of {Math.max(1, totalPages)}
            </span>
            <button
              className="btn-secondary"
              disabled={page >= totalPages || loading}
              onClick={() => goToPage(page + 1)}
              type="button"
            >
              Next
            </button>
          </div>
        </>
      )}
    </section>
  );
}
