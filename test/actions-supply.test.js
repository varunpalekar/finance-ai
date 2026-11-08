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
