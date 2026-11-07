import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { test } from 'node:test';
import { TijoriClient } from '../src/client/TijoriClient.js';

test('TijoriClient throws clean error when session file is missing and headers requested', () => {
  const client = new TijoriClient({ sessionPath: '/tmp/nonexistent-session.json' });
  assert.throws(
    () => client.getHeaders(),
    /Session file not found.*npm run auth/
  );
});

test('TijoriClient dynamically reloads session without server restart when session file is updated', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tijori-auth-test-'));
  const testSessionPath = path.join(tmpDir, 'session.json');

  // Start with initial session
  fs.writeFileSync(
    testSessionPath,
    JSON.stringify([{ name: 'sessionid', value: 'old_val' }, { name: 'csrftoken', value: 'old_csrf' }])
  );

  const client = new TijoriClient({ sessionPath: testSessionPath, cacheEnabled: false });
  assert.equal(client.getHeaders()['Cookie'], 'sessionid=old_val; csrftoken=old_csrf');

  // Simulate user running npm run auth in another process (updates file on disk)
  // Ensure mtime changes by updating with slight sleep or utimes
  fs.writeFileSync(
    testSessionPath,
    JSON.stringify([{ name: 'sessionid', value: 'new_val' }, { name: 'csrftoken', value: 'new_csrf' }])
  );
  const future = new Date(Date.now() + 2000);
  fs.utimesSync(testSessionPath, future, future);

  // Client should reflect updated credentials without restart
  const newHeaders = client.getHeaders();
  assert.equal(newHeaders['Cookie'], 'sessionid=new_val; csrftoken=new_csrf');
  assert.equal(newHeaders['X-CSRFToken'], 'new_csrf');

  fs.rmSync(tmpDir, { recursive: true, force: true });
});

test('validateSession identifies missing, invalid, and expired sessions', async () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tijori-val-test-'));
  const testSessionPath = path.join(tmpDir, 'session.json');

  // Case 1: Missing file
  const clientMissing = new TijoriClient({ sessionPath: path.join(tmpDir, 'nonexistent.json') });
  const resMissing = await clientMissing.validateSession();
  assert.equal(resMissing.valid, false);
  assert.equal(resMissing.reason, 'SESSION_MISSING');

  // Case 2: File exists but has no sessionid cookie
  fs.writeFileSync(testSessionPath, JSON.stringify([{ name: 'other_cookie', value: '123' }]));
  const clientNoSessionId = new TijoriClient({ sessionPath: testSessionPath });
  const resNoSessionId = await clientNoSessionId.validateSession();
  assert.equal(resNoSessionId.valid, false);
  assert.equal(resNoSessionId.reason, 'SESSIONID_MISSING');

  // Case 3: File has sessionid, live probe returns 302 redirecting to /account/signin/ (guest/expired)
  fs.writeFileSync(testSessionPath, JSON.stringify([{ name: 'sessionid', value: 'guest_abc' }]));
  const mockFetchExpired = async () => ({
    status: 302,
    headers: new Headers({ location: '/account/signin/?next=/alerts/' }),
  });
  const clientExpired = new TijoriClient({ sessionPath: testSessionPath, fetchFn: mockFetchExpired });
  const resExpired = await clientExpired.validateSession({ probe: true });
  assert.equal(resExpired.valid, false);
  assert.equal(resExpired.reason, 'NOT_AUTHENTICATED');

  // Case 4: File has sessionid, live probe returns 200 OK (authenticated)
  const mockFetchValid = async () => ({
    status: 200,
    headers: new Headers(),
  });
  const clientValid = new TijoriClient({ sessionPath: testSessionPath, fetchFn: mockFetchValid });
  const resValid = await clientValid.validateSession({ probe: true });
  assert.equal(resValid.valid, true);

  fs.rmSync(tmpDir, { recursive: true, force: true });
});

test('getUserInfo extracts authentication status and plan tier from subscription page', async () => {
  const htmlAuth = `
    <html>
      <script>
        window.clarity("set", "plan_tier", "pro");
        var user = { is_authenticated: true };
      </script>
    </html>
  `;
  const mockFetch = async () => ({
    status: 200,
    text: async () => htmlAuth,
  });

  const client = new TijoriClient({ fetchFn: mockFetch, cacheEnabled: false });
  const info = await client.getUserInfo();
  assert.equal(info.is_authenticated, true);
  assert.equal(info.plan_tier, 'pro');
  assert.equal(info.session_type, 'authenticated');
});
