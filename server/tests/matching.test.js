import mongoose from 'mongoose';
import request from 'supertest';
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

vi.mock('../src/services/llm.js', () => ({
  chat: vi.fn(),
  chatJSON: vi.fn(),
  embed: vi.fn(),
}));

import app from '../src/app.js';
import { config } from '../src/config/env.js';
import Event from '../src/models/Event.js';
import Proposal from '../src/models/Proposal.js';
import User from '../src/models/User.js';
import { embedEvent } from '../src/services/embeddingService.js';
import { chatJSON, embed } from '../src/services/llm.js';
import {
  candidateProvider,
  clearMatchCache,
  scoreCandidate,
} from '../src/services/matchService.js';

const testSuffix = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
const vector = Array(768).fill(0.25);
const originalVectorCandidates = candidateProvider.vectorCandidates;
let organizer;
let sponsor;
let organizerId;
let sponsorId;

function organizerSignup(email) {
  return {
    name: 'Match Organizer',
    email,
    password: 'password123',
    role: 'organizer',
    organization: 'Match Events',
    city: 'Delhi',
    orgType: 'college',
  };
}

function sponsorSignup(email) {
  return {
    name: 'Match Sponsor',
    email,
    password: 'password123',
    role: 'sponsor',
    organization: 'Match Brand',
    city: 'Delhi',
    industry: 'Technology',
    targetAudience: 'Students',
    budgetMin: 100,
    budgetMax: 1000,
    goals: 'Build brand awareness',
  };
}

async function createPublishedEvent(overrides = {}) {
  return Event.create({
    organizer: organizerId,
    title: `Matching Event ${Math.random().toString(36).slice(2)}`,
    description: 'A technology event for students and local businesses.',
    category: 'tech',
    city: 'Delhi',
    venue: 'City Hall',
    startDate: new Date('2035-06-01T10:00:00.000Z'),
    endDate: new Date('2035-06-02T10:00:00.000Z'),
    expectedFootfall: 1000,
    audienceProfile: 'University students',
    status: 'published',
    tiers: [{ name: 'Standard', price: 500, slots: 3, benefits: ['Brand booth'] }],
    ...overrides,
  });
}

beforeAll(async () => {
  await mongoose.connect(config.mongoUri, { dbName: 'fynd_test' });
  organizer = request.agent(app);
  sponsor = request.agent(app);

  const [organizerResponse, sponsorResponse] = await Promise.all([
    organizer.post('/api/auth/signup')
      .send(organizerSignup(`matching-organizer-${testSuffix}@example.com`)),
    sponsor.post('/api/auth/signup')
      .send(sponsorSignup(`matching-sponsor-${testSuffix}@example.com`)),
  ]);
  organizerId = organizerResponse.body.user._id;
  sponsorId = sponsorResponse.body.user._id;
  await User.updateOne({ _id: sponsorId }, { $set: { embedding: vector } });
});

afterAll(async () => {
  candidateProvider.vectorCandidates = originalVectorCandidates;
  if (mongoose.connection.readyState === 1) {
    await mongoose.connection.dropDatabase();
  }
  await mongoose.disconnect();
});

beforeEach(async () => {
  candidateProvider.vectorCandidates = vi.fn().mockResolvedValue([]);
  embed.mockReset().mockResolvedValue(vector);
  chatJSON.mockReset().mockResolvedValue({ reasons: [] });
  clearMatchCache(sponsorId);
  await User.updateOne({ _id: sponsorId }, { $set: { embedding: vector } });
});

afterEach(() => {
  candidateProvider.vectorCandidates = originalVectorCandidates;
});

describe('scoreCandidate', () => {
  const matchSponsor = {
    city: 'Delhi',
    budgetMin: 100,
    budgetMax: 1000,
  };
  const matchEvent = {
    city: 'Delhi',
    expectedFootfall: 500,
    tiers: [{ price: 500 }],
  };

  it('combines the configured score weights into a percentage', () => {
    expect(scoreCandidate(matchSponsor, matchEvent, 1, 500)).toBe(100);
  });

  it('increases the score for a matching city', () => {
    const sameCity = scoreCandidate(matchSponsor, matchEvent, 0.5, 500);
    const otherCity = scoreCandidate(
      matchSponsor,
      { ...matchEvent, city: 'Pune' },
      0.5,
      500,
    );
    expect(sameCity - otherCity).toBe(10);
  });

  it('excludes events whose cheapest tier is above the sponsor budget', () => {
    expect(scoreCandidate(
      matchSponsor,
      { ...matchEvent, tiers: [{ price: 1001 }] },
      0.8,
      500,
    )).toBeNull();
  });

  it('uses a neutral semantic score when no vector score is available', () => {
    expect(scoreCandidate(matchSponsor, matchEvent, null, 500)).toBe(70);
  });
});

describe('GET /api/ai/matches', () => {
  it('requires sponsor authentication and role', async () => {
    const anonymous = await request(app).get('/api/ai/matches');
    expect(anonymous.status).toBe(401);

    const organizerResponse = await organizer.get('/api/ai/matches');
    expect(organizerResponse.status).toBe(403);
  });

  it('returns at most five scored, reasoned matches in descending order and excludes active proposals', async () => {
    const events = [];
    for (let index = 0; index < 7; index += 1) {
      events.push(await createPublishedEvent({
        title: `Ranked Event ${index}`,
        expectedFootfall: 1000 + index * 100,
      }));
    }

    await Proposal.create({
      event: events[6]._id,
      tierId: events[6].tiers[0]._id,
      sponsor: sponsorId,
      organizer: organizerId,
      tierSnapshot: {
        name: events[6].tiers[0].name,
        price: events[6].tiers[0].price,
        benefits: events[6].tiers[0].benefits,
      },
      amount: 500,
      message: 'We would like to sponsor this event.',
      status: 'accepted',
    });

    candidateProvider.vectorCandidates = vi.fn().mockResolvedValue(
      events.map((event, index) => ({ ...event.toObject(), semantic: (index + 1) / 10 })),
    );
    chatJSON.mockImplementation(async ({ messages }) => {
      const { events: eventFacts } = JSON.parse(messages[1].content);
      return {
        reasons: eventFacts.map(({ eventId }) => ({
          eventId,
          reason: 'This event reaches a relevant student audience.',
        })),
      };
    });

    const response = await sponsor.get('/api/ai/matches');
    expect(response.status).toBe(200);
    expect(response.body.matches.length).toBeLessThanOrEqual(5);
    expect(response.body.matches.every((match) => (
      match.event && typeof match.score === 'number' && match.reason
    ))).toBe(true);
    expect(response.body.matches.map((match) => match.score)).toEqual(
      [...response.body.matches.map((match) => match.score)].sort((a, b) => b - a),
    );
    expect(response.body.matches.some((match) => match.event._id === events[6]._id.toString()))
      .toBe(false);
    expect(response.body.usedFallback).toBe(false);
  });

  it('falls back to database candidates when vector search fails', async () => {
    await createPublishedEvent();
    candidateProvider.vectorCandidates = vi.fn().mockRejectedValue(new Error('Index unavailable'));

    const response = await sponsor.get('/api/ai/matches');
    expect(response.status).toBe(200);
    expect(response.body.usedFallback).toBe(true);
  });

  it('uses a non-empty templated reason when the LLM is unavailable', async () => {
    const events = [];
    for (let index = 0; index < 3; index += 1) {
      events.push(await createPublishedEvent({ title: `Reason Event ${index}` }));
    }
    candidateProvider.vectorCandidates = vi.fn().mockResolvedValue(
      events.map((event) => ({ ...event.toObject(), semantic: 0.8 })),
    );
    chatJSON.mockRejectedValue(new Error('LLM unavailable'));

    const response = await sponsor.get('/api/ai/matches');
    expect(response.status).toBe(200);
    expect(response.body.matches.length).toBeGreaterThan(0);
    expect(response.body.matches.every((match) => match.reason.trim().length > 0)).toBe(true);
  });

  it('does not throw when event embedding fails and publishing still succeeds', async () => {
    const event = await Event.create({
      organizer: organizerId,
      title: 'Embedding Failure Event',
      description: 'This event remains publishable when embedding is unavailable.',
      category: 'tech',
      city: 'Delhi',
      venue: 'City Hall',
      startDate: new Date('2035-06-01T10:00:00.000Z'),
      endDate: new Date('2035-06-02T10:00:00.000Z'),
      expectedFootfall: 1000,
      audienceProfile: 'University students',
      status: 'draft',
      tiers: [{ name: 'Standard', price: 500, slots: 3, benefits: ['Brand booth'] }],
    });
    embed.mockRejectedValue(new Error('Embedding provider unavailable'));

    await expect(embedEvent(event._id)).resolves.toBe(false);
    const response = await organizer.post(`/api/events/${event._id}/publish`);
    expect(response.status).toBe(200);
    expect(response.body.event.status).toBe('published');
  });
});
