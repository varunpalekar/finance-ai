import { test } from 'node:test';
import assert from 'node:assert/strict';
import { probeLiveProvider } from './live-test-utils.js';

test('live provider preflight accepts HTTP success', async () => {
  const result = await probeLiveProvider('https://provider.test', {
    fetchFn: async () => new Response(null, { status: 200 })
  });

  assert.deepEqual(result, { available: true, reason: null });
});

test('live provider preflight reports non-success status when suite is optional', async () => {
  const result = await probeLiveProvider('https://provider.test', {
    fetchFn: async () => new Response(null, { status: 403, statusText: 'Forbidden' })
  });

  assert.deepEqual(result, { available: false, reason: 'HTTP 403 Forbidden' });
});

test('live provider preflight fails explicitly on HTTP errors when suite is required', async () => {
  await assert.rejects(
    probeLiveProvider('https://provider.test', {
      fetchFn: async () => new Response(null, { status: 403, statusText: 'Forbidden' }),
      required: true
    }),
    /Live provider preflight failed: HTTP 403 Forbidden/
  );
});

test('live provider preflight reports network failures and fails required suites', async () => {
  const fetchFn = async () => {
    throw new Error('connection refused');
  };

  assert.deepEqual(
    await probeLiveProvider('https://provider.test', { fetchFn }),
    { available: false, reason: 'connection refused' }
  );
  await assert.rejects(
    probeLiveProvider('https://provider.test', { fetchFn, required: true }),
    /Live provider preflight failed: connection refused/
  );
});
