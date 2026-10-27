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
      <header className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="page-title">
            <Link className="text-slate-900 transition hover:text-indigo-700 focus-visible:rounded" to={`/events/${proposal.event._id}`}>
              {proposal.event.title}
            </Link>
          </h1>
          <StatusBadge status={proposal.status} />
        </div>
        <p className="mt-3 text-sm text-slate-600">
          {formatDateRange(proposal.event.startDate, proposal.event.endDate)} · {proposal.event.city}
        </p>
        <p className="mt-2 text-sm text-slate-500">{nextAction}</p>
      </header>

      {actionError && <ErrorBox message={actionError} />}

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(20rem,0.85fr)]">
      <div className="space-y-6">
      <section className="card space-y-5">
        <h2 className="text-xl font-semibold text-slate-900">Deal summary</h2>
        <div>
          <h3 className="font-semibold text-slate-800">{proposal.tierSnapshot.name} tier</h3>
          <ul className="mt-2 space-y-2 text-sm text-slate-600">
            {proposal.tierSnapshot.benefits.map((benefit, index) => (
              <li className="flex gap-2" key={`${index}-${benefit}`}>
                <svg aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" fill="none" viewBox="0 0 24 24">
                  <path d="m5 12 4 4L19 6" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
                </svg>
                {benefit}
              </li>
            ))}
          </ul>
        </div>
        <p className="rounded-xl bg-indigo-50 px-4 py-3 font-semibold text-indigo-900">Current amount: {formatINR(proposal.amount)}</p>
        {proposal.amount !== proposal.tierSnapshot.price && (
          <p className="text-sm text-slate-600">Tier original price: {formatINR(proposal.tierSnapshot.price)}</p>
        )}
        <div>
          <h3 className="font-semibold text-slate-800">Initial message</h3>
          <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-slate-600">{proposal.message}</p>
        </div>
        {proposal.status === 'countered' && proposal.counterNote && (
          <div className="rounded-xl bg-amber-50 p-4">
            <h3 className="font-semibold text-amber-900">Counter note</h3>
            <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-amber-800">{proposal.counterNote}</p>
          </div>
        )}
        <div>
          <h3 className="font-semibold text-slate-800">Other party</h3>
          <p className="mt-1 text-sm text-slate-600">
            {counterpart.name} · {counterpart.organization} · {counterpart.city}
          </p>
        </div>
      </section>

      <section className="card space-y-4">
        <h2 className="text-xl font-semibold text-slate-900">Actions</h2>
        <div className="flex flex-wrap gap-2">
          {user.role === 'organizer' && proposal.status === 'pending' && (
            <>
              <button
                className="btn bg-emerald-600 text-white shadow-sm hover:bg-emerald-700"
                disabled={submitting}
                onClick={() => submitTransition('accepted')}
                type="button"
              >
                Accept
              </button>
              <button
                className="btn-primary"
                disabled={submitting}
                onClick={() => openForm('counter')}
                type="button"
              >
                Counter
              </button>
              <button
                className="btn-danger"
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
              className="btn-danger"
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
                className="btn bg-emerald-600 text-white shadow-sm hover:bg-emerald-700"
                disabled={submitting}
                onClick={() => submitTransition('accepted')}
                type="button"
              >
                Accept
              </button>
              <button
                className="btn-danger"
                disabled={submitting}
                onClick={() => submitTransition('rejected', {}, 'Reject this counter-offer?')}
                type="button"
              >
                Reject
              </button>
              <button
                className="btn-primary"
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
                <div className={`rounded-2xl p-3 ${
                  allDeliverablesApproved ? 'bg-emerald-50 ring-2 ring-emerald-200' : ''
                }`}>
                  <button
                    className="btn-primary"
                    disabled={submitting}
                    onClick={() => submitTransition('completed')}
                    type="button"
                  >
                    Mark completed
                  </button>
                  {allDeliverablesApproved && (
                    <p className="mt-2 text-sm font-medium text-emerald-800">
                      All deliverables approved, you can mark this deal as completed
                    </p>
                  )}
                </div>
              )}
              <button
                className="btn-danger"
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
          <form className="max-w-lg space-y-3 rounded-2xl border border-indigo-100 bg-indigo-50/70 p-4" onSubmit={submitForm}>
            {(formType === 'counter' || formType === 'recounter') && (
              <label className="label" htmlFor="counter-amount">
                {formType === 'counter' ? 'Counter amount' : 'New amount'}
                <input
                  className="input"
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
              <label className="label" htmlFor="transition-note">
                Note {formType === 'reject' ? '(required)' : '(optional)'}
                <textarea
                  className="input"
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
                className="btn-primary"
                disabled={submitting}
                type="submit"
              >
                {submitting ? 'Submitting...' : 'Submit'}
              </button>
              <button
                className="btn-secondary"
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

      <section className="card space-y-5">
        <h2 className="text-xl font-semibold text-slate-900">History</h2>
        <ol className="relative space-y-6 border-l-2 border-slate-200 pl-6">
          {proposal.history.map((entry, index) => (
            <li className="relative space-y-2" key={`${entry.at}-${index}`}>
              <span className={`absolute -left-[31px] top-1 h-3 w-3 rounded-full ring-4 ring-white ${
                entry.to === 'accepted' || entry.to === 'completed' ? 'bg-emerald-500'
                  : entry.to === 'rejected' || entry.to === 'withdrawn' ? 'bg-rose-500'
                    : entry.to === 'countered' ? 'bg-sky-500'
                      : 'bg-amber-400'
              }`} />
              <div className="flex flex-wrap items-center gap-2">
                {entry.from ? <StatusBadge status={entry.from} /> : <span className="text-sm font-medium text-slate-600">Created</span>}
                {entry.from && <span aria-hidden="true">→</span>}
                <StatusBadge status={entry.to} />
              </div>
              <p className="text-sm text-slate-600">
                By {actorName(typeof entry.by === 'string' ? entry.by : entry.by._id)}
              </p>
              {entry.note && <p className="whitespace-pre-wrap text-sm leading-6 text-slate-600">{entry.note}</p>}
              <time className="block text-xs text-slate-400" dateTime={entry.at}>
                {formatTimestamp(entry.at)}
              </time>
            </li>
          ))}
        </ol>
      </section>

      {['accepted', 'completed'].includes(proposal.status) && (
        <DeliverablesPanel proposal={proposal} onChanged={loadProposal} />
      )}
      </div>
      <aside className="lg:sticky lg:top-24">
        <ChatPanel proposalId={id} />
      </aside>
      </div>
    </article>
  );
}
