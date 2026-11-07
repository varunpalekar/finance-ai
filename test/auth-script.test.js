import assert from 'node:assert/strict';
import { test } from 'node:test';
import { TijoriClient } from '../src/client/TijoriClient.js';

test('TijoriClient throws clean error when session file is missing and headers requested', () => {
  const client = new TijoriClient({ sessionPath: '/tmp/nonexistent-session.json' });
  assert.throws(
    () => client.getHeaders(),
    /Session file not found.*npm run auth/
  );
});
