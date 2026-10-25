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
    <section className="space-y-3">
      <h1 className="text-2xl font-semibold">Welcome, {user.name}</h1>
      <p>Organization: {user.organization}</p>
      <p>City: {user.city}</p>
      <p>Role: {user.role}</p>
      <section className="space-y-2 rounded border border-gray-200 bg-white p-4">
        <h2 className="font-semibold">My proposals</h2>
        {loading && <Loader />}
        {!loading && errorMessage && <ErrorBox message={errorMessage} />}
        {!loading && !errorMessage && (
          <div className="flex flex-wrap gap-4 text-sm">
            {Object.entries(counts).map(([status, count]) => (
              <Link
                className="text-blue-700 underline"
                key={status}
                to={`/proposals?status=${status}`}
              >
                {status[0].toUpperCase() + status.slice(1)}: {count}
              </Link>
            ))}
            <Link className="text-blue-700 underline" to="/proposals">All proposals</Link>
          </div>
        )}
      </section>
      <Link className="inline-block rounded bg-blue-700 px-4 py-2 font-medium text-white" to="/events">
        Browse events
      </Link>
    </section>
  );
}
