import mongoose from 'mongoose';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import app from '../src/app.js';
import { config } from '../src/config/env.js';
import Event from '../src/models/Event.js';

const testSuffix = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
const futureStart = '2030-06-01T10:00:00.000Z';
const futureEnd = '2030-06-02T10:00:00.000Z';
let organizer;
let secondOrganizer;
let sponsor;

function organizerSignup(email) {
  return {
    name: 'Event Organizer',
    email,
    password: 'password123',
    role: 'organizer',
    organization: 'Test Festival',
    city: 'Test City',
    orgType: 'college',
  };
}

function sponsorSignup(email) {
  return {
    name: 'Event Sponsor',
    email,
    password: 'password123',
    role: 'sponsor',
    organization: 'Test Brand',
    city: 'Test City',
    industry: 'Technology',
    targetAudience: 'Students',
    budgetMin: 100,
    budgetMax: 1000,
    goals: 'Awareness',
  };
}

function eventPayload(overrides = {}) {
  return {
    title: 'Annual Campus Festival',
    description: 'A campus festival featuring technology and cultural activities.',
    category: 'tech',
    city: 'Delhi',
    venue: 'Central Grounds',
    startDate: futureStart,
    endDate: futureEnd,
    expectedFootfall: 1000,
    audienceProfile: 'University students and young professionals',
    tiers: [
      { name: 'Gold', price: 500, slots: 3, benefits: ['Main stage branding'] },
      { name: 'Silver', price: 250, slots: 5, benefits: ['Booth space'] },
    ],
    ...overrides,
  };
}

async function createEvent(agent, payload = eventPayload()) {
  const response = await agent.post('/api/events').send(payload);
  expect(response.status).toBe(201);
  return response.body.event;
}

async function publishEvent(agent, eventId) {
  const response = await agent.post(`/api/events/${eventId}/publish`);
  expect(response.status).toBe(200);
  return response.body.event;
}

beforeAll(async () => {
  await mongoose.connect(config.mongoUri, { dbName: 'fynd_test' });

  organizer = request.agent(app);
  secondOrganizer = request.agent(app);
  sponsor = request.agent(app);

  await organizer.post('/api/auth/signup').send(
    organizerSignup(`event-owner-${testSuffix}@example.com`),
  );
  await secondOrganizer.post('/api/auth/signup').send(
    organizerSignup(`event-other-${testSuffix}@example.com`),
  );
  await sponsor.post('/api/auth/signup').send(
    sponsorSignup(`event-sponsor-${testSuffix}@example.com`),
  );
});

afterAll(async () => {
  if (mongoose.connection.readyState === 1) {
    await mongoose.connection.dropDatabase();
  }
  await mongoose.disconnect();
});

describe('event routes', () => {
  it('requires authentication and organizer role to create events', async () => {
    const anonymousResponse = await request(app).post('/api/events').send(eventPayload());
    expect(anonymousResponse.status).toBe(401);

    const sponsorResponse = await sponsor.post('/api/events').send(eventPayload());
    expect(sponsorResponse.status).toBe(403);
  });

  it('creates drafts with tiers and rejects invalid event data', async () => {
    const created = await createEvent(organizer);
    expect(created.status).toBe('draft');
    expect(created.tiers).toHaveLength(2);
    expect(created.tiers[0].slotsFilled).toBe(0);

    const invalidCases = [
      { ...eventPayload(), endDate: '2030-05-31T10:00:00.000Z' },
      {
        ...eventPayload(),
        tiers: [{ name: 'Bad Price', price: -1, slots: 2, benefits: ['Benefit'] }],
      },
      {
        ...eventPayload(),
        tiers: [{ name: 'No Slots', price: 100, slots: 0, benefits: ['Benefit'] }],
      },
    ];

    for (const payload of invalidCases) {
      const response = await organizer.post('/api/events').send(payload);
      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    }
  });

  it('hides drafts from other users but shows them to their owner', async () => {
    const draft = await createEvent(organizer);

    const publicList = await sponsor.get('/api/events');
    expect(publicList.status).toBe(200);
    expect(publicList.body.events.some((event) => event._id === draft._id)).toBe(false);

    const otherUserResponse = await sponsor.get(`/api/events/${draft._id}`);
    expect(otherUserResponse.status).toBe(404);
    expect(otherUserResponse.body.error.code).toBe('NOT_FOUND');

    const ownerResponse = await organizer.get(`/api/events/${draft._id}`);
    expect(ownerResponse.status).toBe(200);
    expect(ownerResponse.body.event._id).toBe(draft._id);

    const mineResponse = await organizer.get('/api/events/mine/list');
    expect(mineResponse.status).toBe(200);
    expect(mineResponse.body.events.some((event) => event._id === draft._id)).toBe(true);
  });

  it('requires tiers to publish and exposes published events to sponsors', async () => {
    const emptyDraft = await createEvent(organizer, eventPayload({ tiers: [] }));
    const invalidPublish = await organizer.post(`/api/events/${emptyDraft._id}/publish`);
    expect(invalidPublish.status).toBe(400);
    expect(invalidPublish.body.error.code).toBe('VALIDATION_ERROR');

    const draft = await createEvent(organizer);
    const published = await publishEvent(organizer, draft._id);
    expect(published.status).toBe('published');

    const sponsorList = await sponsor.get('/api/events');
    expect(sponsorList.status).toBe(200);
    expect(sponsorList.body.events.some((event) => event._id === draft._id)).toBe(true);
  });

  it('applies city, category, price, footfall, and text filters', async () => {
    const filterPrefix = `FilterBatch-${testSuffix}`;
    const records = [
      {
        title: `${filterPrefix} Solar Summit`,
        city: 'Delhi',
        category: 'tech',
        price: 100,
        footfall: 500,
      },
      {
        title: `${filterPrefix} Jazz Night`,
        city: 'Pune',
        category: 'music',
        price: 600,
        footfall: 1500,
      },
      {
        title: `${filterPrefix} Campus Fair`,
        city: 'Delhi',
        category: 'tech',
        price: 300,
        footfall: 300,
      },
    ];

    for (const record of records) {
      const draft = await createEvent(organizer, eventPayload({
        title: record.title,
        city: record.city,
        category: record.category,
        expectedFootfall: record.footfall,
        tiers: [{
          name: 'Standard',
          price: record.price,
          slots: 3,
          benefits: ['Brand placement'],
        }],
      }));
      await publishEvent(organizer, draft._id);
    }

    const cases = [
      ['city=Delhi', [0, 2]],
      ['category=tech', [0, 2]],
      ['maxPrice=150', [0]],
      ['minFootfall=1000', [1]],
      [`q=${encodeURIComponent('Jazz Night')}`, [1]],
    ];

    for (const [filter, expectedIndexes] of cases) {
      const response = await sponsor.get(`/api/events?${filter}`);
      expect(response.status).toBe(200);
      const matchingTitles = response.body.events
        .filter((event) => event.title.startsWith(filterPrefix))
        .map((event) => event.title);
      expect(matchingTitles).toEqual(expectedIndexes.map((index) => records[index].title));
    }
  });

  it('paginates results and reports totals', async () => {
    const prefix = `Pagination-${testSuffix}`;
    for (let index = 0; index < 3; index += 1) {
      const draft = await createEvent(organizer, eventPayload({
        title: `${prefix} Event ${index}`,
      }));
      await publishEvent(organizer, draft._id);
    }

    const response = await sponsor.get(`/api/events?q=${encodeURIComponent(prefix)}&page=2&limit=2`);
    expect(response.status).toBe(200);
    expect(response.body.events).toHaveLength(1);
    expect(response.body).toMatchObject({ page: 2, limit: 2, total: 3, totalPages: 2 });
  });

  it('prevents another organizer from editing, deleting, or publishing an event', async () => {
    const draft = await createEvent(organizer);
    const updateResponse = await secondOrganizer
      .put(`/api/events/${draft._id}`)
      .send({ title: 'Changed Title' });
    const deleteResponse = await secondOrganizer.delete(`/api/events/${draft._id}`);
    const publishResponse = await secondOrganizer.post(`/api/events/${draft._id}/publish`);

    for (const response of [updateResponse, deleteResponse, publishResponse]) {
      expect(response.status).toBe(403);
      expect(response.body.error.code).toBe('FORBIDDEN');
    }
  });

  it('protects tiers with filled slots from price changes, removal, slot reduction, and deletion', async () => {
    const event = await createEvent(organizer, eventPayload({
      tiers: [{ name: 'Limited', price: 500, slots: 3, benefits: ['Main stage branding'] }],
    }));
    const tierId = event.tiers[0]._id;
    await Event.updateOne(
      { _id: event._id, 'tiers._id': tierId },
      { $set: { 'tiers.$.slotsFilled': 2 } },
    );

    const priceChange = await organizer.put(`/api/events/${event._id}`).send({
      tiers: [{ _id: tierId, price: 600 }],
    });
    const removeTier = await organizer.put(`/api/events/${event._id}`).send({ tiers: [] });
    const reduceSlots = await organizer.put(`/api/events/${event._id}`).send({
      tiers: [{ _id: tierId, slots: 1 }],
    });
    const deleteEvent = await organizer.delete(`/api/events/${event._id}`);

    for (const response of [priceChange, removeTier, reduceSlots, deleteEvent]) {
      expect(response.status).toBe(409);
      expect(response.body.error.code).toBe('CONFLICT');
    }
  });

  it('rejects non-image banner uploads without contacting Cloudinary', async () => {
    const event = await createEvent(organizer);
    const response = await organizer
      .post(`/api/events/${event._id}/banner`)
      .attach('banner', Buffer.from('not an image'), {
        filename: 'notes.txt',
        contentType: 'text/plain',
      });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
  });
});
