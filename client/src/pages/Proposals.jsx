import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import api from '../api/axios.js';
import Empty from '../components/Empty.jsx';
import ErrorBox from '../components/ErrorBox.jsx';
import Loader from '../components/Loader.jsx';
import StatusBadge from '../components/StatusBadge.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { formatDateRange, formatINR } from '../utils/helpers.js';

const statuses = ['pending', 'countered', 'accepted', 'rejected', 'withdrawn', 'completed'];

export default function Proposals() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedStatus = searchParams.get('status') ?? '';
  const [proposals, setProposals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    let active = true;
    setLoading(true);
    setErrorMessage('');
    const params = selectedStatus ? { status: selectedStatus } : {};
    api.get('/proposals', { params })
      .then(({ data }) => {
        if (active) setProposals(data.proposals);
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
  }, [selectedStatus]);

  const chooseStatus = (status) => {
    const nextParams = new URLSearchParams(searchParams);
    if (status) nextParams.set('status', status);
    else nextParams.delete('status');
    setSearchParams(nextParams);
  };

  return (
    <section className="space-y-5">
      <h1 className="text-2xl font-semibold">
        {user.role === 'sponsor' ? 'My proposals' : 'Proposals received'}
      </h1>
      <div className="flex flex-wrap gap-2" aria-label="Filter proposals by status">
        <button
          aria-pressed={!selectedStatus}
          className={`rounded border px-3 py-1.5 text-sm ${!selectedStatus ? 'border-blue-700 bg-blue-50' : 'border-gray-300'}`}
          onClick={() => chooseStatus('')}
          type="button"
        >
          All
        </button>
        {statuses.map((status) => (
          <button
            aria-pressed={selectedStatus === status}
            className={`rounded border px-3 py-1.5 text-sm capitalize ${selectedStatus === status ? 'border-blue-700 bg-blue-50' : 'border-gray-300'}`}
            key={status}
            onClick={() => chooseStatus(status)}
            type="button"
          >
            {status}
          </button>
        ))}
      </div>

      {loading && <Loader />}
      {!loading && errorMessage && <ErrorBox message={errorMessage} />}
      {!loading && !errorMessage && proposals.length === 0 && (
        <Empty
          message={user.role === 'sponsor'
            ? 'You have not sent any proposals yet'
            : 'You have not received any proposals yet'}
        />
      )}
      {!loading && !errorMessage && proposals.length > 0 && (
        <div className="space-y-3">
          {proposals.map((proposal) => {
            const counterpart = user.role === 'sponsor' ? proposal.organizer : proposal.sponsor;
            const yourTurn = (user.role === 'organizer' && proposal.status === 'pending')
              || (user.role === 'sponsor' && proposal.status === 'countered');
            return (
              <Link
                className="block rounded border border-gray-200 bg-white p-4 hover:bg-gray-50"
                key={proposal._id}
                to={`/proposals/${proposal._id}`}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="space-y-1">
                    <h2 className="font-semibold">{proposal.event?.title ?? 'Event'}</h2>
                    <p className="text-sm text-gray-700">Tier: {proposal.tierSnapshot.name}</p>
                    <p className="text-sm text-gray-700">
                      {counterpart.name} · {counterpart.organization}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{formatINR(proposal.amount)}</span>
                    <StatusBadge status={proposal.status} />
                    {yourTurn && (
                      <span className="rounded-full bg-blue-100 px-2 py-1 text-xs font-medium text-blue-800">
                        Your turn
                      </span>
                    )}
                  </div>
                </div>
                <p className="mt-2 text-xs text-gray-600">
                  Updated {formatDateRange(proposal.updatedAt, proposal.updatedAt)}
                </p>
              </Link>
            );
          })}
        </div>
      )}
    </section>
  );
}
