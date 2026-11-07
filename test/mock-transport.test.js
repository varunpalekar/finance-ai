import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createMockFetch } from './mock-transport.js';

test('createMockFetch returns canned response with valid url for registered routes', async () => {
  const url = 'https://www.tijorifinance.com/api/test';
  const mockFetch = createMockFetch({
    [url]: { status: 200, body: JSON.stringify({ ok: true }) },
  });
  const res = await mockFetch(url);
  assert.equal(res.status, 200);
  assert.equal(res.url, url);
  const data = await res.json();
  assert.deepEqual(data, { ok: true });
});
