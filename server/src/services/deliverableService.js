import Deliverable from '../models/Deliverable.js';
import Proposal from '../models/Proposal.js';
import AppError from '../utils/AppError.js';
import { uploadProof } from '../config/cloudinary.js';
import { notify } from './notificationService.js';

const validTransitions = {
  pending: { delivered: 'organizer' },
  disputed: { delivered: 'organizer' },
  delivered: { approved: 'sponsor', disputed: 'sponsor' },
};

function isParticipant(proposal, user) {
  const userId = user._id.toString();
  return proposal.sponsor.toString() === userId
    || proposal.organizer.toString() === userId;
}

function otherParticipant(proposal, user) {
  return proposal.sponsor.toString() === user._id.toString()
    ? proposal.organizer
    : proposal.sponsor;
}

function assertProposalIsAccepted(proposal) {
  if (proposal.status !== 'accepted') {
    throw new AppError('CONFLICT', 'Deliverables are locked for this proposal');
  }
}

export async function loadForParticipant(user, deliverableId) {
  const deliverable = await Deliverable.findById(deliverableId);
  if (!deliverable) {
    throw new AppError('NOT_FOUND', 'Deliverable not found');
  }

  const proposal = await Proposal.findById(deliverable.proposal);
  if (!proposal || !isParticipant(proposal, user)) {
    throw new AppError('NOT_FOUND', 'Deliverable not found');
  }

  return { deliverable, proposal };
}

export async function listDeliverables(user, proposalId) {
  const proposal = await Proposal.findById(proposalId);
  if (!proposal || !isParticipant(proposal, user)) {
    throw new AppError('NOT_FOUND', 'Proposal not found');
  }

  return Deliverable.find({ proposal: proposal._id }).sort({ createdAt: 1, _id: 1 });
}

export async function updateDeliverable(user, deliverableId, { status, note }) {
  const { deliverable, proposal } = await loadForParticipant(user, deliverableId);
  assertProposalIsAccepted(proposal);

  const allowedRole = validTransitions[deliverable.status]?.[status];
  if (!allowedRole) {
    throw new AppError('CONFLICT', 'Invalid status transition');
  }
  if (user.role !== allowedRole) {
    throw new AppError('FORBIDDEN', 'You do not have permission to do this');
  }

  const normalizedNote = typeof note === 'string' ? note.trim() : '';
  if (
    status === 'delivered'
    && !deliverable.proofUrl
    && !normalizedNote
  ) {
    throw new AppError('VALIDATION_ERROR', 'Add a proof file or a note');
  }
  if (status === 'disputed' && !normalizedNote) {
    throw new AppError('VALIDATION_ERROR', 'A note is required to dispute a deliverable');
  }

  const update = { status };
  if (note !== undefined) update.note = normalizedNote;
  const updated = await Deliverable.findOneAndUpdate(
    { _id: deliverable._id, status: deliverable.status },
    { $set: update },
    { returnDocument: 'after', runValidators: true },
  );
  if (!updated) {
    throw new AppError('CONFLICT', 'Deliverable was already updated');
  }

  const notificationTypes = {
    delivered: 'deliverable_delivered',
    approved: 'deliverable_approved',
    disputed: 'deliverable_disputed',
  };
  await notify(
    otherParticipant(proposal, user),
    notificationTypes[status],
    `Deliverable "${deliverable.title}" was ${status}`,
    `/proposals/${proposal._id}`,
  );
  return updated;
}

export async function attachProof(user, deliverableId, file) {
  const { deliverable, proposal } = await loadForParticipant(user, deliverableId);
  if (user.role !== 'organizer') {
    throw new AppError('FORBIDDEN', 'You do not have permission to do this');
  }
  assertProposalIsAccepted(proposal);
  if (!['pending', 'disputed'].includes(deliverable.status)) {
    throw new AppError('CONFLICT', 'Proof can only be attached to a pending or disputed deliverable');
  }
  if (!file || !Buffer.isBuffer(file.buffer) || file.buffer.length === 0) {
    throw new AppError('VALIDATION_ERROR', 'A non-empty proof file is required');
  }

  const proofUrl = await uploadProof(file.buffer);
  const updated = await Deliverable.findOneAndUpdate(
    { _id: deliverable._id, status: deliverable.status },
    { $set: { proofUrl } },
    { returnDocument: 'after', runValidators: true },
  );
  if (!updated) {
    throw new AppError('CONFLICT', 'Deliverable was already updated');
  }
  return updated;
}
