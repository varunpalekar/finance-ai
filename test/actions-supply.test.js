import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { TijoriClient } from '../src/client/TijoriClient.js';
import { createMockFetch } from './mock-transport.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

test('getCorporateActions extracts authentic dividend, bonus, split history for Swaraj Engines', async () => {
  const liveHtml = readFileSync(join(__dirname, 'fixtures', 'swaraj-engines-overview.html'), 'utf-8');
  const mockFetch = createMockFetch({
    '/company/swaraj-engines-limited/': { status: 200, body: liveHtml }
  });
  const client = new TijoriClient({ fetchFn: mockFetch, cacheEnabled: false });
  const res = await client.getCorporateActions('swaraj-engines-limited');

  assert.equal(res.slug, 'swaraj-engines-limited');
  assert.ok(Array.isArray(res.dividends));
  assert.ok(res.dividends.length >= 5, 'Swaraj Engines has extensive dividend payment history');
  assert.ok(res.dividends[0].ex_date);
  assert.ok(res.dividends[0].event_details.toLowerCase().includes('dividend'));

  assert.ok(Array.isArray(res.splits));
  assert.ok(Array.isArray(res.bonuses));
  assert.ok(Array.isArray(res.rights));
});

test('getSupplyChain extracts relational products and operational supplier/customer monitorables', async () => {
  const liveHtml = readFileSync(join(__dirname, 'fixtures', 'swaraj-engines-overview.html'), 'utf-8');
  const mockFetch = createMockFetch({
    '/company/swaraj-engines-limited/': { status: 200, body: liveHtml }
  });
  const client = new TijoriClient({ fetchFn: mockFetch, cacheEnabled: false });
  const res = await client.getSupplyChain('swaraj-engines-limited');

  assert.equal(res.slug, 'swaraj-engines-limited');
  assert.ok(Array.isArray(res.operational_supplier_notes));
  assert.ok(Array.isArray(res.operational_customer_notes));
  assert.ok(Array.isArray(res.relational_products));
});

test('getCorporateActions and getSupplyChain fall back to stale SQLite cache on network outage', async () => {
  const slug = `swaraj-engines-limited-${Date.now()}`;
  const liveHtml = readFileSync(join(__dirname, 'fixtures', 'swaraj-engines-overview.html'), 'utf-8');
  let shouldFail = false;
  const mockFetch = async () => {
    if (shouldFail) {
      throw new Error('Network outage: 503 Service Unavailable');
    }
    return new Response(liveHtml, { status: 200, headers: { 'content-type': 'text/html' } });
  };
  const client = new TijoriClient({ fetchFn: mockFetch, cacheEnabled: true });

  // 1. Initial fetch populates cache
  const initialActions = await client.getCorporateActions(slug);
  assert.ok(initialActions.dividends.length >= 5);

  const initialSupply = await client.getSupplyChain(slug);
  assert.ok(Array.isArray(initialSupply.operational_supplier_notes));

  // 2. Network fails on fresh query
  shouldFail = true;
  const staleActions = await client.getCorporateActions(slug, { fresh: true });
  assert.equal(staleActions._cache_meta?.is_stale, true, 'getCorporateActions must return stale cache on network drop');
  assert.ok(staleActions.dividends.length >= 5);

  const staleSupply = await client.getSupplyChain(slug, { fresh: true });
  assert.equal(staleSupply._cache_meta?.is_stale, true, 'getSupplyChain must return stale cache on network drop');
});

test('overview HTML is cached in SQLite and shared across getCorporateActions and getSupplyChain', async () => {
  const slug = `shared-overview-${Date.now()}`;
  const liveHtml = readFileSync(join(__dirname, 'fixtures', 'swaraj-engines-overview.html'), 'utf-8');
  let networkCalls = 0;
  const mockFetch = async () => {
    networkCalls++;
    return new Response(liveHtml, { status: 200, headers: { 'content-type': 'text/html' } });
  };
  const client = new TijoriClient({ fetchFn: mockFetch, cacheEnabled: true });

  await client.getCorporateActions(slug);
  assert.equal(networkCalls, 1, 'First call fetches overview from network');

  await client.getSupplyChain(slug);
  assert.equal(networkCalls, 1, 'Second call reuses cached overview HTML without network request');
});
