import Deliverable from '../models/Deliverable.js';
import Event from '../models/Event.js';
import Proposal from '../models/Proposal.js';
import AppError from '../utils/AppError.js';
import { notify } from './notificationService.js';

const transitionRoles = {
  pending: {
    accepted: ['organizer'],
    rejected: ['organizer'],
    countered: ['organizer'],
    withdrawn: ['sponsor'],
  },
  countered: {
    accepted: ['sponsor'],
    rejected: ['sponsor'],
    pending: ['sponsor'],
  },
  accepted: {
    completed: ['organizer'],
    withdrawn: ['organizer', 'sponsor'],
  },
};

const proposalLink = (id) => `/proposals/${id}`;

function userId(user) {
  return user._id.toString();
}

function isParticipant(proposal, actor) {
  return proposal.sponsor.toString() === userId(actor)
    || proposal.organizer.toString() === userId(actor);
}

function otherPartyId(proposal, actor) {
  return proposal.sponsor.toString() === userId(actor)
    ? proposal.organizer
    : proposal.sponsor;
}

function transitionNotificationText(proposal, toStatus) {
  const tierName = proposal.tierSnapshot.name;
  return `Proposal for ${tierName} was ${toStatus}`;
}

async function reserveTierSlot(proposal) {
  const event = await Event.findById(proposal.event);
  if (!event) {
    throw new AppError('NOT_FOUND', 'Event not found');
  }

  const tier = event.tiers.id(proposal.tierId);
  if (!tier) {
    throw new AppError('NOT_FOUND', 'Tier not found');
  }

  const updatedEvent = await Event.findOneAndUpdate(
    {
      _id: proposal.event,
      tiers: {
        $elemMatch: {
          _id: proposal.tierId,
          slotsFilled: { $lt: tier.slots },
        },
      },
    },
    { $inc: { 'tiers.$.slotsFilled': 1 } },
    { returnDocument: 'after' },
  );

  if (!updatedEvent) {
    throw new AppError('CONFLICT', 'Tier is full');
  }
}

async function releaseTierSlot(proposal) {
  await Event.updateOne(
    {
      _id: proposal.event,
      tiers: {
        $elemMatch: {
          _id: proposal.tierId,
          slotsFilled: { $gt: 0 },
        },
      },
    },
    { $inc: { 'tiers.$.slotsFilled': -1 } },
  );
}

export async function createProposal(sponsor, input) {
  const event = await Event.findById(input.eventId);
  if (!event || event.status !== 'published') {
    throw new AppError('NOT_FOUND', 'Event not found');
  }
  if (event.endDate <= new Date()) {
    throw new AppError('CONFLICT', 'This event has ended');
  }

  const tier = event.tiers.id(input.tierId);
  if (!tier) {
    throw new AppError('NOT_FOUND', 'Tier not found');
  }
  if (tier.slots - tier.slotsFilled <= 0) {
    throw new AppError('CONFLICT', 'Tier is full');
  }

  const now = new Date();
  let proposal;
  try {
    proposal = await Proposal.create({
      event: event._id,
      tierId: tier._id,
      sponsor: sponsor._id,
      organizer: event.organizer,
      tierSnapshot: {
        name: tier.name,
        price: tier.price,
        benefits: [...tier.benefits],
      },
      amount: input.amount,
      message: input.message,
      status: 'pending',
      history: [{
        from: null,
        to: 'pending',
        by: sponsor._id,
        note: input.message,
        at: now,
      }],
    });
  } catch (error) {
    if (error.code === 11000) {
      throw new AppError('CONFLICT', 'You already have an active proposal for this tier');
    }
    throw error;
  }

  await notify(
    event.organizer,
    'proposal_created',
    `New proposal for ${event.title}`,
    proposalLink(proposal._id),
  );
  return proposal;
}

export async function transitionProposal({ proposalId, actor, toStatus, payload = {} }) {
  const proposal = await Proposal.findById(proposalId);
  if (!proposal || !isParticipant(proposal, actor)) {
    throw new AppError('NOT_FOUND', 'Proposal not found');
  }

  const allowedRoles = transitionRoles[proposal.status]?.[toStatus];
  if (!allowedRoles) {
    throw new AppError('CONFLICT', 'Invalid status transition');
  }
  if (!allowedRoles.includes(actor.role)) {
    throw new AppError('FORBIDDEN', 'You do not have permission to do this');
  }

  if (proposal.status === 'pending' && toStatus === 'rejected' && !payload.note?.trim()) {
    throw new AppError('VALIDATION_ERROR', 'A note is required to reject a pending proposal');
  }
  if (proposal.status === 'pending' && toStatus === 'countered' && !(payload.amount > 0)) {
    throw new AppError('VALIDATION_ERROR', 'A positive amount is required to counter a proposal');
  }
  if (proposal.status === 'countered' && toStatus === 'pending' && !(payload.amount > 0)) {
    throw new AppError('VALIDATION_ERROR', 'A positive amount is required to re-counter a proposal');
  }

  if (proposal.status === 'accepted' && toStatus === 'completed') {
    const deliverableCount = await Deliverable.countDocuments({ proposal: proposal._id });
    const unapprovedCount = await Deliverable.countDocuments({
      proposal: proposal._id,
      status: { $ne: 'approved' },
    });
    if (deliverableCount === 0 || unapprovedCount > 0) {
      throw new AppError(
        'CONFLICT',
        'All deliverables must be approved before completing the proposal',
      );
    }
  }

  const fromStatus = proposal.status;
  const now = new Date();
  let reservedSlot = false;
  let provisionalDeliverables = [];

  if (toStatus === 'accepted' && ['pending', 'countered'].includes(fromStatus)) {
    await reserveTierSlot(proposal);
    reservedSlot = true;

    try {
      provisionalDeliverables = await Deliverable.insertMany(
        proposal.tierSnapshot.benefits.map((title) => ({
          proposal: proposal._id,
          title,
          status: 'pending',
        })),
      );
    } catch (error) {
      await releaseTierSlot(proposal);
      throw error;
    }
  }

  const setFields = { status: toStatus };
  if (['countered'].includes(toStatus) || (fromStatus === 'countered' && toStatus === 'pending')) {
    setFields.amount = payload.amount;
  }
  if (fromStatus === 'pending' && toStatus === 'countered') {
    setFields.counterNote = payload.note ?? '';
  } else if (fromStatus === 'countered' && toStatus === 'pending') {
    setFields.counterNote = '';
  }

  let updatedProposal;
  try {
    updatedProposal = await Proposal.findOneAndUpdate(
      { _id: proposal._id, status: fromStatus },
      {
        $set: setFields,
        $push: {
          history: {
            from: fromStatus,
            to: toStatus,
            by: actor._id,
            note: payload.note ?? '',
            at: now,
          },
        },
      },
      { returnDocument: 'after', runValidators: true },
    );
  } catch (error) {
    if (reservedSlot) await releaseTierSlot(proposal);
    if (provisionalDeliverables.length) {
      await Deliverable.deleteMany({ _id: { $in: provisionalDeliverables.map(({ _id }) => _id) } });
    }
    throw error;
  }

  if (!updatedProposal) {
    if (reservedSlot) await releaseTierSlot(proposal);
    if (provisionalDeliverables.length) {
      await Deliverable.deleteMany({ _id: { $in: provisionalDeliverables.map(({ _id }) => _id) } });
    }
    throw new AppError('CONFLICT', 'Proposal was already updated');
  }

  if (fromStatus === 'accepted' && toStatus === 'withdrawn') {
    await releaseTierSlot(proposal);
    await Deliverable.deleteMany({ proposal: proposal._id });
  }

  const otherParty = otherPartyId(proposal, actor);
  await notify(
    otherParty,
    `proposal_${toStatus}`,
    transitionNotificationText(proposal, toStatus),
    proposalLink(proposal._id),
  );

  return updatedProposal;
}

export async function listProposalsForUser(user, status) {
  const filter = user.role === 'sponsor'
    ? { sponsor: user._id }
    : { organizer: user._id };
  if (status) filter.status = status;

  const counterpart = user.role === 'sponsor' ? 'organizer' : 'sponsor';
  return Proposal.find(filter)
    .sort({ createdAt: -1 })
    .populate('event', 'title bannerUrl startDate city')
    .populate(counterpart, 'name organization');
}

export async function getProposalForUser(user, id) {
  const proposal = await Proposal.findById(id);
  if (!proposal || !isParticipant(proposal, user)) {
    throw new AppError('NOT_FOUND', 'Proposal not found');
  }

  const [populatedProposal, deliverables] = await Promise.all([
    Proposal.findById(id)
      .populate('event', 'title bannerUrl startDate endDate city venue')
      .populate('sponsor', 'name organization city')
      .populate('organizer', 'name organization city'),
    Deliverable.find({ proposal: id }).sort({ createdAt: 1 }),
  ]);

  const result = populatedProposal.toObject();
  result.deliverables = deliverables;
  return result;
}
