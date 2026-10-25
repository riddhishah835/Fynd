import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../api/axios.js';
import ErrorBox from './ErrorBox.jsx';
import { fieldErrors } from '../utils/helpers.js';

export default function SendProposalForm({ eventId, tier }) {
  const [expanded, setExpanded] = useState(false);
  const [amount, setAmount] = useState(String(tier.price));
  const [message, setMessage] = useState('');
  const [errors, setErrors] = useState({});
  const [errorMessage, setErrorMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const navigate = useNavigate();
  const slotsLeft = tier.slots - tier.slotsFilled;

  const submit = async (event) => {
    event.preventDefault();
    setSubmitting(true);
    setErrors({});
    setErrorMessage('');

    try {
      const { data } = await api.post('/proposals', {
        eventId,
        tierId: tier._id,
        amount: Number(amount),
        message,
      });
      navigate(`/proposals/${data.proposal._id}`);
    } catch (error) {
      setErrors(fieldErrors(error));
      if (error.status === 409) {
        setErrorMessage(error.message);
      } else if (!error.details?.length) {
        setErrorMessage(error.message);
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (slotsLeft <= 0) {
    return (
      <button
        className="rounded border border-gray-300 px-3 py-2 text-sm text-gray-500"
        disabled
        type="button"
      >
        Sold out
      </button>
    );
  }

  return (
    <div className="space-y-3">
      {!expanded && (
        <button
          className="rounded bg-blue-700 px-3 py-2 text-sm font-medium text-white"
          onClick={() => setExpanded(true)}
          type="button"
        >
          Send proposal
        </button>
      )}
      {expanded && (
        <form className="space-y-3 border-t border-gray-200 pt-3" onSubmit={submit}>
          {errorMessage && (
            <div className="space-y-2">
              <ErrorBox message={errorMessage} />
              {errorMessage.includes('already have an active proposal') && (
                <Link className="text-sm text-blue-700 underline" to="/proposals">
                  View your proposals
                </Link>
              )}
            </div>
          )}
          <label className="block text-sm font-medium" htmlFor={`amount-${tier._id}`}>
            Proposed amount (INR)
            <input
              className="mt-1 w-full rounded border border-gray-300 px-3 py-2"
              id={`amount-${tier._id}`}
              min="0.01"
              onChange={(event) => setAmount(event.target.value)}
              required
              step="any"
              type="number"
              value={amount}
            />
            {errors.amount && <span className="mt-1 block text-red-700">{errors.amount}</span>}
          </label>
          <label className="block text-sm font-medium" htmlFor={`message-${tier._id}`}>
            Message
            <textarea
              className="mt-1 w-full rounded border border-gray-300 px-3 py-2"
              id={`message-${tier._id}`}
              maxLength={1000}
              minLength={10}
              onChange={(event) => setMessage(event.target.value)}
              required
              rows={4}
              value={message}
            />
            <span className="mt-1 block text-xs text-gray-600">{message.length}/1000 characters</span>
            {errors.message && <span className="mt-1 block text-red-700">{errors.message}</span>}
          </label>
          {/* TODO: Draft with AI button goes here in the AI milestone. */}
          <div className="flex gap-2">
            <button
              className="rounded bg-blue-700 px-3 py-2 text-sm font-medium text-white disabled:opacity-60"
              disabled={submitting}
              type="submit"
            >
              {submitting ? 'Sending...' : 'Submit proposal'}
            </button>
            <button
              className="rounded border border-gray-300 px-3 py-2 text-sm"
              disabled={submitting}
              onClick={() => setExpanded(false)}
              type="button"
            >
              Cancel
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
