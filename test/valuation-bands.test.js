import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { TijoriClient } from '../src/client/TijoriClient.js';
import { createMockFetch } from './mock-transport.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

test('getValuationBands calculates accurate 1Y, 3Y, 5Y, 10Y percentile bands from authentic Swaraj Engines daily P/E series', async () => {
  const peJson = readFileSync(join(__dirname, 'fixtures', 'swaraj-engines-pe.json'), 'utf-8');
  const overviewHtml = readFileSync(join(__dirname, 'fixtures', 'swaraj-engines-overview.html'), 'utf-8');
  const mockFetch = createMockFetch({
    '/company/swaraj-engines-limited/': { status: 200, body: overviewHtml },
    '/api/v1/ind/chartdata/298/pe/': { status: 200, body: peJson }
  });
  const client = new TijoriClient({ fetchFn: mockFetch, cacheEnabled: false });
  const res = await client.getValuationBands('swaraj-engines-limited');

  assert.equal(res.slug, 'swaraj-engines-limited');
  assert.equal(res.company_id, 298);
  assert.equal(typeof res.current_pe, 'number');
  assert.ok(res.current_pe > 10 && res.current_pe < 40, `Expected realistic P/E, got ${res.current_pe}`);

  // Verify all four timeframes are computed with valid mathematical ordering
  for (const tf of ['1y', '3y', '5y', '10y']) {
    const b = res.valuation_bands[tf];
    assert.ok(b, `Expected valuation band for ${tf}`);
    assert.ok(b.min <= b.p25, `${tf} min (${b.min}) must be <= p25 (${b.p25})`);
    assert.ok(b.p25 <= b.median, `${tf} p25 (${b.p25}) must be <= median (${b.median})`);
    assert.ok(b.median <= b.p75, `${tf} median (${b.median}) must be <= p75 (${b.p75})`);
    assert.ok(b.p75 <= b.max, `${tf} p75 (${b.p75}) must be <= max (${b.max})`);
    assert.ok(b.sample_count > 100, `${tf} sample count must exceed 100 trading days`);
  }

  // Verify peer comparison multiples extracted from overview SSR
  assert.ok(Array.isArray(res.peers));
  assert.ok(res.peers.length >= 1, 'Expected at least 1 peer company');
  assert.ok(res.peers[0].name);
  assert.equal(typeof res.loss_making_days_excluded, 'number');
});

test('getValuationBands correctly filters negative P/E loss days and reports count', async () => {
  const now = Date.now();
  const dayMs = 86400000;
  const peData = [];
  for (let i = 0; i < 400; i++) {
    const ts = now - (400 - i) * dayMs;
    // 5 negative loss-making days
    const pe = (i >= 50 && i < 55) ? -12.5 : 20.0 + (i % 5);
    peData.push([ts, pe]);
  }
  const overviewHtml = readFileSync(join(__dirname, 'fixtures', 'swaraj-engines-overview.html'), 'utf-8');
  const mockFetch = createMockFetch({
    '/company/swaraj-engines-limited/': { status: 200, body: overviewHtml },
    '/api/v1/ind/chartdata/298/pe/': { status: 200, body: JSON.stringify({ data: JSON.stringify(peData), status: 200 }) }
  });
  const client = new TijoriClient({ fetchFn: mockFetch, cacheEnabled: false });
  const res = await client.getValuationBands('swaraj-engines-limited');

  assert.equal(res.loss_making_days_excluded, 5);
  assert.ok(res.valuation_bands['1y'].min >= 20.0, 'Negative P/E values must be excluded from minimum');
  assert.equal(res.valuation_bands['5y'], null, '5Y band must be null when dataset is only 400 days');
});

test('getValuationBands uses latest observation date and does not reuse an old positive P/E', async () => {
  const latestTimestamp = Date.UTC(2026, 10, 1);
  const peData = [
    [Date.UTC(2025, 0, 1), 20],
    [Date.UTC(2026, 0, 1), 21],
    [latestTimestamp, -10],
  ];
  const overviewHtml = readFileSync(join(__dirname, 'fixtures', 'swaraj-engines-overview.html'), 'utf-8');
  const client = new TijoriClient({
    fetchFn: createMockFetch({
      '/company/swaraj-engines-limited/': { status: 200, body: overviewHtml },
      '/api/v1/ind/chartdata/298/pe/': { status: 200, body: { data: peData } },
    }),
    cacheEnabled: false,
  });

  const result = await client.getValuationBands('swaraj-engines-limited');

  assert.equal(result.current_pe, null);
  assert.equal(result.as_of, new Date(latestTimestamp).toISOString());
});

test('getValuationBands returns clean fallback with nulls when company_id cannot be resolved', async () => {
  const mockOverviewHtml = `<html><body><script>{"symbol": "UNMAPPED"}</script></body></html>`;
  const mockFetch = createMockFetch({
    '/company/unmapped-slug/': { status: 200, body: mockOverviewHtml }
  });
  const client = new TijoriClient({ fetchFn: mockFetch, cacheEnabled: false });
  const res = await client.getValuationBands('unmapped-slug');
  assert.equal(res.slug, 'unmapped-slug');
  assert.equal(res.company_id, null);
  assert.equal(res.current_pe, null);
  assert.equal(res.valuation_bands['1y'], null);
  assert.equal(res.valuation_bands['10y'], null);
  assert.deepEqual(res.peers, []);
  assert.ok(res.note);
});

test('getValuationBands falls back to stale SQLite cache on network outage', async () => {
  const slug = `swaraj-val-${Date.now()}`;
  const peJson = readFileSync(join(__dirname, 'fixtures', 'swaraj-engines-pe.json'), 'utf-8');
  const overviewHtml = readFileSync(join(__dirname, 'fixtures', 'swaraj-engines-overview.html'), 'utf-8');
  let shouldFail = false;
  const mockFetch = async (url) => {
    if (shouldFail) throw new Error('503 Service Unavailable');
    if (url.includes('/chartdata/')) {
      return new Response(peJson, { status: 200, headers: { 'content-type': 'application/json' } });
    }
    return new Response(overviewHtml, { status: 200, headers: { 'content-type': 'text/html' } });
  };
  const client = new TijoriClient({ fetchFn: mockFetch, cacheEnabled: true });

  const initial = await client.getValuationBands(slug);
  assert.equal(initial.slug, slug);
  assert.ok(initial.valuation_bands['1y']);

  shouldFail = true;
  const fallback = await client.getValuationBands(slug, { fresh: true });
  assert.equal(fallback._cache_meta?.is_stale, true, 'Must return stale valuation bands on network drop');
  assert.ok(fallback.valuation_bands['1y']);
});
