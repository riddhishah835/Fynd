import Event from '../models/Event.js';
import Message from '../models/Message.js';
import Notification from '../models/Notification.js';
import { emitToProposal } from '../sockets/chat.js';
import { assertProposalParticipant } from './proposalService.js';
import { notify } from './notificationService.js';

export async function assertParticipant(user, proposalId) {
  return assertProposalParticipant(user, proposalId);
}

export async function listMessages(user, proposalId, { after, limit }) {
  await assertParticipant(user, proposalId);

  const filter = { proposal: proposalId };
  if (after) filter.createdAt = { $gt: new Date(after) };

  return Message.find(filter)
    .sort({ createdAt: 1, _id: 1 })
    .limit(limit)
    .populate('sender', 'name');
}

export async function createMessage(user, proposalId, text) {
  const proposal = await assertParticipant(user, proposalId);
  const message = await Message.create({
    proposal: proposal._id,
    sender: user._id,
    text,
  });
  await message.populate('sender', 'name');

  try {
    emitToProposal(proposal._id, 'message:new', message);
  } catch (error) {
    console.error('Failed to emit proposal message:', error.message);
  }

  try {
    const otherParticipant = proposal.sponsor.toString() === user._id.toString()
      ? proposal.organizer
      : proposal.sponsor;
    const event = await Event.findById(proposal.event).select('title');
    const notificationLink = `/proposals/${proposal._id}`;
    const unreadNotification = await Notification.exists({
      user: otherParticipant,
      type: 'message',
      link: notificationLink,
      read: false,
    });

    if (!unreadNotification) {
      await notify(
        otherParticipant,
        'message',
        `New message on ${event?.title ?? 'proposal'}`,
        notificationLink,
      );
    }
  } catch (error) {
    console.error('Failed to check or create message notification:', error.message);
  }

  return message;
}
