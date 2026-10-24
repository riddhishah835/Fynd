import request from 'supertest';
import { describe, expect, it } from 'vitest';
import app from '../src/app.js';

describe('health route', () => {
  it('returns the service and database status', async () => {
    const response = await request(app).get('/api/health');

    expect(response.status).toBe(200);
    expect(response.body.status).toBe('ok');
    expect(['connected', 'disconnected']).toContain(response.body.db);
  });

  it('returns the standard error format for unknown routes', async () => {
    const response = await request(app).get('/api/unknown');

    expect(response.status).toBe(404);
    expect(response.body).toEqual({
      error: {
        code: 'NOT_FOUND',
        message: 'Route not found: GET /api/unknown',
        details: [],
      },
    });
  });
});
