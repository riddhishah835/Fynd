import mongoose from 'mongoose';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import app from '../src/app.js';
import { config } from '../src/config/env.js';
import Deliverable from '../src/models/Deliverable.js';
import Event from '../src/models/Event.js';
import Notification from '../src/models/Notification.js';
import Proposal from '../src/models/Proposal.js';

const suffix = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
const eventStart = '2030-04-10T10:00:00.000Z';
const eventEnd = '2030-04-12T10:00:00.000Z';
let organizer;
let otherOrganizer;
let sponsorA;
let sponsorB;
let sponsorC;
let sponsorD;

function organizerPayload(email) {
  return {
    name: 'Proposal Organizer',
    email,
    password: 'password123',
    role: 'organizer',
    organization: 'Proposal Fest',
    city: 'Test City',
    orgType: 'college',
  };
}

function sponsorPayload(email) {
  return {
    name: 'Proposal Sponsor',
    email,
    password: 'password123',
    role: 'sponsor',
    organization: 'Sponsor Co',
    city: 'Test City',
    industry: 'Technology',
    targetAudience: 'Students',
    budgetMin: 100,
    budgetMax: 5000,
    goals: 'Brand awareness',
  };
}

function eventPayload(overrides = {}) {
  return {
    title: 'Proposal Test Event',
    description: 'A test event for sponsor proposal workflows.',
    category: 'tech',
    city: 'Test City',
    venue: 'Test Hall',
    startDate: eventStart,
    endDate: eventEnd,
    expectedFootfall: 1000,
    audienceProfile: 'College students',
    tiers: [{
      name: 'Gold',
      price: 500,
      slots: 4,
      benefits: ['Logo placement', 'Booth space'],
    }],
    ...overrides,
  };
}

async function createPublishedEvent(agent = organizer, overrides = {}) {
  const response = await agent.post('/api/events').send(eventPayload(overrides));
  expect(response.status).toBe(201);
  const event = response.body.event;
  const published = await agent.post(`/api/events/${event._id}/publish`);
  expect(published.status).toBe(200);
  return published.body.event;
}

async function submitProposal(agent, event, overrides = {}) {
  const response = await agent.post('/api/proposals').send({
    eventId: event._id,
    tierId: event.tiers[0]._id,
    amount: 400,
    message: 'We would like to sponsor this event.',
    ...overrides,
  });
  return response;
}

async function transition(agent, proposalId, toStatus, payload = {}) {
  return agent.post(`/api/proposals/${proposalId}/transition`)
    .send({ toStatus, ...payload });
}

beforeAll(async () => {
  await mongoose.connect(config.mongoUri, { dbName: 'fynd_test' });
  await Proposal.init();
  await Deliverable.init();
  await Notification.init();

  organizer = request.agent(app);
  otherOrganizer = request.agent(app);
  sponsorA = request.agent(app);
  sponsorB = request.agent(app);
  sponsorC = request.agent(app);
  sponsorD = request.agent(app);

  const signups = [
    organizer.post('/api/auth/signup').send(organizerPayload(`proposal-owner-${suffix}@example.com`)),
    otherOrganizer.post('/api/auth/signup').send(organizerPayload(`proposal-other-${suffix}@example.com`)),
    sponsorA.post('/api/auth/signup').send(sponsorPayload(`proposal-a-${suffix}@example.com`)),
    sponsorB.post('/api/auth/signup').send(sponsorPayload(`proposal-b-${suffix}@example.com`)),
    sponsorC.post('/api/auth/signup').send(sponsorPayload(`proposal-c-${suffix}@example.com`)),
    sponsorD.post('/api/auth/signup').send(sponsorPayload(`proposal-d-${suffix}@example.com`)),
  ];
  const responses = await Promise.all(signups);
  expect(responses.map((response) => response.status)).toEqual([201, 201, 201, 201, 201, 201]);
});

afterAll(async () => {
  if (mongoose.connection.readyState === 1) {
    await mongoose.connection.dropDatabase();
  }
  await mongoose.disconnect();
});

describe('proposal routes and transitions', () => {
  it('creates sponsor proposals, validates input, and enforces active uniqueness', async () => {
    const event = await createPublishedEvent();

    expect((await organizer.post('/api/proposals').send({
      eventId: event._id,
      tierId: event.tiers[0]._id,
      amount: 400,
      message: 'A valid sponsor message.',
    })).status).toBe(403);

    const created = await submitProposal(sponsorA, event);
    expect(created.status).toBe(201);
    expect(created.body.proposal.status).toBe('pending');
    expect(created.body.proposal.tierSnapshot.name).toBe('Gold');
    expect(created.body.proposal.history).toHaveLength(1);

    const duplicate = await submitProposal(sponsorA, event);
    expect(duplicate.status).toBe(409);
    expect(duplicate.body.error.message).toBe('You already have an active proposal for this tier');

    const unpublished = await organizer.post('/api/events').send(eventPayload());
    const unpublishedProposal = await submitProposal(sponsorB, unpublished.body.event);
    expect(unpublishedProposal.status).toBe(404);

    const fullEvent = await createPublishedEvent(organizer, {
      tiers: [{ name: 'Only Slot', price: 100, slots: 1, benefits: ['Branding'] }],
    });
    await Event.updateOne(
      { _id: fullEvent._id, 'tiers._id': fullEvent.tiers[0]._id },
      { $set: { 'tiers.$.slotsFilled': 1 } },
    );
    const fullTier = await submitProposal(sponsorB, fullEvent);
    expect(fullTier.status).toBe(409);
    expect(fullTier.body.error.message).toBe('Tier is full');

    for (const invalid of [
      { eventId: 'bad-id', tierId: event.tiers[0]._id, amount: 10, message: 'This is a valid text.' },
      { eventId: event._id, tierId: event.tiers[0]._id, amount: 0, message: 'This is a valid text.' },
      { eventId: event._id, tierId: event.tiers[0]._id, amount: 10, message: 'short' },
    ]) {
      const response = await sponsorB.post('/api/proposals').send(invalid);
      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    }

    const rejected = await transition(organizer, created.body.proposal._id, 'rejected', { note: 'Not a fit.' });
    expect(rejected.status).toBe(200);
    const afterTerminal = await submitProposal(sponsorA, event);
    expect(afterTerminal.status).toBe(201);
  });

  it('enforces actors, required transition fields, and invalid transitions', async () => {
    const event = await createPublishedEvent();
    const created = await submitProposal(sponsorA, event);
    const proposalId = created.body.proposal._id;

    expect((await transition(sponsorA, proposalId, 'accepted')).status).toBe(403);
    expect((await transition(organizer, proposalId, 'withdrawn')).status).toBe(403);
    expect((await transition(organizer, proposalId, 'rejected')).status).toBe(400);
    expect((await transition(organizer, proposalId, 'countered')).status).toBe(400);

    const reject = await transition(organizer, proposalId, 'rejected', { note: 'Not suitable.' });
    expect(reject.status).toBe(200);
    const invalidTerminalTransition = await transition(sponsorA, proposalId, 'accepted');
    expect(invalidTerminalTransition.status).toBe(409);
    expect(invalidTerminalTransition.body.error.message).toBe('Invalid status transition');
  });

  it('supports the counter loop and maintains transition history and amounts', async () => {
    const event = await createPublishedEvent();
    const created = await submitProposal(sponsorA, event);
    const id = created.body.proposal._id;

    const firstCounter = await transition(organizer, id, 'countered', {
      amount: 600,
      note: 'First organizer counter.',
    });
    expect(firstCounter.status).toBe(200);
    expect(firstCounter.body.proposal.amount).toBe(600);

    const sponsorCounter = await transition(sponsorA, id, 'pending', {
      amount: 550,
      note: 'Sponsor counter offer.',
    });
    expect(sponsorCounter.status).toBe(200);
    expect(sponsorCounter.body.proposal.amount).toBe(550);

    const secondCounter = await transition(organizer, id, 'countered', {
      amount: 525,
      note: 'Final counter.',
    });
    expect(secondCounter.status).toBe(200);

    const accept = await transition(sponsorA, id, 'accepted');
    expect(accept.status).toBe(200);
    expect(accept.body.proposal.status).toBe('accepted');
    expect(accept.body.proposal.amount).toBe(525);
    expect(accept.body.proposal.history).toHaveLength(5);
  });

  it('supports every valid terminal flow and creates deliverables on acceptance', async () => {
    const pendingEvent = await createPublishedEvent();
    const pendingProposal = await submitProposal(sponsorA, pendingEvent);
    expect((await transition(sponsorA, pendingProposal.body.proposal._id, 'withdrawn')).status).toBe(200);

    const counterEvent = await createPublishedEvent();
    const counterProposal = await submitProposal(sponsorA, counterEvent);
    const countered = await transition(organizer, counterProposal.body.proposal._id, 'countered', {
      amount: 450,
    });
    expect(countered.status).toBe(200);
    expect((await transition(sponsorA, counterProposal.body.proposal._id, 'rejected')).status).toBe(200);

    const acceptedEvent = await createPublishedEvent();
    const acceptedProposal = await submitProposal(sponsorB, acceptedEvent);
    const accepted = await transition(organizer, acceptedProposal.body.proposal._id, 'accepted');
    expect(accepted.status).toBe(200);

    const deliveryRows = await Deliverable.find({ proposal: acceptedProposal.body.proposal._id });
    expect(deliveryRows.map((item) => item.title)).toEqual(['Logo placement', 'Booth space']);

    const blockedCompletion = await transition(organizer, acceptedProposal.body.proposal._id, 'completed');
    expect(blockedCompletion.status).toBe(409);
    await Deliverable.updateMany(
      { proposal: acceptedProposal.body.proposal._id },
      { $set: { status: 'approved' } },
    );
    expect((await transition(organizer, acceptedProposal.body.proposal._id, 'completed')).status).toBe(200);

    const sponsorWithdrawalEvent = await createPublishedEvent();
    const sponsorWithdrawal = await submitProposal(sponsorB, sponsorWithdrawalEvent);
    await transition(organizer, sponsorWithdrawal.body.proposal._id, 'accepted');
    expect((await transition(sponsorB, sponsorWithdrawal.body.proposal._id, 'withdrawn')).status).toBe(200);

    const organizerWithdrawalEvent = await createPublishedEvent();
    const organizerWithdrawal = await submitProposal(sponsorC, organizerWithdrawalEvent);
    await transition(organizer, organizerWithdrawal.body.proposal._id, 'accepted');
    expect((await transition(organizer, organizerWithdrawal.body.proposal._id, 'withdrawn')).status).toBe(200);

    const acceptedCounterEvent = await createPublishedEvent();
    const acceptedCounterProposal = await submitProposal(sponsorC, acceptedCounterEvent);
    await transition(organizer, acceptedCounterProposal.body.proposal._id, 'countered', { amount: 700 });
    expect((await transition(sponsorC, acceptedCounterProposal.body.proposal._id, 'accepted')).status).toBe(200);
  }, 20000);

  it('atomically prevents two acceptances from overselling the final slot', async () => {
    const event = await createPublishedEvent(organizer, {
      tiers: [{ name: 'One Slot', price: 300, slots: 1, benefits: ['Logo'] }],
    });
    const [proposalA, proposalB] = await Promise.all([
      submitProposal(sponsorA, event),
      submitProposal(sponsorB, event),
    ]);
    expect(proposalA.status).toBe(201);
    expect(proposalB.status).toBe(201);

    const results = await Promise.all([
      transition(organizer, proposalA.body.proposal._id, 'accepted'),
      transition(organizer, proposalB.body.proposal._id, 'accepted'),
    ]);
    expect(results.map((result) => result.status).sort()).toEqual([200, 409]);

    const updatedEvent = await Event.findById(event._id);
    expect(updatedEvent.tiers.id(event.tiers[0]._id).slotsFilled).toBe(1);
  });

  it('releases accepted slots and deletes deliverables when withdrawn', async () => {
    const event = await createPublishedEvent();
    const proposal = await submitProposal(sponsorA, event);
    await transition(organizer, proposal.body.proposal._id, 'accepted');

    const withdrawn = await transition(sponsorA, proposal.body.proposal._id, 'withdrawn');
    expect(withdrawn.status).toBe(200);
    expect(await Deliverable.countDocuments({ proposal: proposal.body.proposal._id })).toBe(0);
    const updatedEvent = await Event.findById(event._id);
    expect(updatedEvent.tiers.id(event.tiers[0]._id).slotsFilled).toBe(0);
  });

  it('hides proposals from non-participants and notifies participants', async () => {
    const event = await createPublishedEvent();
    const created = await submitProposal(sponsorA, event);
    const proposalId = created.body.proposal._id;

    const organizerNotifications = await organizer.get('/api/notifications');
    expect(organizerNotifications.status).toBe(200);
    expect(organizerNotifications.body.notifications.some(
      (notification) => notification.text === `New proposal for ${event.title}`,
    )).toBe(true);
    expect(organizerNotifications.body.unreadCount).toBeGreaterThan(0);

    const outsider = await sponsorD.get(`/api/proposals/${proposalId}`);
    expect(outsider.status).toBe(404);
    expect((await transition(sponsorD, proposalId, 'withdrawn')).status).toBe(404);

    const changed = await transition(organizer, proposalId, 'countered', {
      amount: 600,
      note: 'Please consider this offer.',
    });
    expect(changed.status).toBe(200);
    const sponsorNotifications = await sponsorA.get('/api/notifications');
    expect(sponsorNotifications.body.notifications.some(
      (notification) => notification.text.includes('was countered'),
    )).toBe(true);

    const recountered = await transition(sponsorA, proposalId, 'pending', {
      amount: 550,
      note: 'Here is a revised offer.',
    });
    expect(recountered.status).toBe(200);
    const organizerAfterRecounter = await organizer.get('/api/notifications');
    expect(organizerAfterRecounter.body.notifications.some(
      (notification) => notification.text.includes('was pending'),
    )).toBe(true);

    const counteredAgain = await transition(organizer, proposalId, 'countered', {
      amount: 525,
      note: 'Final offer.',
    });
    expect(counteredAgain.status).toBe(200);
    const sponsorAfterSecondCounter = await sponsorA.get('/api/notifications');
    const thisProposalNotifications = sponsorAfterSecondCounter.body.notifications.filter(
      (notification) => notification.link === `/proposals/${proposalId}`,
    );
    expect(thisProposalNotifications.filter(
      (notification) => notification.text.includes('was countered'),
    )).toHaveLength(2);

    const rejected = await transition(sponsorA, proposalId, 'rejected');
    expect(rejected.status).toBe(200);
    const organizerAfterReject = await organizer.get('/api/notifications');
    expect(organizerAfterReject.body.notifications.some(
      (notification) => notification.text.includes('was rejected'),
    )).toBe(true);

    const ownNotification = thisProposalNotifications[0];
    const markedRead = await sponsorA.patch(`/api/notifications/${ownNotification._id}/read`);
    expect(markedRead.status).toBe(200);

    const unauthorizedRead = await sponsorB.patch(`/api/notifications/${ownNotification._id}/read`);
    expect(unauthorizedRead.status).toBe(404);

    const readAll = await sponsorA.post('/api/notifications/read-all');
    expect(readAll.status).toBe(200);
    const afterReadAll = await sponsorA.get('/api/notifications');
    expect(afterReadAll.body.unreadCount).toBe(0);

    const detail = await sponsorA.get(`/api/proposals/${proposalId}`);
    expect(detail.status).toBe(200);
    expect(detail.body.proposal.deliverables).toEqual([]);
    const sponsorList = await sponsorA.get('/api/proposals?status=rejected');
    expect(sponsorList.status).toBe(200);
    expect(sponsorList.body.proposals[0].event.title).toBe(event.title);
    expect(sponsorList.body.proposals[0].organizer.name).toBe('Proposal Organizer');
  });

  it('blocks event deletion and active tier changes while proposals are active', async () => {
    const event = await createPublishedEvent();
    const proposal = await submitProposal(sponsorA, event);
    expect(proposal.status).toBe(201);

    const deleteEvent = await organizer.delete(`/api/events/${event._id}`);
    expect(deleteEvent.status).toBe(409);

    const removeTier = await organizer.put(`/api/events/${event._id}`).send({ tiers: [] });
    expect(removeTier.status).toBe(409);

    const changeTierPrice = await organizer.put(`/api/events/${event._id}`).send({
      tiers: [{ _id: event.tiers[0]._id, price: 1000 }],
    });
    expect(changeTierPrice.status).toBe(409);
  });
});
