import { createServer } from 'node:http';
import mongoose from 'mongoose';
import request from 'supertest';
import { io as createClient } from 'socket.io-client';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import app from '../src/app.js';
import { config } from '../src/config/env.js';
import Message from '../src/models/Message.js';
import Notification from '../src/models/Notification.js';
import { initSockets } from '../src/sockets/chat.js';
import { signToken } from '../src/utils/token.js';

const suffix = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
let organizer;
let sponsor;
let otherSponsor;
let organizerUser;
let sponsorUser;
let proposal;
let httpServer;
let socketServer;
let baseUrl;
const clients = new Set();

function organizerPayload() {
  return {
    name: 'Chat Organizer',
    email: `chat-organizer-${suffix}@example.com`,
    password: 'password123',
    role: 'organizer',
    organization: 'Chat Fest',
    city: 'Test City',
    orgType: 'college',
  };
}

function sponsorPayload(email, name = 'Chat Sponsor') {
  return {
    name,
    email,
    password: 'password123',
    role: 'sponsor',
    organization: 'Chat Co',
    city: 'Test City',
    industry: 'Technology',
    targetAudience: 'Students',
    budgetMin: 100,
    budgetMax: 5000,
    goals: 'Brand awareness',
  };
}

async function connectSocket(token) {
  const socket = createClient(baseUrl, {
    ...(token ? { auth: { token } } : {}),
    autoConnect: false,
    reconnection: false,
    transports: ['websocket'],
  });
  clients.add(socket);
  socket.connect();
  return socket;
}

beforeAll(async () => {
  await mongoose.connect(config.mongoUri, { dbName: 'fynd_test' });
  organizer = request.agent(app);
  sponsor = request.agent(app);
  otherSponsor = request.agent(app);

  const responses = await Promise.all([
    organizer.post('/api/auth/signup').send(organizerPayload()),
    sponsor.post('/api/auth/signup').send(sponsorPayload(`chat-sponsor-${suffix}@example.com`)),
    otherSponsor.post('/api/auth/signup').send(
      sponsorPayload(`chat-other-${suffix}@example.com`, 'Other Sponsor'),
    ),
  ]);
  expect(responses.map(({ status }) => status)).toEqual([201, 201, 201]);
  [organizerUser, sponsorUser] = responses.map(({ body }) => body.user);

  const eventResponse = await organizer.post('/api/events').send({
    title: 'Chat Test Event',
    description: 'An event for testing proposal chat.',
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
      benefits: ['Logo placement'],
    }],
  });
  expect(eventResponse.status).toBe(201);
  const publishedResponse = await organizer
    .post(`/api/events/${eventResponse.body.event._id}/publish`);
  expect(publishedResponse.status).toBe(200);
  const proposalResponse = await sponsor.post('/api/proposals').send({
    eventId: publishedResponse.body.event._id,
    tierId: publishedResponse.body.event.tiers[0]._id,
    amount: 400,
    message: 'We would like to sponsor this event.',
  });
  expect(proposalResponse.status).toBe(201);
  proposal = proposalResponse.body.proposal;

  httpServer = createServer(app);
  socketServer = initSockets(httpServer);
  await new Promise((resolve) => httpServer.listen(0, '127.0.0.1', resolve));
  baseUrl = `http://127.0.0.1:${httpServer.address().port}`;
});

afterAll(async () => {
  for (const client of clients) client.disconnect();
  if (socketServer) {
    await new Promise((resolve) => socketServer.close(resolve));
  }
  if (mongoose.connection.readyState === 1) {
    await mongoose.connection.dropDatabase();
  }
  await mongoose.disconnect();
});

describe('proposal chat routes and sockets', () => {
  it('creates and lists trimmed messages in order with sender names populated', async () => {
    const first = await sponsor.post(`/api/proposals/${proposal._id}/messages`)
      .send({ text: '  First message  ' });
    expect(first.status).toBe(201);
    expect(first.body.message.text).toBe('First message');
    expect(first.body.message.sender.name).toBe(sponsorUser.name);

    await new Promise((resolve) => setTimeout(resolve, 10));
    const second = await organizer.post(`/api/proposals/${proposal._id}/messages`)
      .send({ text: 'Second message' });
    expect(second.status).toBe(201);

    const listed = await sponsor.get(`/api/proposals/${proposal._id}/messages`);
    expect(listed.status).toBe(200);
    expect(listed.body.messages.map(({ text }) => text)).toEqual([
      'First message',
      'Second message',
    ]);
    expect(listed.body.messages[0].sender.name).toBe(sponsorUser.name);
    expect(await Message.countDocuments({ proposal: proposal._id })).toBe(2);

    const afterFirst = await sponsor.get(
      `/api/proposals/${proposal._id}/messages?after=${encodeURIComponent(first.body.message.createdAt)}`,
    );
    expect(afterFirst.body.messages.map(({ text }) => text)).toEqual(['Second message']);
  });

  it('requires proposal participation and authentication', async () => {
    const nonParticipantList = await otherSponsor.get(
      `/api/proposals/${proposal._id}/messages`,
    );
    const nonParticipantPost = await otherSponsor
      .post(`/api/proposals/${proposal._id}/messages`)
      .send({ text: 'Unauthorized message' });
    expect(nonParticipantList.status).toBe(404);
    expect(nonParticipantList.body.error.code).toBe('NOT_FOUND');
    expect(nonParticipantPost.status).toBe(404);
    expect(nonParticipantPost.body.error.code).toBe('NOT_FOUND');

    expect((await request(app).get(`/api/proposals/${proposal._id}/messages`)).status).toBe(401);
    expect((await request(app).post(`/api/proposals/${proposal._id}/messages`)
      .send({ text: 'No auth' })).status).toBe(401);
  });

  it('validates message text and enforces the one-unread-notification rule', async () => {
    const invalidEmpty = await sponsor.post(`/api/proposals/${proposal._id}/messages`)
      .send({ text: '   ' });
    const invalidLong = await sponsor.post(`/api/proposals/${proposal._id}/messages`)
      .send({ text: 'x'.repeat(1001) });
    expect(invalidEmpty.status).toBe(400);
    expect(invalidEmpty.body.error.code).toBe('VALIDATION_ERROR');
    expect(invalidLong.status).toBe(400);
    expect(invalidLong.body.error.code).toBe('VALIDATION_ERROR');

    const link = `/proposals/${proposal._id}`;
    await Notification.deleteMany({ user: organizerUser._id, type: 'message', link });
    await sponsor.post(`/api/proposals/${proposal._id}/messages`).send({ text: 'First ping' });
    await sponsor.post(`/api/proposals/${proposal._id}/messages`).send({ text: 'Second ping' });
    expect(await Notification.countDocuments({
      user: organizerUser._id,
      type: 'message',
      link,
      read: false,
    })).toBe(1);
  });

  it('returns 401 for missing or non-socket-purpose tokens', async () => {
    const missingTokenSocket = await connectSocket();
    const missingTokenError = await new Promise((resolve) => {
      missingTokenSocket.once('connect_error', resolve);
    });
    expect(missingTokenError.message).toBe('UNAUTHENTICATED');

    const wrongPurposeSocket = await connectSocket(signToken(sponsorUser._id, 'sponsor'));
    const wrongPurposeError = await new Promise((resolve) => {
      wrongPurposeSocket.once('connect_error', resolve);
    });
    expect(wrongPurposeError.message).toBe('UNAUTHENTICATED');
  });

  it('allows participants to join, rejects non-participants, and broadcasts REST messages', async () => {
    const { body: tokenResponse } = await sponsor.get('/api/auth/socket-token');
    expect(tokenResponse.token).toBeTruthy();
    const participantSocket = await connectSocket(tokenResponse.token);
    await new Promise((resolve, reject) => {
      participantSocket.once('connect', resolve);
      participantSocket.once('connect_error', reject);
    });
    const participantAck = await new Promise((resolve) => {
      participantSocket.emit('proposal:join', proposal._id, resolve);
    });
    expect(participantAck).toEqual({ ok: true });

    const nonParticipantToken = (await otherSponsor.get('/api/auth/socket-token')).body.token;
    const nonParticipantSocket = await connectSocket(nonParticipantToken);
    await new Promise((resolve, reject) => {
      nonParticipantSocket.once('connect', resolve);
      nonParticipantSocket.once('connect_error', reject);
    });
    const nonParticipantAck = await new Promise((resolve) => {
      nonParticipantSocket.emit('proposal:join', proposal._id, resolve);
    });
    expect(nonParticipantAck).toEqual({ ok: false, error: 'Not found' });

    const received = new Promise((resolve) => {
      participantSocket.once('message:new', resolve);
    });
    const messageResponse = await organizer.post(`/api/proposals/${proposal._id}/messages`)
      .send({ text: 'Socket broadcast message' });
    expect(messageResponse.status).toBe(201);
    const message = await received;
    expect(message.text).toBe('Socket broadcast message');
    expect(message.sender.name).toBe(organizerUser.name);
  });
});
