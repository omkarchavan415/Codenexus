'use strict';

const request = require('supertest');
const jwt = require('jsonwebtoken');
const { createApp } = require('../../src/app');
const f = require('../helpers/fixtures');

f.describeDb('auth API', () => {
  let app;
  beforeAll(async () => {
    await f.connect();
    app = createApp();
  });
  afterAll(f.disconnect);
  beforeEach(f.clearAll);

  const creds = { name: 'Asha Rao', email: 'Asha@Example.com', password: 'Password123' };

  test('GET /health reports ok when the database is up', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ status: 'ok', db: 'up' });
  });

  test('register creates a student and returns tokens, never the password hash', async () => {
    const res = await request(app).post('/api/auth/register').send(creds);
    expect(res.status).toBe(201);
    expect(res.body.user).toMatchObject({ name: 'Asha Rao', email: 'asha@example.com', role: 'student' });
    expect(res.body.accessToken).toEqual(expect.any(String));
    expect(res.body.refreshToken).toEqual(expect.any(String));
    expect(JSON.stringify(res.body)).not.toMatch(/passwordHash|\$2[aby]\$/);
  });

  test('registering cannot grant the admin role', async () => {
    const res = await request(app).post('/api/auth/register').send({ ...creds, role: 'admin' });
    expect(res.status).toBe(201);
    expect(res.body.user.role).toBe('student');
  });

  test('duplicate email is rejected, case-insensitively', async () => {
    await request(app).post('/api/auth/register').send(creds);
    const res = await request(app).post('/api/auth/register').send({ ...creds, email: 'ASHA@example.com' });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('email_taken');
  });

  test.each([
    ['short password', { password: 'abc1' }],
    ['no digit', { password: 'onlyletters' }],
    ['bad email', { email: 'nope' }],
    ['missing name', { name: '' }],
  ])('validation rejects %s', async (label, patch) => {
    const res = await request(app).post('/api/auth/register').send({ ...creds, ...patch });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('validation_error');
  });

  test('login works with the right password and fails with the wrong one', async () => {
    await request(app).post('/api/auth/register').send(creds);
    const ok = await request(app).post('/api/auth/login').send({ email: 'asha@example.com', password: 'Password123' });
    expect(ok.status).toBe(200);
    expect(ok.body.accessToken).toBeTruthy();

    const bad = await request(app).post('/api/auth/login').send({ email: 'asha@example.com', password: 'WrongPass123' });
    expect(bad.status).toBe(401);
    const unknown = await request(app).post('/api/auth/login').send({ email: 'ghost@example.com', password: 'Password123' });
    expect(unknown.status).toBe(401);
    expect(unknown.body.error.message).toBe(bad.body.error.message);
  });

  test('protected routes need a valid access token', async () => {
    expect((await request(app).get('/api/me')).status).toBe(401);
    expect((await request(app).get('/api/me').set('Authorization', 'Bearer garbage')).status).toBe(401);

    const { accessToken } = (await request(app).post('/api/auth/register').send(creds)).body;
    const res = await request(app).get('/api/me').set('Authorization', `Bearer ${accessToken}`);
    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe('asha@example.com');
  });

  test('a refresh token cannot be used as an access token, and vice versa', async () => {
    const { accessToken, refreshToken } = (await request(app).post('/api/auth/register').send(creds)).body;
    expect((await request(app).get('/api/me').set('Authorization', `Bearer ${refreshToken}`)).status).toBe(401);
    expect((await request(app).post('/api/auth/refresh').send({ refreshToken: accessToken })).status).toBe(401);
  });

  test('an expired access token is rejected', async () => {
    const { user } = (await request(app).post('/api/auth/register').send(creds)).body;
    const expired = jwt.sign({ typ: 'access', role: 'student' }, process.env.JWT_ACCESS_SECRET, { subject: user.id, expiresIn: -10 });
    const res = await request(app).get('/api/me').set('Authorization', `Bearer ${expired}`);
    expect(res.status).toBe(401);
  });

  test('refresh rotates tokens', async () => {
    const first = (await request(app).post('/api/auth/register').send(creds)).body;
    const res = await request(app).post('/api/auth/refresh').send({ refreshToken: first.refreshToken });
    expect(res.status).toBe(200);
    expect(res.body.refreshToken).not.toBe(first.refreshToken);
    const me = await request(app).get('/api/me').set('Authorization', `Bearer ${res.body.accessToken}`);
    expect(me.status).toBe(200);
  });

  test('reusing a rotated refresh token is rejected and revokes the whole token family', async () => {
    const first = (await request(app).post('/api/auth/register').send(creds)).body;
    const second = (await request(app).post('/api/auth/refresh').send({ refreshToken: first.refreshToken })).body;

    const replay = await request(app).post('/api/auth/refresh').send({ refreshToken: first.refreshToken });
    expect(replay.status).toBe(401);
    expect(replay.body.error.code).toBe('token_reused');

    const afterTheft = await request(app).post('/api/auth/refresh').send({ refreshToken: second.refreshToken });
    expect(afterTheft.status).toBe(401);
  });

  test('logout revokes the refresh token', async () => {
    const { refreshToken } = (await request(app).post('/api/auth/register').send(creds)).body;
    expect((await request(app).post('/api/auth/logout').send({ refreshToken })).status).toBe(204);
    expect((await request(app).post('/api/auth/refresh').send({ refreshToken })).status).toBe(401);
  });

  test('changing the password signs out other sessions and the new password works', async () => {
    const reg = (await request(app).post('/api/auth/register').send(creds)).body;
    const auth = { Authorization: `Bearer ${reg.accessToken}` };
    const wrong = await request(app).post('/api/me/password').set(auth).send({ currentPassword: 'Nope12345', newPassword: 'NewPassword456' });
    expect(wrong.status).toBe(401);

    const ok = await request(app).post('/api/me/password').set(auth).send({ currentPassword: 'Password123', newPassword: 'NewPassword456' });
    expect(ok.status).toBe(200);
    expect((await request(app).post('/api/auth/refresh').send({ refreshToken: reg.refreshToken })).status).toBe(401);
    expect((await request(app).post('/api/auth/login').send({ email: 'asha@example.com', password: 'NewPassword456' })).status).toBe(200);
    expect((await request(app).post('/api/auth/login').send({ email: 'asha@example.com', password: 'Password123' })).status).toBe(401);
  });

  test('unknown routes return a JSON 404 and malformed JSON a 400', async () => {
    expect((await request(app).get('/api/nope')).status).toBe(404);
    const bad = await request(app).post('/api/auth/login').set('Content-Type', 'application/json').send('{"email":');
    expect(bad.status).toBe(400);
  });

  test('security headers are set', async () => {
    const res = await request(app).get('/health');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['x-powered-by']).toBeUndefined();
  });
});
