import { describe, it, expect, beforeAll } from 'vitest';
import { handleAuth } from '../auth.js';
import { handleEntries } from '../entries.js';
import { handleProfile } from '../profile.js';
import { signJWT, hashPassword } from '../../utils.js';

// ── Mock D1 database using in-memory SQLite via better-sqlite3 ──
// Since we can't use the Workers pool, we test route handlers directly
// with a mock env object that has a minimal D1-compatible interface.

// We'll use a simpler approach: test the pure logic and request/response
// shapes without a real D1. For full integration tests with D1,
// use `wrangler dev --local` + fetch.

// ── Mock helpers ───────────────────────────────────────────
function makeRequest(method, path, body = null, headers = {}) {
  const url = `http://localhost${path}`;
  const init = { method, headers: { 'Content-Type': 'application/json', ...headers } };
  if (body) init.body = JSON.stringify(body);
  return new Request(url, init);
}

// ── JWT / Password tests (pure functions) ──────────────────
describe('JWT utilities', () => {
  const secret = 'test-secret-key-12345';

  it('signJWT returns a string token', async () => {
    const token = await signJWT({ userId: 1, email: 'test@test.com' }, secret);
    expect(typeof token).toBe('string');
    expect(token.split('.')).toHaveLength(3); // header.payload.signature
  });

  it('signJWT encodes payload correctly', async () => {
    const token = await signJWT({ userId: 42, email: 'luca@test.com', name: 'Luca' }, secret);
    // Decode payload (middle part)
    const payload = JSON.parse(atob(token.split('.')[1]));
    expect(payload.userId).toBe(42);
    expect(payload.email).toBe('luca@test.com');
    expect(payload.exp).toBeGreaterThan(Date.now() / 1000);
  });

  it('signJWT sets expiry ~7 days from now', async () => {
    const token = await signJWT({ userId: 1 }, secret);
    const payload = JSON.parse(atob(token.split('.')[1]));
    const daysUntilExpiry = (payload.exp - Date.now() / 1000) / 86400;
    expect(daysUntilExpiry).toBeGreaterThan(6);
    expect(daysUntilExpiry).toBeLessThan(8);
  });

  it('different secrets produce different tokens', async () => {
    const token1 = await signJWT({ userId: 1 }, 'secret-a');
    const token2 = await signJWT({ userId: 1 }, 'secret-b');
    expect(token1).not.toBe(token2);
  });
});

describe('Password hashing', () => {
  it('hashPassword returns a string', async () => {
    const hash = await hashPassword('mypassword');
    expect(typeof hash).toBe('string');
    expect(hash.length).toBeGreaterThan(0);
  });

  it('same password produces same hash', async () => {
    const hash1 = await hashPassword('consistent');
    const hash2 = await hashPassword('consistent');
    expect(hash1).toBe(hash2);
  });

  it('different passwords produce different hashes', async () => {
    const hash1 = await hashPassword('password1');
    const hash2 = await hashPassword('password2');
    expect(hash1).not.toBe(hash2);
  });

  it('hash is not the plaintext password', async () => {
    const hash = await hashPassword('mysecretpass');
    expect(hash).not.toBe('mysecretpass');
  });
});

// ── Route handler shape tests ──────────────────────────────
// These test that handlers return proper Response objects with
// correct status codes for edge cases, without needing a real DB.

describe('Auth route validation', () => {
  const mockEnv = { JWT_SECRET: 'test-secret', DB: null };

  it('register rejects missing fields', async () => {
    const req = makeRequest('POST', '/api/auth/register', { name: 'Only Name' });
    const res = await handleAuth(req, mockEnv, '/api/auth/register');
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBeTruthy();
  });

  it('login rejects missing fields', async () => {
    const req = makeRequest('POST', '/api/auth/login', { email: 'only@email.com' });
    const res = await handleAuth(req, mockEnv, '/api/auth/login');
    expect(res.status).toBe(400);
  });

  it('refresh rejects missing token', async () => {
    const req = makeRequest('POST', '/api/auth/refresh');
    const res = await handleAuth(req, mockEnv, '/api/auth/refresh');
    expect(res.status).toBe(401);
  });

  it('refresh rejects invalid token', async () => {
    const req = makeRequest('POST', '/api/auth/refresh', null, {
      Authorization: 'Bearer totally.invalid.token',
    });
    const res = await handleAuth(req, mockEnv, '/api/auth/refresh');
    expect(res.status).toBe(401);
  });

  it('unknown auth path returns 404', async () => {
    const req = makeRequest('GET', '/api/auth/unknown');
    const res = await handleAuth(req, mockEnv, '/api/auth/unknown');
    expect(res.status).toBe(404);
  });
});

describe('Entries route auth guard', () => {
  it('rejects requests without auth token', async () => {
    const req = makeRequest('GET', '/api/entries/today');
    const res = await handleEntries(req, { JWT_SECRET: 'test', DB: null }, '/api/entries/today');
    expect(res.status).toBe(401);
  });

  it('rejects POST without auth token', async () => {
    const req = makeRequest('POST', '/api/entries', { calories: 500 });
    const res = await handleEntries(req, { JWT_SECRET: 'test', DB: null }, '/api/entries');
    expect(res.status).toBe(401);
  });
});

describe('Profile route auth guard', () => {
  it('rejects GET without auth token', async () => {
    const req = makeRequest('GET', '/api/profile');
    const res = await handleProfile(req, { JWT_SECRET: 'test', DB: null }, '/api/profile');
    expect(res.status).toBe(401);
  });

  it('rejects PUT without auth token', async () => {
    const req = makeRequest('PUT', '/api/profile', { name: 'Hacker' });
    const res = await handleProfile(req, { JWT_SECRET: 'test', DB: null }, '/api/profile');
    expect(res.status).toBe(401);
  });
});

// ── Response shape tests ───────────────────────────────────
describe('Response format', () => {
  it('error responses have CORS headers', async () => {
    const req = makeRequest('POST', '/api/auth/register', { name: 'Only Name' });
    const res = await handleAuth(req, { JWT_SECRET: 'test', DB: null }, '/api/auth/register');
    expect(res.headers.get('Access-Control-Allow-Origin')).toBeTruthy();
  });

  it('error responses are JSON', async () => {
    const req = makeRequest('POST', '/api/auth/login', {});
    const res = await handleAuth(req, { JWT_SECRET: 'test', DB: null }, '/api/auth/login');
    const contentType = res.headers.get('Content-Type');
    expect(contentType).toContain('application/json');
  });
});
