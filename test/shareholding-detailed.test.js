import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { TijoriClient } from '../src/client/TijoriClient.js';
import { createMockFetch } from './mock-transport.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

test('getShareholding with detailed: false preserves existing backward-compatible summary structure', async () => {
  const liveHtml = readFileSync(join(__dirname, 'fixtures', 'bank-of-maharashtra-shareholding.html'), 'utf-8');
  const mockFetch = createMockFetch({
    '/company/bank-of-maharashtra/shareholding/': { status: 200, body: liveHtml }
  });
  const client = new TijoriClient({ fetchFn: mockFetch, cacheEnabled: false });
  const res = await client.getShareholding('bank-of-maharashtra', { detailed: false });

  assert.equal(res.detailed, undefined);
  assert.ok(Array.isArray(res.quarters));
  assert.ok(res.quarters.length >= 8);
  assert.equal(typeof res.quarters[0].Promoter, 'number');
});

test('getShareholding with detailed: true parses authentic line-item domestic mutual funds, LIC, and retail tiers', async () => {
  const liveHtml = readFileSync(join(__dirname, 'fixtures', 'bank-of-maharashtra-shareholding.html'), 'utf-8');
  const mockFetch = createMockFetch({
    '/company/bank-of-maharashtra/shareholding/': { status: 200, body: liveHtml }
  });
  const client = new TijoriClient({ fetchFn: mockFetch, cacheEnabled: false });
  const res = await client.getShareholding('bank-of-maharashtra', { detailed: true });

  assert.equal(res.slug, 'bank-of-maharashtra');
  assert.equal(res.detailed, true);
  assert.ok(Array.isArray(res.quarters) && res.quarters.length >= 8, 'Expected 10-quarter timeline');

  // Verify institutional line items (LIC, Mutual Funds)
  assert.ok(Array.isArray(res.institutions) && res.institutions.length >= 2);
  const lic = res.institutions.find(i => i.name.toUpperCase().includes('LIFE INSURANCE CORPORATION'));
  assert.ok(lic, 'Expected Life Insurance Corporation of India in detailed institutions');
  assert.equal(lic.shares_pct.length, res.quarters.length);

  // Verify non-institutional retail tiers
  assert.ok(Array.isArray(res.non_institutions));
  const smallRetail = res.non_institutions.find(r => r.name.includes('< 2 lac'));
  assert.ok(smallRetail, 'Expected Individual < 2 lac retail tier');
});

test('getShareholding isolates cache keys between detailed: false and detailed: true', async () => {
  let callCount = 0;
  const liveHtml = readFileSync(join(__dirname, 'fixtures', 'bank-of-maharashtra-shareholding.html'), 'utf-8');
  const mockFetch = async () => {
    callCount++;
    return new Response(liveHtml, { status: 200, headers: { 'content-type': 'text/html' } });
  };
  const client = new TijoriClient({ fetchFn: mockFetch, cacheEnabled: true });
  const res1 = await client.getShareholding('bank-of-maharashtra', { detailed: false });
  assert.equal(res1.detailed, undefined);

  const res2 = await client.getShareholding('bank-of-maharashtra', { detailed: true });
  assert.equal(res2.detailed, true);
  assert.ok(Array.isArray(res2.institutions));
});
