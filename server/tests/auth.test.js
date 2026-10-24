import cookieParser from 'cookie-parser';
import express from 'express';
import mongoose from 'mongoose';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import app from '../src/app.js';
import { config } from '../src/config/env.js';
import { errorHandler } from '../src/middleware/errorHandler.js';
import { requireAuth, requireRole } from '../src/middleware/auth.js';
import { signToken } from '../src/utils/token.js';

const testSuffix = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
let organizerAgent;
let sponsorAgent;
let organizerEmail;
let sponsorEmail;

function organizerData(email = `organizer-${testSuffix}@example.com`) {
  return {
    name: 'Test Organizer',
    email,
    password: 'password123',
    role: 'organizer',
    organization: 'Test College',
    city: 'Test City',
    orgType: 'college',
  };
}

function sponsorData(email = `sponsor-${testSuffix}@example.com`) {
  return {
    name: 'Test Sponsor',
    email,
    password: 'sponsor1234',
    role: 'sponsor',
    organization: 'Test Company',
    city: 'Test City',
    industry: 'Technology',
    targetAudience: 'Students',
    budgetMin: 100,
    budgetMax: 1000,
    goals: 'Build awareness',
  };
}

async function signup(data) {
  return request.agent(app).post('/api/auth/signup').send(data);
}

beforeAll(async () => {
  await mongoose.connect(config.mongoUri, { dbName: 'fynd_test' });
  organizerEmail = `role-organizer-${testSuffix}@example.com`;
  sponsorEmail = `role-sponsor-${testSuffix}@example.com`;

  organizerAgent = request.agent(app);
  sponsorAgent = request.agent(app);
  await organizerAgent.post('/api/auth/signup').send(organizerData(organizerEmail));
  await sponsorAgent.post('/api/auth/signup').send(sponsorData(sponsorEmail));
});

afterAll(async () => {
  if (mongoose.connection.readyState === 1) {
    await mongoose.connection.dropDatabase();
  }
  await mongoose.disconnect();
});

describe('authentication routes', () => {
  it('signs up organizers and sponsors without returning password hashes', async () => {
    const organizerResponse = await signup(organizerData());
    const sponsorResponse = await signup(sponsorData());

    expect(organizerResponse.status).toBe(201);
    expect(organizerResponse.body.user.role).toBe('organizer');
    expect(organizerResponse.body.user.passwordHash).toBeUndefined();
    expect(organizerResponse.headers['set-cookie'][0]).toContain('token=');

    expect(sponsorResponse.status).toBe(201);
    expect(sponsorResponse.body.user.role).toBe('sponsor');
    expect(sponsorResponse.body.user.passwordHash).toBeUndefined();
  });

  it('rejects duplicate emails and invalid signup data', async () => {
    const email = `duplicate-${testSuffix}@example.com`;
    expect((await signup(organizerData(email))).status).toBe(201);

    const duplicateResponse = await signup(organizerData(email));
    expect(duplicateResponse.status).toBe(409);
    expect(duplicateResponse.body.error).toMatchObject({
      code: 'CONFLICT',
      message: 'An account with this email already exists',
    });

    const weakPasswordResponse = await signup({
      ...organizerData(`weak-${testSuffix}@example.com`),
      password: 'allletters',
    });
    expect(weakPasswordResponse.status).toBe(400);
    expect(weakPasswordResponse.body.error.code).toBe('VALIDATION_ERROR');

    const incompleteSponsorResponse = await signup({
      name: 'Incomplete Sponsor',
      email: `incomplete-${testSuffix}@example.com`,
      password: 'password123',
      role: 'sponsor',
      organization: 'Test Company',
      city: 'Test City',
    });
    expect(incompleteSponsorResponse.status).toBe(400);
    expect(incompleteSponsorResponse.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('logs in with valid credentials and rejects an incorrect password', async () => {
    const email = `login-${testSuffix}@example.com`;
    await signup(organizerData(email));

    const validResponse = await request.agent(app)
      .post('/api/auth/login')
      .send({ email, password: 'password123' });
    expect(validResponse.status).toBe(200);
    expect(validResponse.headers['set-cookie'][0]).toContain('token=');
    expect(validResponse.body.user.passwordHash).toBeUndefined();

    const invalidResponse = await request(app)
      .post('/api/auth/login')
      .send({ email, password: 'wrongpass123' });
    expect(invalidResponse.status).toBe(401);
    expect(invalidResponse.body.error).toMatchObject({
      code: 'UNAUTHENTICATED',
      message: 'Invalid email or password',
    });
  });

  it('requires a cookie for the current-user endpoint', async () => {
    const anonymousResponse = await request(app).get('/api/auth/me');
    expect(anonymousResponse.status).toBe(401);

    const authenticatedResponse = await organizerAgent.get('/api/auth/me');
    expect(authenticatedResponse.status).toBe(200);
    expect(authenticatedResponse.body.user.email).toBe(organizerEmail);
    expect(authenticatedResponse.body.user.passwordHash).toBeUndefined();
  });

  it('enforces the required role on protected routes', async () => {
    const roleApp = express();
    roleApp.use(cookieParser());
    roleApp.get('/organizer-only', requireAuth, requireRole('organizer'), (req, res) => {
      res.json({ role: req.user.role });
    });
    roleApp.use(errorHandler);

    const sponsorUser = (await sponsorAgent.get('/api/auth/me')).body.user;
    const organizerUser = (await organizerAgent.get('/api/auth/me')).body.user;
    const sponsorToken = signToken(sponsorUser._id, sponsorUser.role);
    const organizerToken = signToken(organizerUser._id, organizerUser.role);
    const roleAgent = request.agent(roleApp);

    const sponsorResponse = await roleAgent
      .get('/organizer-only')
      .set('Cookie', `token=${sponsorToken}`);
    expect(sponsorResponse.status).toBe(403);
    expect(sponsorResponse.body.error).toMatchObject({
      code: 'FORBIDDEN',
      message: 'You do not have permission to do this',
    });

    const organizerResponse = await roleAgent
      .get('/organizer-only')
      .set('Cookie', `token=${organizerToken}`);
    expect(organizerResponse.status).toBe(200);
    expect(organizerResponse.body.role).toBe('organizer');
  });
});
