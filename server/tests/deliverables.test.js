import mongoose from 'mongoose';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import app from '../src/app.js';
import { config } from '../src/config/env.js';
import Deliverable from '../src/models/Deliverable.js';
import Event from '../src/models/Event.js';
import Notification from '../src/models/Notification.js';

const suffix = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
let organizer;
let sponsor;
let otherSponsor;
let organizerUser;
let sponsorUser;

function organizerPayload() {
  return {
    name: 'Delivery Organizer',
    email: `delivery-organizer-${suffix}@example.com`,
    password: 'password123',
    role: 'organizer',
    organization: 'Delivery Fest',
    city: 'Test City',
    orgType: 'college',
  };
}

function sponsorPayload(email, name) {
  return {
    name,
    email,
    password: 'password123',
    role: 'sponsor',
    organization: 'Delivery Co',
    city: 'Test City',
    industry: 'Technology',
    targetAudience: 'Students',
    budgetMin: 100,
    budgetMax: 5000,
    goals: 'Brand awareness',
  };
}

async function createAcceptedProposal(benefits = ['Logo placement', 'Social post']) {
  const eventResponse = await organizer.post('/api/events').send({
    title: 'Deliverable Test Event',
    description: 'An event for testing deliverable workflows.',
    category: 'tech',
    city: 'Test City',
    venue: 'Test Hall',
    startDate: '2030-04-10T10:00:00.000Z',
    endDate: '2030-04-12T10:00:00.000Z',
    expectedFootfall: 1000,
    audienceProfile: 'College students',
    tiers: [{
      name: 'Gold',
      price: 500,
      slots: 4,
      benefits,
    }],
  });
  expect(eventResponse.status).toBe(201);
  const published = await organizer.post(`/api/events/${eventResponse.body.event._id}/publish`);
  expect(published.status).toBe(200);
  const created = await sponsor.post('/api/proposals').send({
    eventId: published.body.event._id,
    tierId: published.body.event.tiers[0]._id,
    amount: 450,
    message: 'We would like to sponsor this event.',
  });
  expect(created.status).toBe(201);
  const accepted = await organizer
    .post(`/api/proposals/${created.body.proposal._id}/transition`)
    .send({ toStatus: 'accepted' });
  expect(accepted.status).toBe(200);
  const deliverables = await Deliverable.find({ proposal: accepted.body.proposal._id })
    .sort({ createdAt: 1, _id: 1 });
  return { ...accepted.body.proposal, deliverables };
}

async function update(agent, deliverableId, body) {
  return agent.patch(`/api/deliverables/${deliverableId}`).send(body);
}

beforeAll(async () => {
  await mongoose.connect(config.mongoUri, { dbName: 'fynd_test' });
  organizer = request.agent(app);
  sponsor = request.agent(app);
  otherSponsor = request.agent(app);

  const responses = await Promise.all([
    organizer.post('/api/auth/signup').send(organizerPayload()),
    sponsor.post('/api/auth/signup').send(
      sponsorPayload(`delivery-sponsor-${suffix}@example.com`, 'Delivery Sponsor'),
    ),
    otherSponsor.post('/api/auth/signup').send(
      sponsorPayload(`delivery-other-${suffix}@example.com`, 'Other Sponsor'),
    ),
  ]);
  expect(responses.map(({ status }) => status)).toEqual([201, 201, 201]);
  [organizerUser, sponsorUser] = responses.map(({ body }) => body.user);
});

afterAll(async () => {
  if (mongoose.connection.readyState === 1) {
    await mongoose.connection.dropDatabase();
  }
  await mongoose.disconnect();
});

describe('deliverable routes and workflow', () => {
  it('limits listing and updates to participants and requires authentication', async () => {
    const proposal = await createAcceptedProposal();
    const deliverableId = proposal.deliverables[0]._id;

    expect((await organizer.get(`/api/proposals/${proposal._id}/deliverables`)).status).toBe(200);
    expect((await sponsor.get(`/api/proposals/${proposal._id}/deliverables`)).body.deliverables)
      .toHaveLength(2);
    expect((await organizer.get(`/api/proposals/${proposal._id}`))
      .body.proposal.deliverables).toHaveLength(2);
    const hiddenList = await otherSponsor.get(`/api/proposals/${proposal._id}/deliverables`);
    const hiddenUpdate = await update(otherSponsor, deliverableId, {
      status: 'delivered',
      note: 'Not allowed',
    });
    expect(hiddenList.status).toBe(404);
    expect(hiddenList.body.error.code).toBe('NOT_FOUND');
    expect(hiddenUpdate.status).toBe(404);
    expect(hiddenUpdate.body.error.code).toBe('NOT_FOUND');

    expect((await request(app).get(`/api/proposals/${proposal._id}/deliverables`)).status).toBe(401);
    expect((await request(app).patch(`/api/deliverables/${deliverableId}`)
      .send({ status: 'delivered', note: 'No auth' })).status).toBe(401);
  });

  it('enforces roles, delivery proof or note, dispute notes, and terminal approval', async () => {
    const proposal = await createAcceptedProposal(['Logo placement']);
    const deliverableId = proposal.deliverables[0]._id;

    const sponsorCannotDeliver = await update(sponsor, deliverableId, {
      status: 'delivered',
      note: 'Sponsor cannot deliver',
    });
    expect(sponsorCannotDeliver.status).toBe(403);

    const noProofOrNote = await update(organizer, deliverableId, { status: 'delivered' });
    expect(noProofOrNote.status).toBe(400);
    expect(noProofOrNote.body.error.message).toBe('Add a proof file or a note');

    const delivered = await update(organizer, deliverableId, {
      status: 'delivered',
      note: 'Displayed the event logo.',
    });
    expect(delivered.status).toBe(200);
    expect(delivered.body.deliverable.status).toBe('delivered');
    expect(delivered.body.deliverable.note).toBe('Displayed the event logo.');

    const organizerCannotApprove = await update(organizer, deliverableId, {
      status: 'approved',
    });
    expect(organizerCannotApprove.status).toBe(403);
    expect((await update(sponsor, deliverableId, { status: 'disputed' })).status).toBe(400);

    const disputed = await update(sponsor, deliverableId, {
      status: 'disputed',
      note: 'The logo placement is not visible.',
    });
    expect(disputed.status).toBe(200);
    expect(disputed.body.deliverable.note).toBe('The logo placement is not visible.');

    const redelivered = await update(organizer, deliverableId, {
      status: 'delivered',
      note: 'The logo is now visible.',
    });
    expect(redelivered.status).toBe(200);
    expect((await update(sponsor, deliverableId, { status: 'approved' })).status).toBe(200);

    const terminalChange = await update(sponsor, deliverableId, {
      status: 'disputed',
      note: 'Trying to reopen an approved deliverable.',
    });
    expect(terminalChange.status).toBe(409);
    expect(terminalChange.body.error.message).toBe('Invalid status transition');
  });

  it('blocks proposal completion until every deliverable is approved, then allows completion', async () => {
    const proposal = await createAcceptedProposal(['Logo placement', 'Social post']);
    const deliverables = await Deliverable.find({ proposal: proposal._id }).sort({ createdAt: 1 });
    for (const deliverable of deliverables) {
      const response = await update(organizer, deliverable._id, {
        status: 'delivered',
        note: `Completed ${deliverable.title}.`,
      });
      expect(response.status).toBe(200);
    }

    const incomplete = await organizer
      .post(`/api/proposals/${proposal._id}/transition`)
      .send({ toStatus: 'completed' });
    expect(incomplete.status).toBe(409);

    expect((await update(sponsor, deliverables[0]._id, { status: 'approved' })).status).toBe(200);
    const stillIncomplete = await organizer
      .post(`/api/proposals/${proposal._id}/transition`)
      .send({ toStatus: 'completed' });
    expect(stillIncomplete.status).toBe(409);

    expect((await update(sponsor, deliverables[1]._id, { status: 'approved' })).status).toBe(200);
    const completed = await organizer
      .post(`/api/proposals/${proposal._id}/transition`)
      .send({ toStatus: 'completed' });
    expect(completed.status).toBe(200);
    expect(completed.body.proposal.status).toBe('completed');
    expect((await update(organizer, deliverables[0]._id, { status: 'delivered' })).status).toBe(409);
  });

  it('locks deliverables after proposal withdrawal', async () => {
    const proposal = await createAcceptedProposal(['Logo placement']);
    const withdrawn = await organizer
      .post(`/api/proposals/${proposal._id}/transition`)
      .send({ toStatus: 'withdrawn' });
    expect(withdrawn.status).toBe(200);

    const locked = await update(organizer, proposal.deliverables[0]._id, {
      status: 'delivered',
      note: 'Cannot update after withdrawal.',
    });
    expect(locked.status).toBe(409);
    expect(locked.body.error.message).toBe('Deliverables are locked for this proposal');
  });

  it('notifies the other participant for each deliverable status change', async () => {
    const proposal = await createAcceptedProposal(['Logo placement']);
    const deliverableId = proposal.deliverables[0]._id;
    const link = `/proposals/${proposal._id}`;

    await update(organizer, deliverableId, { status: 'delivered', note: 'First delivery.' });
    await update(sponsor, deliverableId, { status: 'disputed', note: 'Needs correction.' });
    await update(organizer, deliverableId, { status: 'delivered', note: 'Corrected delivery.' });
    await update(sponsor, deliverableId, { status: 'approved' });

    const organizerNotifications = await Notification.find({
      user: organizerUser._id,
      link,
      type: { $in: ['deliverable_delivered', 'deliverable_approved', 'deliverable_disputed'] },
    }).sort({ _id: 1 });
    const sponsorNotifications = await Notification.find({
      user: sponsorUser._id,
      link,
      type: { $in: ['deliverable_delivered', 'deliverable_approved', 'deliverable_disputed'] },
    }).sort({ _id: 1 });
    expect(organizerNotifications.map(({ type }) => type)).toEqual(['deliverable_disputed', 'deliverable_approved']);
    expect(sponsorNotifications.map(({ type }) => type)).toEqual(['deliverable_delivered', 'deliverable_delivered']);
    expect([...organizerNotifications, ...sponsorNotifications]
      .every(({ text }) => text.includes('Logo placement'))).toBe(true);
  });

  it('rejects unsupported proof file types without uploading to Cloudinary', async () => {
    const proposal = await createAcceptedProposal(['Logo placement']);
    const response = await organizer
      .post(`/api/deliverables/${proposal.deliverables[0]._id}/proof`)
      .attach('proof', Buffer.from('not an image'), {
        filename: 'proof.txt',
        contentType: 'text/plain',
      });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
    expect(response.body.error.message).toBe('Only JPEG, PNG, WebP, and PDF files are allowed');
  });
});
