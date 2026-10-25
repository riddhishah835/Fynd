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

const inputClass = 'w-full rounded border border-gray-300 px-3 py-2';

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
    <section className="space-y-6">
      {user.role === 'sponsor' && (
        <section aria-label="Recommended for you" className="space-y-2">
          <h2 className="text-xl font-semibold">Recommended for you</h2>
          {/* Filled in AI milestone. */}
        </section>
      )}

      <h1 className="text-2xl font-semibold">Browse events</h1>
      <form className="grid gap-3 rounded border border-gray-200 bg-white p-4 sm:grid-cols-2 lg:grid-cols-4" onSubmit={applyFilters}>
        <label className="text-sm font-medium" htmlFor="q">
          Search
          <input className={inputClass} id="q" name="q" onChange={updateFilter} value={filters.q} />
        </label>
        <label className="text-sm font-medium" htmlFor="city">
          City
          <input className={inputClass} id="city" name="city" onChange={updateFilter} value={filters.city} />
        </label>
        <label className="text-sm font-medium" htmlFor="category">
          Category
          <select className={inputClass} id="category" name="category" onChange={updateFilter} value={filters.category}>
            <option value="">All</option>
            {categories.map((category) => (
              <option key={category} value={category}>{category}</option>
            ))}
          </select>
        </label>
        <label className="text-sm font-medium" htmlFor="from">
          From
          <input className={inputClass} id="from" name="from" onChange={updateFilter} type="date" value={filters.from} />
        </label>
        <label className="text-sm font-medium" htmlFor="to">
          To
          <input className={inputClass} id="to" name="to" onChange={updateFilter} type="date" value={filters.to} />
        </label>
        <label className="text-sm font-medium" htmlFor="maxPrice">
          Maximum tier price (INR)
          <input className={inputClass} id="maxPrice" min="0" name="maxPrice" onChange={updateFilter} type="number" value={filters.maxPrice} />
        </label>
        <label className="text-sm font-medium" htmlFor="minFootfall">
          Minimum footfall
          <input className={inputClass} id="minFootfall" min="0" name="minFootfall" onChange={updateFilter} type="number" value={filters.minFootfall} />
        </label>
        <div className="flex items-end gap-2">
          <button className="rounded bg-blue-700 px-4 py-2 text-sm font-medium text-white" type="submit">
            Apply
          </button>
          <button className="rounded border border-gray-300 px-4 py-2 text-sm" onClick={resetFilters} type="button">
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
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {events.map((event) => (
              <EventCard event={event} key={event._id} to={`/events/${event._id}`} />
            ))}
          </div>
          <div className="flex items-center justify-center gap-4">
            <button
              className="rounded border border-gray-300 px-3 py-2 text-sm disabled:opacity-50"
              disabled={page <= 1 || loading}
              onClick={() => goToPage(page - 1)}
              type="button"
            >
              Previous
            </button>
            <span className="text-sm text-gray-700">
              Page {page} of {Math.max(1, totalPages)}
            </span>
            <button
              className="rounded border border-gray-300 px-3 py-2 text-sm disabled:opacity-50"
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
