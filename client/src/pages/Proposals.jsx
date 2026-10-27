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
    <section className="space-y-6">
      <h1 className="page-title">
        {user.role === 'sponsor' ? 'My proposals' : 'Proposals received'}
      </h1>
      <div className="flex w-fit max-w-full flex-wrap gap-1 rounded-2xl bg-slate-100 p-1" aria-label="Filter proposals by status">
        <button
          aria-pressed={!selectedStatus}
          className={`rounded-xl px-3 py-2 text-sm font-medium transition focus-visible:outline-2 focus-visible:outline-indigo-500 ${!selectedStatus ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
          onClick={() => chooseStatus('')}
          type="button"
        >
          All
        </button>
        {statuses.map((status) => (
          <button
            aria-pressed={selectedStatus === status}
            className={`rounded-xl px-3 py-2 text-sm font-medium capitalize transition focus-visible:outline-2 focus-visible:outline-indigo-500 ${selectedStatus === status ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
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
        <div className="space-y-4">
          {proposals.map((proposal) => {
            const counterpart = user.role === 'sponsor' ? proposal.organizer : proposal.sponsor;
            const yourTurn = (user.role === 'organizer' && proposal.status === 'pending')
              || (user.role === 'sponsor' && proposal.status === 'countered');
            return (
              <Link
                className="block rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-indigo-200 hover:shadow-md focus-visible:outline-2 focus-visible:outline-indigo-500"
                key={proposal._id}
                to={`/proposals/${proposal._id}`}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="space-y-1">
                    <h2 className="text-lg font-semibold text-slate-900">{proposal.event?.title ?? 'Event'}</h2>
                    <p className="text-sm text-slate-600">Tier: {proposal.tierSnapshot.name}</p>
                    <p className="text-sm text-slate-600">
                      {counterpart.name} · {counterpart.organization}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-slate-900">{formatINR(proposal.amount)}</span>
                    <StatusBadge status={proposal.status} />
                    {yourTurn && (
                      <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-800 ring-1 ring-inset ring-amber-200">
                        Your turn
                      </span>
                    )}
                  </div>
                </div>
                <p className="mt-3 border-t border-slate-100 pt-3 text-xs text-slate-500">
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
