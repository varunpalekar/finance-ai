import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { TijoriClient } from '../src/client/TijoriClient.js';
import { createMockFetch } from './mock-transport.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

test('getScenarioProjections extracts authentic Base, Bear, Bull odds and 5Y forward financial projections', async () => {
  const liveHtml = readFileSync(join(__dirname, 'fixtures', 'bank-of-maharashtra-shareholding.html'), 'utf-8');
  const mockFetch = createMockFetch({
    '/company/bank-of-maharashtra/shareholding/': { status: 200, body: liveHtml }
  });
  const client = new TijoriClient({ fetchFn: mockFetch, cacheEnabled: false });
  const res = await client.getScenarioProjections('bank-of-maharashtra');

  assert.equal(res.slug, 'bank-of-maharashtra');
  assert.equal(res.has_projections, true);

  // Verify 3 scenarios
  assert.equal(res.scenarios.length, 3, 'Must have Base Case, Bear Case, and Bull Case');
  const base = res.scenarios.find(s => s.scenario.toLowerCase().includes('base'));
  assert.ok(base, 'Expected Base Case');
  assert.ok(base.probability.includes('%'), `Probability must contain %, got ${base.probability}`);
  assert.ok(base.key_drivers.length > 20, 'Expected extensive qualitative key drivers');

  // Verify forward projection table
  assert.ok(res.forecasts);
  assert.ok(Array.isArray(res.forecasts.years) && res.forecasts.years.length >= 4, 'Expected forward fiscal years');
  assert.ok(Array.isArray(res.forecasts.metrics) && res.forecasts.metrics.length >= 2, 'Expected forecast metric rows');

  const revMetric = res.forecasts.metrics.find(m => m.name.toLowerCase().includes('revenue'));
  assert.ok(revMetric, 'Expected Revenue forward forecast');
  assert.ok(revMetric.cagr !== undefined, 'Expected CAGR column');
});

test('getScenarioProjections gracefully returns has_projections: false on stocks without scenario tables', async () => {
  const emptyHtml = `<html><body><table class="other_table"><tr><td>Standard Data</td></tr></table></body></html>`;
  const mockFetch = createMockFetch({
    '/company/sme-unprojected/shareholding/': { status: 200, body: emptyHtml }
  });
  const client = new TijoriClient({ fetchFn: mockFetch, cacheEnabled: false });
  const res = await client.getScenarioProjections('sme-unprojected');
  assert.equal(res.slug, 'sme-unprojected');
  assert.equal(res.has_projections, false);
  assert.deepEqual(res.scenarios, []);
  assert.equal(res.forecasts, null);
  assert.ok(res.note);
});
