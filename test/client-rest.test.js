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

test('HTTP 500 server error triggers SWR fallback to stale cache data', async () => {
  set(
    'search:company:tata',
    [{ name: 'Tata Steel Stale', slug: 'tata-steel-limited' }],
    -1000,
    'json',
    'tata-steel-limited'
  );

  const mockFetch = async (url) => ({
    status: 500,
    url,
    headers: new Headers(),
    text: async () => 'Internal Server Error',
  });

  const client = new TijoriClient({ fetchFn: mockFetch, cacheEnabled: true });
  const results = await client.searchCompany('tata');
  assert.ok(results);
  assert.equal(results[0].name, 'Tata Steel Stale');
  assert.equal(results._cache_meta?.is_stale, true);
});

test('resolveCompanyIds does not permanently cache null company_id', async () => {
  const mockFetch = createMockFetch({
    '/company/invalid-slug/': {
      status: 200,
      body: '<html><body>No id here</body></html>'
    }
  });

  const client = new TijoriClient({ fetchFn: mockFetch, cacheEnabled: true });
  const resolved = await client.resolveCompanyIds('invalid-slug');
  assert.equal(resolved.company_id, null);

  // Verify it was NOT written into cache
  const { get } = await import('../src/cache.js');
  const cached = get('resolve:invalid-slug');
  assert.equal(cached, null);
});

test('getSectorConstituents acts as direct alias to getNicheConstituents', async () => {
  const mockFetch = createMockFetch({
    '/api/v1/niche/price/123/': {
      status: 200,
      body: [{ name: 'Test Corp', slug: 'test-corp', weight: 10, eq_weight: 10, data: [1, 2, 3] }]
    }
  });

  const client = new TijoriClient({ fetchFn: mockFetch, cacheEnabled: false });
  const resFromAlias = await client.getSectorConstituents('123');
  const resFromDirect = await client.getNicheConstituents('123');
  assert.deepEqual(resFromAlias, resFromDirect);
  assert.equal(resFromAlias.companies[0].slug, 'test-corp');
});

test('screenCompanies safely handles null or malformed condition objects without TypeError', async () => {
  let capturedQuery = null;
  const mockFetch = async (url) => {
    capturedQuery = url;
    return new Response(JSON.stringify({ total_results: 0, data: [] }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  };
  const client = new TijoriClient({ fetchFn: mockFetch, cacheEnabled: false });

  // 1. roe condition is valid, debt is null
  const res = await client.screenCompanies({
    filters: {
      roe: { min: 15 },
      debt: null,
      invalid: 'not-an-object',
    },
  });
  assert.equal(res.total_results, 0);
  assert.ok(capturedQuery.includes('ROE+%3E+15'));
});
