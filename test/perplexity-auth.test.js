import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { PerplexityClient } from '../src/client/PerplexityClient.js';

describe('Perplexity Session Governance', () => {
  test('validateSession identifies missing session file', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pplx-auth-'));
    const client = new PerplexityClient({ sessionPath: path.join(tmpDir, 'nonexistent.json') });
    const res = await client.validateSession({ probe: false });
    assert.equal(res.valid, false);
    assert.equal(res.reason, 'SESSION_MISSING');
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  test('validateSession identifies missing session token in cookie array', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pplx-auth-'));
    const sessionFile = path.join(tmpDir, 'perplexity_session.json');
    fs.writeFileSync(sessionFile, JSON.stringify({ cookies: [{ name: 'other_cookie', value: '123' }] }));

    const client = new PerplexityClient({ sessionPath: sessionFile });
    const res = await client.validateSession({ probe: false });
    assert.equal(res.valid, false);
    assert.equal(res.reason, 'SESSION_TOKEN_MISSING');
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  test('validateSession probes live endpoint and detects 401/403 expired session', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pplx-auth-'));
    const sessionFile = path.join(tmpDir, 'perplexity_session.json');
    fs.writeFileSync(sessionFile, JSON.stringify({
      cookies: [{ name: '__Secure-next-auth.session-token', value: 'expired_token' }]
    }));

    const client = new PerplexityClient({ sessionPath: sessionFile });
    client._rawFetch = async () => ({
      ok: false,
      status: 403,
      statusText: 'Forbidden'
    });

    const res = await client.validateSession({ probe: true });
    assert.equal(res.valid, false);
    assert.equal(res.reason, 'NOT_AUTHENTICATED');
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  test('dynamically reloads session from disk without restarting client when file updates', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pplx-auth-'));
    const sessionFile = path.join(tmpDir, 'perplexity_session.json');
    fs.writeFileSync(sessionFile, JSON.stringify({
      cookies: [{ name: '__Secure-next-auth.session-token', value: 'initial_token' }]
    }));

    const client = new PerplexityClient({ sessionPath: sessionFile });
    assert.ok(client.getCookieHeader().includes('initial_token'));

    // Simulate external login writing new file
    fs.writeFileSync(sessionFile, JSON.stringify({
      cookies: [{ name: '__Secure-next-auth.session-token', value: 'refreshed_token' }]
    }));
    const future = new Date(Date.now() + 2000);
    fs.utimesSync(sessionFile, future, future);

    assert.ok(client.getCookieHeader().includes('refreshed_token'));
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  test('filters out third-party cookies from Cookie header to prevent credential leakage', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pplx-auth-'));
    const sessionFile = path.join(tmpDir, 'perplexity_session.json');
    fs.writeFileSync(sessionFile, JSON.stringify({
      cookies: [
        { name: '__Secure-next-auth.session-token', value: 'pplx_token', domain: '.perplexity.ai' },
        { name: 'SSID', value: 'google_secret_token', domain: '.google.com' },
        { name: 'oauth_state', value: 'state_123', domain: 'accounts.google.com' }
      ]
    }));

    const client = new PerplexityClient({ sessionPath: sessionFile });
    const cookieHeader = client.getCookieHeader();

    assert.ok(cookieHeader.includes('pplx_token'));
    assert.equal(cookieHeader.includes('google_secret_token'), false, 'Must not leak Google cookies');
    assert.equal(cookieHeader.includes('state_123'), false, 'Must not leak Google OAuth cookies');
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });
});
