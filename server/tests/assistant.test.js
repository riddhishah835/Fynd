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
import Proposal from '../src/models/Proposal.js';
import Message from '../src/models/Message.js';
import Deliverable from '../src/models/Deliverable.js';
import User from '../src/models/User.js';
import AppError from '../src/utils/AppError.js';

const suffix = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
let organizer;
let sponsor;
let organizerUser;
let sponsorUser;
let publishedEvent;
let proposal;
let otherOrganizer;

function organizerPayload(email) {
  return {
    name: 'Test Organizer',
    email,
    password: 'password123',
    role: 'organizer',
    organization: 'Test Fest',
    city: 'Pune',
    orgType: 'college',
  };
}

function sponsorPayload(email) {
  return {
    name: 'Test Sponsor',
    email,
    password: 'password123',
    role: 'sponsor',
    organization: 'Test Brand',
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
    title: 'Test Festival',
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

async function createProposal(agent, eventId, tierId) {
  const response = await agent.post('/api/proposals').send({
    eventId,
    tierId,
    amount: 25000,
    message: 'We would like to sponsor your event.',
  });
  expect(response.status).toBe(201);
  return response.body.proposal;
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
  proposal = await createProposal(sponsor, publishedEvent._id, publishedEvent.tiers[0]._id);
});

beforeEach(() => {
  vi.clearAllMocks();
});

afterAll(async () => {
  if (mongoose.connection.readyState === 1) {
    await mongoose.connection.dropDatabase();
  }
  await mongoose.disconnect();
});

describe('POST /api/ai/assistant', () => {
  it('rejects unauthenticated requests', async () => {
    const response = await request(app).post('/api/ai/assistant').send({
      messages: [{ role: 'user', content: 'Hello' }],
    });
    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe('UNAUTHENTICATED');
  });

  it('rejects invalid bodies', async () => {
    const cases = [
      { messages: [] },
      { messages: [{ role: 'system', content: 'Hello' }] },
      { messages: [{ role: 'assistant', content: 'Hello' }] },
      { messages: [{ role: 'user', content: 'a'.repeat(1001) }] },
      { messages: 'not an array' },
      {},
    ];
    for (const body of cases) {
      const response = await sponsor.post('/api/ai/assistant').send(body);
      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    }
  });

  it('returns final text with toolsUsed when mock returns tool call then final text', async () => {
    llmMocks.chat
      .mockResolvedValueOnce({
        content: '',
        tool_calls: [{
          id: 'call_1',
          type: 'function',
          function: { name: 'search_events', arguments: '{"city": "Pune"}' },
        }],
      })
      .mockResolvedValueOnce({
        content: 'Found events in Pune.',
        tool_calls: [],
      });

    const response = await sponsor.post('/api/ai/assistant').send({
      messages: [{ role: 'user', content: 'Find events in Pune' }],
    });

    expect(response.status).toBe(200);
    expect(response.body.reply).toBe('Found events in Pune.');
    expect(response.body.toolsUsed).toEqual(['search_events']);

    const toolCall = llmMocks.chat.mock.calls[0][0];
    expect(toolCall.messages).toContainEqual(expect.objectContaining({ role: 'system' }));
    expect(toolCall.messages[0].content).toContain('brief direct answer first');
    expect(toolCall.tools).toBeDefined();
  });

  it('accepts longer assistant replies in recent conversation context', async () => {
    llmMocks.chat.mockResolvedValue({
      content: 'Here is a concise summary.',
      tool_calls: [],
    });

    const response = await sponsor.post('/api/ai/assistant').send({
      messages: [
        { role: 'assistant', content: 'A'.repeat(1500) },
        { role: 'user', content: 'Summarize that.' },
      ],
    });

    expect(response.status).toBe(200);
    expect(response.body.reply).toBe('Here is a concise summary.');
  });

  it('organizer calling search_events gets "Not available for your role" tool result', async () => {
    llmMocks.chat
      .mockResolvedValueOnce({
        content: '',
        tool_calls: [{
          id: 'call_1',
          type: 'function',
          function: { name: 'search_events', arguments: '{"city": "Pune"}' },
        }],
      })
      .mockResolvedValueOnce({
        content: 'I cannot search events as an organizer.',
        tool_calls: [],
      });

    const response = await organizer.post('/api/ai/assistant').send({
      messages: [{ role: 'user', content: 'Search events in Pune' }],
    });

    expect(response.status).toBe(200);
    expect(response.body.reply).toBe('I cannot search events as an organizer.');

    const toolMessage = llmMocks.chat.mock.calls[1][0].messages.find(
      m => m.role === 'tool' && m.tool_call_id === 'call_1'
    );
    expect(toolMessage).toBeDefined();
    const toolContent = JSON.parse(toolMessage.content);
    expect(toolContent.error).toBe('Not available for your role');
  });

  it('get_proposal for non-participant returns "Not found" tool result', async () => {
    llmMocks.chat
      .mockResolvedValueOnce({
        content: '',
        tool_calls: [{
          id: 'call_1',
          type: 'function',
          function: { name: 'get_proposal', arguments: `{"proposalId": "${proposal._id}"}` },
        }],
      })
      .mockResolvedValueOnce({
        content: 'You are not a participant.',
        tool_calls: [],
      });

    const response = await otherOrganizer.post('/api/ai/assistant').send({
      messages: [{ role: 'user', content: `Get proposal ${proposal._id}` }],
    });

    expect(response.status).toBe(200);
    const toolMessage = llmMocks.chat.mock.calls[1][0].messages.find(
      m => m.role === 'tool' && m.tool_call_id === 'call_1'
    );
    expect(toolMessage).toBeDefined();
    const toolContent = JSON.parse(toolMessage.content);
    expect(toolContent.error).toBe('Not found');
  });

  it('summarize_chat for non-participant returns "Not found" tool result', async () => {
    llmMocks.chat
      .mockResolvedValueOnce({
        content: '',
        tool_calls: [{
          id: 'call_1',
          type: 'function',
          function: { name: 'summarize_chat', arguments: `{"proposalId": "${proposal._id}"}` },
        }],
      })
      .mockResolvedValueOnce({
        content: 'You cannot access this chat.',
        tool_calls: [],
      });

    const response = await otherOrganizer.post('/api/ai/assistant').send({
      messages: [{ role: 'user', content: `Summarize chat ${proposal._id}` }],
    });

    expect(response.status).toBe(200);
    const toolMessage = llmMocks.chat.mock.calls[1][0].messages.find(
      m => m.role === 'tool' && m.tool_call_id === 'call_1'
    );
    expect(toolMessage).toBeDefined();
    const toolContent = JSON.parse(toolMessage.content);
    expect(toolContent.error).toBe('Not found');
  });

  it('stops after 5 rounds when mock always asks for a tool', async () => {
    llmMocks.chat.mockResolvedValue({
      content: '',
      tool_calls: [{
        id: 'call_1',
        type: 'function',
        function: { name: 'list_my_proposals', arguments: '{}' },
      }],
    });

    const response = await sponsor.post('/api/ai/assistant').send({
      messages: [{ role: 'user', content: 'List my proposals' }],
    });

    expect(response.status).toBe(200);
    expect(response.body.reply).toBeDefined();
    expect(llmMocks.chat).toHaveBeenCalledTimes(6);
  });

  it('malformed tool arguments do not crash', async () => {
    llmMocks.chat
      .mockResolvedValueOnce({
        content: '',
        tool_calls: [{
          id: 'call_1',
          type: 'function',
          function: { name: 'get_event', arguments: 'not json' },
        }],
      })
      .mockResolvedValueOnce({
        content: 'Invalid arguments provided.',
        tool_calls: [],
      });

    const response = await sponsor.post('/api/ai/assistant').send({
      messages: [{ role: 'user', content: 'Get event' }],
    });

    expect(response.status).toBe(200);
    const toolMessage = llmMocks.chat.mock.calls[1][0].messages.find(
      m => m.role === 'tool' && m.tool_call_id === 'call_1'
    );
    expect(toolMessage).toBeDefined();
    const toolContent = JSON.parse(toolMessage.content);
    expect(toolContent.error).toContain('Invalid arguments');
  });

  it('unknown tool name does not crash', async () => {
    llmMocks.chat
      .mockResolvedValueOnce({
        content: '',
        tool_calls: [{
          id: 'call_1',
          type: 'function',
          function: { name: 'unknown_tool', arguments: '{}' },
        }],
      })
      .mockResolvedValueOnce({
        content: 'Unknown tool.',
        tool_calls: [],
      });

    const response = await sponsor.post('/api/ai/assistant').send({
      messages: [{ role: 'user', content: 'Use unknown tool' }],
    });

    expect(response.status).toBe(200);
    const toolMessage = llmMocks.chat.mock.calls[1][0].messages.find(
      m => m.role === 'tool' && m.tool_call_id === 'call_1'
    );
    expect(toolMessage).toBeDefined();
    const toolContent = JSON.parse(toolMessage.content);
    expect(toolContent.error).toContain('Unknown tool');
  });

  it('suggest_tier unit: recommends most expensive affordable tier', async () => {
    const { suggestTier } = await import('../src/services/assistantTools.js');
    const mockUser = { role: 'sponsor', budgetMin: 0, budgetMax: 30000, _id: new mongoose.Types.ObjectId() };
    const mockEvent = {
      tiers: [
        { name: 'Bronze', price: 10000, slots: 5, slotsFilled: 0 },
        { name: 'Silver', price: 25000, slots: 3, slotsFilled: 0 },
        { name: 'Gold', price: 50000, slots: 2, slotsFilled: 0 },
      ],
      status: 'published',
    };

    const queryMock = { lean: vi.fn().mockResolvedValue(mockEvent) };
    vi.spyOn(Event, 'findById').mockReturnValue(queryMock);
    const result = await suggestTier({ eventId: new mongoose.Types.ObjectId().toString() }, mockUser);
    expect(result.recommended.name).toBe('Silver');
    expect(result.recommended.price).toBe(25000);
    vi.restoreAllMocks();
  });

  it('suggest_tier unit: excludes sold-out tiers', async () => {
    const { suggestTier } = await import('../src/services/assistantTools.js');
    const mockUser = { role: 'sponsor', budgetMin: 0, budgetMax: 50000, _id: new mongoose.Types.ObjectId() };
    const mockEvent = {
      tiers: [
        { name: 'Bronze', price: 10000, slots: 5, slotsFilled: 5 },
        { name: 'Silver', price: 25000, slots: 3, slotsFilled: 0 },
        { name: 'Gold', price: 50000, slots: 2, slotsFilled: 2 },
      ],
      status: 'published',
    };

    const queryMock = { lean: vi.fn().mockResolvedValue(mockEvent) };
    vi.spyOn(Event, 'findById').mockReturnValue(queryMock);
    const result = await suggestTier({ eventId: new mongoose.Types.ObjectId().toString() }, mockUser);
    expect(result.recommended.name).toBe('Silver');
    vi.restoreAllMocks();
  });

  it('suggest_tier unit: says so when nothing fits budget', async () => {
    const { suggestTier } = await import('../src/services/assistantTools.js');
    const mockUser = { role: 'sponsor', budgetMin: 0, budgetMax: 5000, _id: new mongoose.Types.ObjectId() };
    const mockEvent = {
      tiers: [
        { name: 'Bronze', price: 10000, slots: 5, slotsFilled: 0 },
        { name: 'Silver', price: 25000, slots: 3, slotsFilled: 0 },
      ],
      status: 'published',
    };

    const queryMock = { lean: vi.fn().mockResolvedValue(mockEvent) };
    vi.spyOn(Event, 'findById').mockReturnValue(queryMock);
    const result = await suggestTier({ eventId: new mongoose.Types.ObjectId().toString() }, mockUser);
    expect(result.recommended).toBeNull();
    expect(result.reasoning).toContain('No tier fits');
    vi.restoreAllMocks();
  });

  it('returns 503 with AI_UNAVAILABLE when mocked llm throws', async () => {
    llmMocks.chat.mockRejectedValue(new AppError('AI_UNAVAILABLE', 'AI is temporarily unavailable', 503));

    const response = await sponsor.post('/api/ai/assistant').send({
      messages: [{ role: 'user', content: 'Hello' }],
    });

    expect(response.status).toBe(503);
    expect(response.body.error.code).toBe('AI_UNAVAILABLE');
  });
});