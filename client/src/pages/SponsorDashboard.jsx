import { Link } from 'react-router-dom';
import { useEffect, useState } from 'react';
import api from '../api/axios.js';
import ErrorBox from '../components/ErrorBox.jsx';
import Loader from '../components/Loader.jsx';
import { useAuth } from '../context/AuthContext.jsx';

export default function SponsorDashboard() {
  const { user } = useAuth();
  const [counts, setCounts] = useState({ pending: 0, countered: 0, accepted: 0 });
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    let active = true;
    api.get('/proposals')
      .then(({ data }) => {
        if (!active) return;
        setCounts({
          pending: data.proposals.filter((proposal) => proposal.status === 'pending').length,
          countered: data.proposals.filter((proposal) => proposal.status === 'countered').length,
          accepted: data.proposals.filter((proposal) => proposal.status === 'accepted').length,
        });
      })
      .catch((error) => {
        if (active) setErrorMessage(error.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  return (
    <section className="space-y-8">
      <div>
        <h1 className="page-title">Welcome, {user.name}</h1>
        <p className="mt-2 text-slate-600">Organization: {user.organization}</p>
        <p className="text-slate-600">City: {user.city}</p>
        <p className="text-sm capitalize text-slate-500">Role: {user.role}</p>
      </div>
      <section className="card space-y-4">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">My proposals</h2>
          <p className="mt-1 text-sm text-slate-500">Keep track of proposals at every stage.</p>
        </div>
        {loading && <Loader />}
        {!loading && errorMessage && <ErrorBox message={errorMessage} />}
        {!loading && !errorMessage && (
          <div className="grid gap-3 sm:grid-cols-3">
            {Object.entries(counts).map(([status, count]) => (
              <Link
                className="rounded-xl border border-slate-200 bg-slate-50 p-4 transition hover:border-indigo-200 hover:bg-indigo-50"
                key={status}
                to={`/proposals?status=${status}`}
              >
                <span className="block text-sm font-medium capitalize text-slate-500">{status}</span>
                <span className="mt-1 block text-2xl font-bold text-slate-900">{count}</span>
              </Link>
            ))}
            <Link className="btn-secondary sm:col-span-3" to="/proposals">All proposals</Link>
          </div>
        )}
      </section>
      <Link className="btn-primary" to="/events">
        Browse events
      </Link>
    </section>
  );
}
