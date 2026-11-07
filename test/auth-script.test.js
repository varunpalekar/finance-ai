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
