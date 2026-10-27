import { useState } from 'react';
import api from '../api/axios.js';
import Empty from './Empty.jsx';
import ErrorBox from './ErrorBox.jsx';
import StatusBadge from './StatusBadge.jsx';
import { useAuth } from '../context/AuthContext.jsx';

const allowedProofTypes = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf',
]);
const maxProofSize = 5 * 1024 * 1024;

export default function DeliverablesPanel({ proposal, onChanged }) {
  const { user } = useAuth();
  const [notes, setNotes] = useState({});
  const [disputeId, setDisputeId] = useState('');
  const [errors, setErrors] = useState({});
  const [submittingId, setSubmittingId] = useState('');
  const [uploadingId, setUploadingId] = useState('');

  const setError = (id, message) => {
    setErrors((current) => ({ ...current, [id]: message }));
  };

  const updateStatus = async (deliverable, status, note) => {
    setSubmittingId(deliverable._id);
    setError(deliverable._id, '');
    try {
      await api.patch(`/deliverables/${deliverable._id}`, {
        status,
        ...(note !== undefined ? { note } : {}),
      });
      setDisputeId('');
      await onChanged();
    } catch (error) {
      setError(deliverable._id, error.message);
      if (error.status === 409) await onChanged();
    } finally {
      setSubmittingId('');
    }
  };

  const uploadProof = async (deliverable, file, input) => {
    setError(deliverable._id, '');
    if (!allowedProofTypes.has(file.type)) {
      setError(deliverable._id, 'Choose a JPEG, PNG, WebP, or PDF file');
      input.value = '';
      return;
    }
    if (file.size > maxProofSize) {
      setError(deliverable._id, 'Proof file must be 5 MB or smaller');
      input.value = '';
      return;
    }

    setUploadingId(deliverable._id);
    try {
      const formData = new FormData();
      formData.append('proof', file);
      await api.post(`/deliverables/${deliverable._id}/proof`, formData);
      await onChanged();
    } catch (error) {
      setError(deliverable._id, error.message);
      if (error.status === 409) await onChanged();
    } finally {
      setUploadingId('');
      input.value = '';
    }
  };

  const deliverables = proposal.deliverables ?? [];
  const approvedCount = deliverables.filter(({ status }) => status === 'approved').length;
  const canEdit = proposal.status === 'accepted';

  return (
    <section className="space-y-4">
      <h2 className="text-xl font-semibold text-slate-900">Deliverables</h2>
      <div className="space-y-2">
      <p className="text-sm font-medium text-slate-600">
        {approvedCount} of {deliverables.length} approved
      </p>
      <div className="h-2 overflow-hidden rounded-full bg-slate-100">
        <div
          className="h-full rounded-full bg-gradient-to-r from-indigo-600 to-violet-600 transition-all"
          style={{ width: `${deliverables.length ? (approvedCount / deliverables.length) * 100 : 0}%` }}
        />
      </div>
      </div>
      {deliverables.length === 0 ? (
        <Empty message="No deliverables" />
      ) : (
        <ul className="space-y-3">
          {deliverables.map((deliverable) => {
            const busy = Boolean(submittingId || uploadingId);
            const note = notes[deliverable._id] ?? '';
            const organizerCanDeliver = canEdit
              && user.role === 'organizer'
              && ['pending', 'disputed'].includes(deliverable.status);
            const sponsorCanRespond = canEdit
              && user.role === 'sponsor'
              && deliverable.status === 'delivered';

            return (
              <li
                className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5"
                key={deliverable._id}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-3">
                    <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${
                      deliverable.status === 'approved' ? 'bg-emerald-50 text-emerald-600'
                        : deliverable.status === 'disputed' ? 'bg-rose-50 text-rose-600'
                          : deliverable.status === 'delivered' ? 'bg-amber-50 text-amber-600'
                            : 'bg-slate-100 text-slate-500'
                    }`}>
                      <svg aria-hidden="true" className="h-5 w-5" fill="none" viewBox="0 0 24 24">
                        <path d={deliverable.status === 'approved' ? 'm5 12 4 4L19 6' : 'M12 5v14m-7-7h14'} stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
                      </svg>
                    </span>
                    <h3 className="font-semibold text-slate-900">{deliverable.title}</h3>
                  </div>
                  <StatusBadge status={deliverable.status} />
                </div>
                {deliverable.note && (
                  <p className="whitespace-pre-wrap text-sm leading-6 text-slate-600">{deliverable.note}</p>
                )}
                {deliverable.proofUrl && (
                  <a
                    className="inline-flex items-center gap-1.5 rounded-full bg-indigo-50 px-3 py-1.5 text-xs font-semibold text-indigo-700 hover:bg-indigo-100"
                    href={deliverable.proofUrl}
                    rel="noreferrer"
                    target="_blank"
                  >
                    View proof
                  </a>
                )}
                {errors[deliverable._id] && <ErrorBox message={errors[deliverable._id]} />}

                {organizerCanDeliver && (
                  <div className="space-y-3 border-t border-slate-100 pt-4">
                    <label className="label">
                      Proof file (JPEG, PNG, WebP, or PDF; max 5 MB)
                      <input
                        accept="image/jpeg,image/png,image/webp,application/pdf"
                        className="input file:mr-3 file:rounded-lg file:border-0 file:bg-indigo-50 file:px-3 file:py-2 file:text-sm file:font-semibold file:text-indigo-700"
                        disabled={busy}
                        onChange={(event) => {
                          const file = event.target.files?.[0];
                          if (file) uploadProof(deliverable, file, event.currentTarget);
                        }}
                        type="file"
                      />
                    </label>
                    {uploadingId === deliverable._id && (
                      <p className="text-sm text-slate-500">Uploading...</p>
                    )}
                    <label className="label">
                      Note
                      <textarea
                        className="input"
                        maxLength={500}
                        onChange={(event) => setNotes((current) => ({
                          ...current,
                          [deliverable._id]: event.target.value,
                        }))}
                        rows={2}
                        value={note}
                      />
                    </label>
                    <button
                      className="btn-primary"
                      disabled={busy}
                      onClick={() => updateStatus(deliverable, 'delivered', note)}
                      type="button"
                    >
                      {submittingId === deliverable._id ? 'Saving...' : 'Mark as delivered'}
                    </button>
                  </div>
                )}

                {sponsorCanRespond && (
                  <div className="flex flex-wrap gap-2 border-t border-slate-100 pt-4">
                    <button
                      className="btn bg-emerald-600 text-white shadow-sm hover:bg-emerald-700"
                      disabled={busy}
                      onClick={() => updateStatus(deliverable, 'approved')}
                      type="button"
                    >
                      Approve
                    </button>
                    {disputeId !== deliverable._id ? (
                      <button
                        className="btn-danger"
                        disabled={busy}
                        onClick={() => setDisputeId(deliverable._id)}
                        type="button"
                      >
                        Dispute
                      </button>
                    ) : (
                      <form
                        className="w-full space-y-3 rounded-xl bg-rose-50 p-4"
                        onSubmit={(event) => {
                          event.preventDefault();
                          updateStatus(deliverable, 'disputed', note);
                        }}
                      >
                        <label className="label">
                          Dispute note (required)
                          <textarea
                            className="input"
                            maxLength={500}
                            onChange={(event) => setNotes((current) => ({
                              ...current,
                              [deliverable._id]: event.target.value,
                            }))}
                            required
                            rows={2}
                            value={note}
                          />
                        </label>
                        <button
                          className="btn-danger"
                          disabled={busy || !note.trim()}
                          type="submit"
                        >
                          {submittingId === deliverable._id ? 'Saving...' : 'Submit dispute'}
                        </button>
                        <button
                          className="btn-ghost"
                          disabled={busy}
                          onClick={() => setDisputeId('')}
                          type="button"
                        >
                          Cancel
                        </button>
                      </form>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
