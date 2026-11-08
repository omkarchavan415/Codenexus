'use strict';

/**
 * Checks that need no database: the app boots, routes are wired, and requests that are rejected
 * before any query (auth, validation, 404, bad JSON) behave. Everything that touches MongoDB is
 * covered by tests/integration.
 */
const request = require('supertest');
const { createApp } = require('../../src/app');

const app = createApp({ gemini: { enabled: false }, generationQueue: { request: async () => ({}), pending: () => 0 } });

describe('app without a database', () => {
  test('/health reports degraded (503) when MongoDB is not connected', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(503);
    expect(res.body).toMatchObject({ status: 'degraded', db: 'down', gemini: 'not_configured' });
  });

  test('/api/subjects serves the taxonomy without a database', async () => {
    const res = await request(app).get('/api/subjects');
    expect(res.status).toBe(200);
    expect(res.body.subjects.map((s) => s.key)).toEqual(['DSA', 'OOP', 'DBMS', 'SQL', 'OS', 'CN']);
  });

  test.each([
    ['get', '/api/me'],
    ['get', '/api/me/dashboard'],
    ['post', '/api/tests/start'],
    ['get', '/api/tests'],
    ['post', '/api/roadmap/generate'],
    ['get', '/api/roadmap/today'],
    ['get', '/api/skills'],
    ['get', '/api/progress'],
  ])('%s %s requires a token', async (method, url) => {
    const res = await request(app)[method](url);
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('unauthorized');
  });

  test('register and login validate input before touching the database', async () => {
    const bad = await request(app).post('/api/auth/register').send({ name: 'A', email: 'x', password: '1' });
    expect(bad.status).toBe(400);
    expect([...new Set(bad.body.error.details.map((d) => d.path))].sort()).toEqual(['email', 'name', 'password']);
    expect((await request(app).post('/api/auth/login').send({})).status).toBe(400);
    expect((await request(app).post('/api/auth/refresh').send({})).status).toBe(400);
  });

  test('unknown routes give a JSON 404 and broken JSON a 400', async () => {
    expect((await request(app).get('/nope')).body.error.code).toBe('not_found');
    const res = await request(app).post('/api/auth/login').set('Content-Type', 'application/json').send('{"a":');
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('bad_json');
  });

  test('oversized bodies are refused', async () => {
    const res = await request(app).post('/api/auth/login').send({ email: 'a@b.co', password: 'x'.repeat(300000) });
    expect(res.status).toBe(413);
  });

  test('helmet headers are set and the framework is not advertised', async () => {
    const res = await request(app).get('/health');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['x-powered-by']).toBeUndefined();
  });

  test('CORS allows the configured origin and not others', async () => {
    const ok = await request(app).get('/api/subjects').set('Origin', 'http://localhost:5173');
    expect(ok.headers['access-control-allow-origin']).toBe('http://localhost:5173');
    const other = await request(app).get('/api/subjects').set('Origin', 'https://evil.example');
    expect(other.headers['access-control-allow-origin']).toBeUndefined();
  });
});
