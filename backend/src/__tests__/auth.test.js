/**
 * auth.test.js — Integration tests for /api/auth routes
 * Requires a test PostgreSQL DB with migrations applied.
 */
require('dotenv').config({ path: '.env.test' });
const request = require('supertest');
const { app } = require('../index');
const db      = require('../db');

const TEST_USER = {
  username:     'testuser_auth',
  email:        'testauth@eg-sim-test.local',
  password:     'TestPass1!',
  display_name: 'Test Auth User',
};

let accessToken, refreshToken;

afterAll(async () => {
  await db.query('DELETE FROM users WHERE email = $1', [TEST_USER.email]);
  await db.pool.end();
});

describe('POST /api/auth/register', () => {
  it('registers a new user and returns tokens', async () => {
    const res = await request(app).post('/api/auth/register').send(TEST_USER);
    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('accessToken');
    expect(res.body).toHaveProperty('refreshToken');
    expect(res.body.user.username).toBe(TEST_USER.username);
    expect(res.body.user).not.toHaveProperty('password_hash');
    accessToken  = res.body.accessToken;
    refreshToken = res.body.refreshToken;
  });

  it('rejects duplicate email', async () => {
    const res = await request(app).post('/api/auth/register').send(TEST_USER);
    expect(res.status).toBe(409);
  });

  it('rejects weak password', async () => {
    const res = await request(app).post('/api/auth/register').send({ ...TEST_USER, email: 'x@y.com', password: 'weak' });
    expect(res.status).toBe(422);
  });
});

describe('POST /api/auth/login', () => {
  it('logs in with correct credentials', async () => {
    const res = await request(app).post('/api/auth/login').send({ email: TEST_USER.email, password: TEST_USER.password });
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('accessToken');
    accessToken  = res.body.accessToken;
    refreshToken = res.body.refreshToken;
  });

  it('rejects wrong password', async () => {
    const res = await request(app).post('/api/auth/login').send({ email: TEST_USER.email, password: 'wrongpassword' });
    expect(res.status).toBe(401);
  });

  it('rejects unknown email', async () => {
    const res = await request(app).post('/api/auth/login').send({ email: 'nobody@nowhere.com', password: 'irrelevant' });
    expect(res.status).toBe(401);
  });
});

describe('GET /api/auth/me', () => {
  it('returns user profile with valid token', async () => {
    const res = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${accessToken}`);
    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe(TEST_USER.email);
  });

  it('returns 401 with no token', async () => {
    const res = await request(app).get('/api/auth/me');
    expect(res.status).toBe(401);
  });

  it('returns 401 with invalid token', async () => {
    const res = await request(app).get('/api/auth/me').set('Authorization', 'Bearer invalid.token.here');
    expect(res.status).toBe(401);
  });
});

describe('POST /api/auth/refresh', () => {
  it('returns new access token with valid refresh token', async () => {
    const res = await request(app).post('/api/auth/refresh').send({ refreshToken });
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('accessToken');
    accessToken  = res.body.accessToken;
    refreshToken = res.body.refreshToken;
  });

  it('rejects invalid refresh token', async () => {
    const res = await request(app).post('/api/auth/refresh').send({ refreshToken: 'invalid-token' });
    expect(res.status).toBe(401);
  });
});

describe('POST /api/auth/logout', () => {
  it('logs out and invalidates refresh token', async () => {
    const logoutRes = await request(app).post('/api/auth/logout').set('Authorization', `Bearer ${accessToken}`);
    expect(logoutRes.status).toBe(200);
    // Refresh token should now be revoked
    const refreshRes = await request(app).post('/api/auth/refresh').send({ refreshToken });
    expect(refreshRes.status).toBe(401);
  });
});
