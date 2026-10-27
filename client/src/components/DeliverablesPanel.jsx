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
    <section className="space-y-3">
      <h2 className="text-lg font-semibold">Deliverables</h2>
      <p className="text-sm text-gray-700">
        {approvedCount} of {deliverables.length} approved
      </p>
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
                className="space-y-3 rounded border border-gray-200 bg-white p-3"
                key={deliverable._id}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="font-medium">{deliverable.title}</h3>
                  <StatusBadge status={deliverable.status} />
                </div>
                {deliverable.note && (
                  <p className="whitespace-pre-wrap text-sm text-gray-700">{deliverable.note}</p>
                )}
                {deliverable.proofUrl && (
                  <a
                    className="text-sm text-blue-700 underline"
                    href={deliverable.proofUrl}
                    rel="noreferrer"
                    target="_blank"
                  >
                    View proof
                  </a>
                )}
                {errors[deliverable._id] && <ErrorBox message={errors[deliverable._id]} />}

                {organizerCanDeliver && (
                  <div className="space-y-2 border-t border-gray-100 pt-3">
                    <label className="block text-sm font-medium">
                      Proof file (JPEG, PNG, WebP, or PDF; max 5 MB)
                      <input
                        accept="image/jpeg,image/png,image/webp,application/pdf"
                        className="mt-1 block w-full text-sm"
                        disabled={busy}
                        onChange={(event) => {
                          const file = event.target.files?.[0];
                          if (file) uploadProof(deliverable, file, event.currentTarget);
                        }}
                        type="file"
                      />
                    </label>
                    {uploadingId === deliverable._id && (
                      <p className="text-sm text-gray-600">Uploading...</p>
                    )}
                    <label className="block text-sm font-medium">
                      Note
                      <textarea
                        className="mt-1 w-full rounded border border-gray-300 px-3 py-2"
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
                      className="rounded bg-blue-700 px-3 py-2 text-sm text-white disabled:opacity-50"
                      disabled={busy}
                      onClick={() => updateStatus(deliverable, 'delivered', note)}
                      type="button"
                    >
                      {submittingId === deliverable._id ? 'Saving...' : 'Mark as delivered'}
                    </button>
                  </div>
                )}

                {sponsorCanRespond && (
                  <div className="flex flex-wrap gap-2 border-t border-gray-100 pt-3">
                    <button
                      className="rounded bg-green-700 px-3 py-2 text-sm text-white disabled:opacity-50"
                      disabled={busy}
                      onClick={() => updateStatus(deliverable, 'approved')}
                      type="button"
                    >
                      Approve
                    </button>
                    {disputeId !== deliverable._id ? (
                      <button
                        className="rounded border border-red-300 px-3 py-2 text-sm text-red-700 disabled:opacity-50"
                        disabled={busy}
                        onClick={() => setDisputeId(deliverable._id)}
                        type="button"
                      >
                        Dispute
                      </button>
                    ) : (
                      <form
                        className="w-full space-y-2"
                        onSubmit={(event) => {
                          event.preventDefault();
                          updateStatus(deliverable, 'disputed', note);
                        }}
                      >
                        <label className="block text-sm font-medium">
                          Dispute note (required)
                          <textarea
                            className="mt-1 w-full rounded border border-gray-300 px-3 py-2"
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
                          className="rounded bg-red-700 px-3 py-2 text-sm text-white disabled:opacity-50"
                          disabled={busy || !note.trim()}
                          type="submit"
                        >
                          {submittingId === deliverable._id ? 'Saving...' : 'Submit dispute'}
                        </button>
                        <button
                          className="ml-2 rounded border border-gray-300 px-3 py-2 text-sm"
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
