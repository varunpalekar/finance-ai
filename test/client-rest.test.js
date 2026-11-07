import assert from 'node:assert/strict';
import { test, beforeEach } from 'node:test';
import { TijoriClient } from '../src/client/TijoriClient.js';
import { createMockFetch } from './mock-transport.js';
import { initDb, set } from '../src/cache.js';

beforeEach(() => {
  initDb(':memory:');
});

test('searchCompany returns filtered companies', async () => {
  const mockFetch = createMockFetch({
    'https://www.tijorifinance.com/api/v1/ind/company_search/?q=tata': {
      status: 200,
      body: JSON.stringify([{ name: 'Tata Steel', slug: 'tata-steel-limited', type: 'companies' }])
    }
  });
  const client = new TijoriClient({ fetchFn: mockFetch, cacheEnabled: false });
  const results = await client.searchCompany('tata');
  assert.deepEqual(results, [{ name: 'Tata Steel', slug: 'tata-steel-limited' }]);
});

test('handles redirect to /account/signin/ with SESSION_EXPIRED', async () => {
  const mockFetch = createMockFetch({
    'https://www.tijorifinance.com/api/v1/ind/company_search/?q=tata': {
      status: 200,
      url: 'https://www.tijorifinance.com/account/signin/',
      body: '<html>Sign In</html>'
    }
  });
  const client = new TijoriClient({ fetchFn: mockFetch, cacheEnabled: false });
  await assert.rejects(
    () => client.searchCompany('tata'),
    (err) => err.code === 'SESSION_EXPIRED'
  );
});

test('retries once on HTTP 429 rate limit and succeeds', async () => {
  let callCount = 0;
  const mockFetch = async (url) => {
    callCount++;
    if (callCount === 1) return { status: 429, url, headers: new Headers() };
    return {
      status: 200,
      url: 'https://www.tijorifinance.com/api/v1/ind/company_search/?q=tata',
      headers: new Headers(),
      text: async () => JSON.stringify([{ name: 'Tata Steel', slug: 'tata-steel-limited', type: 'companies' }]),
      json: async () => [{ name: 'Tata Steel', slug: 'tata-steel-limited', type: 'companies' }],
    };
  };
  const client = new TijoriClient({ fetchFn: mockFetch, cacheEnabled: false });
  const results = await client.searchCompany('tata');
  assert.equal(callCount, 2);
  assert.equal(results[0].slug, 'tata-steel-limited');
});

test('throws structured RATE_LIMITED error when HTTP 429 persists', async () => {
  const mockFetch = async (url) => ({ status: 429, url, headers: new Headers() });
  const client = new TijoriClient({ fetchFn: mockFetch, cacheEnabled: false });
  await assert.rejects(
    () => client.searchCompany('tata'),
    (err) => err.code === 'RATE_LIMITED' || err.message.includes('429')
  );
});

test('end-to-end SWR fallback: returns stale cache data with is_stale: true on network drop', async () => {
  // Pre-seed cache with expired entry (expires 1000ms in past)
  set(
    'search:company:tata',
    [{ name: 'Tata Steel Cached', slug: 'tata-steel-limited' }],
    -1000,
    'json',
    'tata-steel-limited'
  );

  // Network drops (e.g. offline / airplane mode)
  const mockFetch = async () => {
    throw new TypeError('fetch failed');
  };

  const client = new TijoriClient({ fetchFn: mockFetch, cacheEnabled: true });
  const results = await client.searchCompany('tata');
  assert.ok(results);
  assert.equal(results[0].name, 'Tata Steel Cached');
  assert.equal(results._cache_meta?.is_stale, true);
  assert.equal(results._cache_meta?.is_cached, true);
});
