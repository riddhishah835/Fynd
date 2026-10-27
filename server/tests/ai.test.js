import mongoose from 'mongoose';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const llmMocks = vi.hoisted(() => ({
  chat: vi.fn(),
  chatJSON: vi.fn(),
}));

vi.mock('../src/services/llm.js', () => llmMocks);

import app from '../src/app.js';
import { config } from '../src/config/env.js';
import Event from '../src/models/Event.js';
import { aiEventResultSchema } from '../src/validators/aiValidators.js';
import AppError from '../src/utils/AppError.js';

const suffix = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
let organizer;
let sponsor;
let otherOrganizer;
let organizerUser;
let sponsorUser;
let publishedEvent;

const extractedEvent = {
  title: 'Extracted Festival',
  description: 'A festival for local technology communities.',
  category: 'tech',
  city: 'Pune',
  venue: 'City Hall',
  startDate: '2027-01-15',
  endDate: '2027-01-16',
  expectedFootfall: 800,
  audienceProfile: 'Students and local founders',
  tiers: [{
    name: 'Gold',
    price: 25000,
    slots: 2,
    benefits: ['Stage branding'],
  }],
};

function organizerPayload(email) {
  return {
    name: 'AI Organizer',
    email,
    password: 'password123',
    role: 'organizer',
    organization: 'AI Fest',
    city: 'Pune',
    orgType: 'college',
  };
}

function sponsorPayload(email) {
  return {
    name: 'AI Sponsor',
    email,
    password: 'password123',
    role: 'sponsor',
    organization: 'AI Brand',
    city: 'Pune',
    industry: 'Technology',
    targetAudience: 'Students',
    budgetMin: 10000,
    budgetMax: 50000,
    goals: 'Build brand awareness',
  };
}

async function createEvent(agent, status = 'published') {
  const created = await agent.post('/api/events').send({
    title: 'AI Test Festival',
    description: 'A technology festival for college students.',
    category: 'tech',
    city: 'Pune',
    venue: 'Main Campus',
    startDate: '2030-04-10T10:00:00.000Z',
    endDate: '2030-04-12T10:00:00.000Z',
    expectedFootfall: 1200,
    audienceProfile: 'College students and young professionals',
    tiers: [{
      name: 'Gold',
      price: 25000,
      slots: 3,
      benefits: ['Stage branding'],
    }],
  });
  expect(created.status).toBe(201);
  if (status === 'published') {
    const published = await agent.post(`/api/events/${created.body.event._id}/publish`);
    expect(published.status).toBe(200);
    return published.body.event;
  }
  return created.body.event;
}

beforeAll(async () => {
  await mongoose.connect(config.mongoUri, { dbName: 'fynd_test' });
  organizer = request.agent(app);
  sponsor = request.agent(app);
  otherOrganizer = request.agent(app);

  const signupResponses = await Promise.all([
    organizer.post('/api/auth/signup').send(organizerPayload(`ai-organizer-${suffix}@example.com`)),
    sponsor.post('/api/auth/signup').send(sponsorPayload(`ai-sponsor-${suffix}@example.com`)),
    otherOrganizer.post('/api/auth/signup')
      .send(organizerPayload(`ai-other-organizer-${suffix}@example.com`)),
  ]);
  expect(signupResponses.map(({ status }) => status)).toEqual([201, 201, 201]);
  [organizerUser, sponsorUser] = signupResponses.map(({ body }) => body.user);
  publishedEvent = await createEvent(organizer);
});

beforeEach(() => {
  vi.clearAllMocks();
  llmMocks.chatJSON.mockImplementation(async ({ schema }) => {
    const parsed = schema.safeParse(extractedEvent);
    if (!parsed.success) {
      throw new AppError(
        'AI_UNAVAILABLE',
        'AI is temporarily unavailable. You can continue without it.',
        503,
      );
    }
    return parsed.data;
  });
});

afterAll(async () => {
  if (mongoose.connection.readyState === 1) {
    await mongoose.connection.dropDatabase();
  }
  await mongoose.disconnect();
});

describe('AI endpoints', () => {
  it('restricts proposal drafting to authenticated sponsors and validates ids', async () => {
    expect((await request(app).post('/api/ai/draft-proposal').send({})).status).toBe(401);
    expect((await organizer.post('/api/ai/draft-proposal').send({})).status).toBe(403);

    const badIds = await sponsor.post('/api/ai/draft-proposal').send({
      eventId: 'invalid',
      tierId: publishedEvent.tiers[0]._id,
    });
    expect(badIds.status).toBe(400);
    expect(badIds.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects unpublished events and returns a generated sponsor draft', async () => {
    const unpublished = await createEvent(organizer, 'draft');
    const unpublishedResponse = await sponsor.post('/api/ai/draft-proposal').send({
      eventId: unpublished._id,
      tierId: unpublished.tiers[0]._id,
    });
    expect(unpublishedResponse.status).toBe(404);

    llmMocks.chat.mockResolvedValue({ content: 'We are excited to support your event.' });
    const response = await sponsor.post('/api/ai/draft-proposal').send({
      eventId: publishedEvent._id,
      tierId: publishedEvent.tiers[0]._id,
    });
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ draft: 'We are excited to support your event.' });
    expect(llmMocks.chat).toHaveBeenCalledWith(expect.objectContaining({
      messages: expect.arrayContaining([
        expect.objectContaining({ content: expect.stringContaining('AI Brand') }),
      ]),
    }));
  });

  it('trims generated drafts to a complete sentence under 1000 characters', async () => {
    llmMocks.chat.mockResolvedValue({
      content: 'A complete sentence. '.repeat(100),
    });
    const response = await sponsor.post('/api/ai/draft-proposal').send({
      eventId: publishedEvent._id,
      tierId: publishedEvent.tiers[0]._id,
      tone: 'concise',
    });
    expect(response.status).toBe(200);
    expect(response.body.draft.length).toBeLessThanOrEqual(1000);
    expect(response.body.draft).toMatch(/[.!?]$/);
  });

  it('does not report success when the model returns an empty draft', async () => {
    llmMocks.chat.mockResolvedValue({ content: '' });
    const response = await sponsor.post('/api/ai/draft-proposal').send({
      eventId: publishedEvent._id,
      tierId: publishedEvent.tiers[0]._id,
    });
    expect(response.status).toBe(503);
    expect(response.body.error.code).toBe('AI_UNAVAILABLE');
    expect(response.body.error.message).toBe('AI returned an empty draft. Please try again.');
  });

  it('returns a standard 503 when proposal drafting is unavailable', async () => {
    llmMocks.chat.mockRejectedValue(new AppError(
      'AI_UNAVAILABLE',
      'AI is temporarily unavailable. You can continue without it.',
      503,
    ));
    const response = await sponsor.post('/api/ai/draft-proposal').send({
      eventId: publishedEvent._id,
      tierId: publishedEvent.tiers[0]._id,
    });
    expect(response.status).toBe(503);
    expect(response.body.error.code).toBe('AI_UNAVAILABLE');
  });

  it('restricts event extraction to organizers and validates text length', async () => {
    expect((await request(app).post('/api/ai/extract-event').send({ text: 'long enough text' }))
      .status).toBe(401);
    expect((await sponsor.post('/api/ai/extract-event').send({ text: 'A valid event description.' }))
      .status).toBe(403);
    const tooShort = await organizer.post('/api/ai/extract-event').send({ text: 'Too short.' });
    expect(tooShort.status).toBe(400);
    expect(tooShort.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns validated extracted event JSON and rejects invalid model categories', async () => {
    const text = 'Annual technology festival in Pune for students on January 15.';
    const response = await organizer.post('/api/ai/extract-event').send({ text });
    expect(response.status).toBe(200);
    expect(response.body.event).toEqual(extractedEvent);
    expect(llmMocks.chatJSON).toHaveBeenCalledWith(expect.objectContaining({
      jsonSchema: expect.objectContaining({ type: 'object' }),
      maxTokens: 1600,
    }));

    llmMocks.chatJSON.mockImplementation(async ({ schema }) => {
      const invalid = { ...extractedEvent, category: 'unlisted-category' };
      const parsed = schema.safeParse(invalid);
      if (!parsed.success) {
        throw new AppError(
          'AI_UNAVAILABLE',
          'AI is temporarily unavailable. You can continue without it.',
          503,
        );
      }
      return parsed.data;
    });
    const invalid = await organizer.post('/api/ai/extract-event').send({ text });
    expect(invalid.status).toBe(503);
    expect(invalid.body.error.code).toBe('AI_UNAVAILABLE');
    expect(await Event.countDocuments({ organizer: organizerUser._id })).toBeGreaterThan(0);
  });

  it('uses the pasted event text when the model does not provide a description', async () => {
    const text = 'Annual technology festival in Pune for students on January 15.';
    llmMocks.chatJSON.mockResolvedValue({
      ...extractedEvent,
      description: null,
    });

    const response = await organizer.post('/api/ai/extract-event').send({ text });
    expect(response.status).toBe(200);
    expect(response.body.event.description).toBe(text);
  });
});
