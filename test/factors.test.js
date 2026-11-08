import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { TijoriClient } from '../src/client/TijoriClient.js';
import { createMockFetch } from './mock-transport.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

test('getFactorsAndBenchmarking parses authentic live Bank of Maharashtra factor scores, radar axes, and formulas', async () => {
  const liveHtml = readFileSync(join(__dirname, 'fixtures', 'bank-of-maharashtra-factors.html'), 'utf-8');
  const mockFetch = createMockFetch({
    '/company/bank-of-maharashtra/factors/': { status: 200, body: liveHtml }
  });
  const client = new TijoriClient({ fetchFn: mockFetch, cacheEnabled: false });
  const res = await client.getFactorsAndBenchmarking('bank-of-maharashtra');

  assert.equal(res.slug, 'bank-of-maharashtra');
  assert.ok(res.company_name.toLowerCase().includes('bank of maharashtra'));
  // Verify radar axes against authentic peer median benchmarks
  assert.ok(Array.isArray(res.radar_axes));
  assert.ok(res.radar_axes.length >= 2, 'Expected at least 2 radar benchmarking axes');
  for (const axis of res.radar_axes) {
    assert.equal(typeof axis.name, 'string');
    assert.ok(axis.name.length > 2);
    assert.equal(typeof axis.company_score, 'number');
    assert.ok(axis.company_score >= 0 && axis.company_score <= 10);
    assert.equal(typeof axis.peer_median, 'number');
    assert.ok(axis.peer_median >= 0 && axis.peer_median <= 10);
  }
  // Verify formula qualitative explanations
  assert.ok(Array.isArray(res.formulas));
  assert.ok(res.formulas.length >= 10, 'Expected extensive formula library for bank');
  assert.ok(res.formulas[0].name || typeof res.formulas[0] === 'string');
});

test('getFactorsAndBenchmarking gracefully handles company with missing factor data', async () => {
  const emptyHtml = `<html><head><title>Empty Stock</title></head><body><div>No factors available</div></body></html>`;
  const mockFetch = createMockFetch({
    '/company/missing-factors/factors/': { status: 200, body: emptyHtml }
  });
  const client = new TijoriClient({ fetchFn: mockFetch, cacheEnabled: false });
  const res = await client.getFactorsAndBenchmarking('missing-factors');
  assert.equal(res.slug, 'missing-factors');
  assert.deepEqual(res.radar_axes, []);
  assert.deepEqual(res.formulas, []);
  assert.ok(res.note);
});
