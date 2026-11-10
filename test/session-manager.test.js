import assert from 'node:assert/strict';
import { test } from 'node:test';
import { SessionManager } from '../src/client/SessionManager.js';

test('SessionManager identifies missing session file', async () => {
  const sm = new SessionManager({ sessionPath: '/tmp/nonexistent-session.json' });
  const status = await sm.validateSession({ probe: false });
  assert.equal(status.valid, false);
  assert.equal(status.reason, 'SESSION_MISSING');
});

test('SessionManager throws clear error on getHeaders when session file does not exist', () => {
  const sm = new SessionManager({ sessionPath: '/tmp/nonexistent-session.json' });
  assert.throws(
    () => sm.getHeaders(),
    /Session file not found at/
  );
});
