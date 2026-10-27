import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import api from '../api/axios.js';
import Empty from '../components/Empty.jsx';
import ErrorBox from '../components/ErrorBox.jsx';
import ChatPanel from '../components/ChatPanel.jsx';
import DeliverablesPanel from '../components/DeliverablesPanel.jsx';
import Loader from '../components/Loader.jsx';
import StatusBadge from '../components/StatusBadge.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { formatDateRange, formatINR } from '../utils/helpers.js';

function formatTimestamp(value) {
  return new Date(value).toLocaleString('en-IN', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

export default function ProposalDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const [proposal, setProposal] = useState(null);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [actionError, setActionError] = useState('');
  const [formType, setFormType] = useState('');
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const loadProposal = useCallback(async () => {
    setErrorMessage('');
    try {
      const { data } = await api.get(`/proposals/${id}`);
      setProposal(data.proposal);
    } catch (error) {
      setErrorMessage(error.status === 404 ? 'Proposal not found' : error.message);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadProposal();
  }, [loadProposal]);

  const submitTransition = async (toStatus, payload = {}, confirmMessage = '') => {
    if (confirmMessage && !window.confirm(confirmMessage)) return;
    setSubmitting(true);
    setActionError('');
    try {
      await api.post(`/proposals/${id}/transition`, { toStatus, ...payload });
      setFormType('');
      setNote('');
      await loadProposal();
    } catch (error) {
      setActionError(error.message);
      if (error.status === 409) await loadProposal();
    } finally {
      setSubmitting(false);
    }
  };

  const openForm = (type) => {
    setFormType(type);
    setAmount(String(proposal.amount));
    setNote('');
    setActionError('');
  };

  const submitForm = async (event) => {
    event.preventDefault();
    if (formType === 'reject' && !window.confirm('Reject this proposal?')) return;
    const toStatus = formType === 'counter' ? 'countered'
      : formType === 'reject' ? 'rejected'
        : 'pending';
    const payload = {
      ...(formType === 'counter' || formType === 'recounter'
        ? { amount: Number(amount) }
        : {}),
      ...(note ? { note } : {}),
    };

    setSubmitting(true);
    setActionError('');
    try {
      await api.post(`/proposals/${id}/transition`, { toStatus, ...payload });
      setFormType('');
      setNote('');
      await loadProposal();
    } catch (error) {
      setActionError(error.message);
      if (error.status === 409) await loadProposal();
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <Loader />;
  if (errorMessage === 'Proposal not found') return <Empty message="Proposal not found" />;
  if (errorMessage) return <ErrorBox message={errorMessage} />;
  if (!proposal) return <Empty message="Proposal not found" />;

  const isSponsor = user.role === 'sponsor';
  const counterpart = isSponsor ? proposal.organizer : proposal.sponsor;
  const actorName = (actorId) => {
    if (actorId === proposal.sponsor._id) return proposal.sponsor.name;
    if (actorId === proposal.organizer._id) return proposal.organizer.name;
    return 'Unknown user';
  };

  let nextAction = '';
  if (proposal.status === 'pending') {
    nextAction = 'Waiting for the organizer to respond';
  } else if (proposal.status === 'countered') {
    nextAction = 'Waiting for the sponsor to respond';
  } else if (proposal.status === 'accepted') {
    nextAction = 'The proposal is accepted; deliverables are being tracked';
  } else {
    nextAction = 'No further response is required';
  }

  const showTransitionForm = Boolean(formType);
  const deliverables = proposal.deliverables ?? [];
  const allDeliverablesApproved = deliverables.length > 0
    && deliverables.every(({ status }) => status === 'approved');

  return (
    <article className="space-y-6">
      <header className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-semibold">
            <Link className="text-blue-800 underline" to={`/events/${proposal.event._id}`}>
              {proposal.event.title}
            </Link>
          </h1>
          <StatusBadge status={proposal.status} />
        </div>
        <p className="text-sm text-gray-700">
          {formatDateRange(proposal.event.startDate, proposal.event.endDate)} · {proposal.event.city}
        </p>
        <p className="text-sm text-gray-600">{nextAction}</p>
      </header>

      {actionError && <ErrorBox message={actionError} />}

      <section className="space-y-4 rounded border border-gray-200 bg-white p-4">
        <h2 className="text-lg font-semibold">Deal summary</h2>
        <div>
          <h3 className="font-medium">{proposal.tierSnapshot.name} tier</h3>
          <ul className="mt-1 list-inside list-disc text-sm text-gray-700">
            {proposal.tierSnapshot.benefits.map((benefit, index) => (
              <li key={`${index}-${benefit}`}>{benefit}</li>
            ))}
          </ul>
        </div>
        <p className="font-semibold">Current amount: {formatINR(proposal.amount)}</p>
        {proposal.amount !== proposal.tierSnapshot.price && (
          <p className="text-sm text-gray-700">Tier original price: {formatINR(proposal.tierSnapshot.price)}</p>
        )}
        <div>
          <h3 className="font-medium">Initial message</h3>
          <p className="whitespace-pre-wrap text-sm text-gray-700">{proposal.message}</p>
        </div>
        {proposal.status === 'countered' && proposal.counterNote && (
          <div>
            <h3 className="font-medium">Counter note</h3>
            <p className="whitespace-pre-wrap text-sm text-gray-700">{proposal.counterNote}</p>
          </div>
        )}
        <div>
          <h3 className="font-medium">Other party</h3>
          <p className="text-sm text-gray-700">
            {counterpart.name} · {counterpart.organization} · {counterpart.city}
          </p>
        </div>
      </section>

      <section className="space-y-3 rounded border border-gray-200 bg-white p-4">
        <h2 className="text-lg font-semibold">Actions</h2>
        <div className="flex flex-wrap gap-2">
          {user.role === 'organizer' && proposal.status === 'pending' && (
            <>
              <button
                className="rounded bg-green-700 px-3 py-2 text-sm text-white disabled:opacity-50"
                disabled={submitting}
                onClick={() => submitTransition('accepted')}
                type="button"
              >
                Accept
              </button>
              <button
                className="rounded border border-gray-300 px-3 py-2 text-sm disabled:opacity-50"
                disabled={submitting}
                onClick={() => openForm('counter')}
                type="button"
              >
                Counter
              </button>
              <button
                className="rounded border border-red-300 px-3 py-2 text-sm text-red-700 disabled:opacity-50"
                disabled={submitting}
                onClick={() => openForm('reject')}
                type="button"
              >
                Reject
              </button>
            </>
          )}
          {user.role === 'sponsor' && proposal.status === 'pending' && (
            <button
              className="rounded border border-red-300 px-3 py-2 text-sm text-red-700 disabled:opacity-50"
              disabled={submitting}
              onClick={() => submitTransition('withdrawn', {}, 'Withdraw this proposal?')}
              type="button"
            >
              Withdraw
            </button>
          )}
          {user.role === 'sponsor' && proposal.status === 'countered' && (
            <>
              <button
                className="rounded bg-green-700 px-3 py-2 text-sm text-white disabled:opacity-50"
                disabled={submitting}
                onClick={() => submitTransition('accepted')}
                type="button"
              >
                Accept
              </button>
              <button
                className="rounded border border-red-300 px-3 py-2 text-sm text-red-700 disabled:opacity-50"
                disabled={submitting}
                onClick={() => submitTransition('rejected', {}, 'Reject this counter-offer?')}
                type="button"
              >
                Reject
              </button>
              <button
                className="rounded border border-gray-300 px-3 py-2 text-sm disabled:opacity-50"
                disabled={submitting}
                onClick={() => openForm('recounter')}
                type="button"
              >
                Re-counter
              </button>
            </>
          )}
          {proposal.status === 'accepted' && (
            <>
              {user.role === 'organizer' && (
                <div className={`rounded p-2 ${
                  allDeliverablesApproved ? 'bg-green-50 ring-2 ring-green-300' : ''
                }`}>
                  <button
                    className="rounded bg-blue-700 px-3 py-2 text-sm text-white disabled:opacity-50"
                    disabled={submitting}
                    onClick={() => submitTransition('completed')}
                    type="button"
                  >
                    Mark completed
                  </button>
                  {allDeliverablesApproved && (
                    <p className="mt-2 text-sm text-green-800">
                      All deliverables approved, you can mark this deal as completed
                    </p>
                  )}
                </div>
              )}
              <button
                className="rounded border border-red-300 px-3 py-2 text-sm text-red-700 disabled:opacity-50"
                disabled={submitting}
                onClick={() => submitTransition('withdrawn', {}, 'Withdraw this accepted proposal?')}
                type="button"
              >
                Withdraw
              </button>
            </>
          )}
        </div>

        {showTransitionForm && (
          <form className="max-w-lg space-y-3 border-t border-gray-200 pt-3" onSubmit={submitForm}>
            {(formType === 'counter' || formType === 'recounter') && (
              <label className="block text-sm font-medium" htmlFor="counter-amount">
                {formType === 'counter' ? 'Counter amount' : 'New amount'}
                <input
                  className="mt-1 w-full rounded border border-gray-300 px-3 py-2"
                  id="counter-amount"
                  min="0.01"
                  onChange={(event) => setAmount(event.target.value)}
                  required
                  step="any"
                  type="number"
                  value={amount}
                />
              </label>
            )}
            {(formType === 'counter' || formType === 'reject' || formType === 'recounter') && (
              <label className="block text-sm font-medium" htmlFor="transition-note">
                Note {formType === 'reject' ? '(required)' : '(optional)'}
                <textarea
                  className="mt-1 w-full rounded border border-gray-300 px-3 py-2"
                  id="transition-note"
                  maxLength={500}
                  onChange={(event) => setNote(event.target.value)}
                  required={formType === 'reject'}
                  rows={3}
                  value={note}
                />
              </label>
            )}
            <div className="flex gap-2">
              <button
                className="rounded bg-blue-700 px-3 py-2 text-sm text-white disabled:opacity-50"
                disabled={submitting}
                type="submit"
              >
                {submitting ? 'Submitting...' : 'Submit'}
              </button>
              <button
                className="rounded border border-gray-300 px-3 py-2 text-sm"
                disabled={submitting}
                onClick={() => setFormType('')}
                type="button"
              >
                Cancel
              </button>
            </div>
          </form>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">History</h2>
        <ol className="space-y-3 border-l border-gray-300 pl-4">
          {proposal.history.map((entry, index) => (
            <li className="space-y-1" key={`${entry.at}-${index}`}>
              <div className="flex flex-wrap items-center gap-2">
                {entry.from ? <StatusBadge status={entry.from} /> : <span className="text-sm">Created</span>}
                {entry.from && <span aria-hidden="true">→</span>}
                <StatusBadge status={entry.to} />
              </div>
              <p className="text-sm text-gray-700">
                By {actorName(typeof entry.by === 'string' ? entry.by : entry.by._id)}
              </p>
              {entry.note && <p className="whitespace-pre-wrap text-sm text-gray-700">{entry.note}</p>}
              <time className="block text-xs text-gray-500" dateTime={entry.at}>
                {formatTimestamp(entry.at)}
              </time>
            </li>
          ))}
        </ol>
      </section>

      {['accepted', 'completed'].includes(proposal.status) && (
        <DeliverablesPanel proposal={proposal} onChanged={loadProposal} />
      )}

      <ChatPanel proposalId={id} />
    </article>
  );
}
