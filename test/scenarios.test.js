import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { TijoriClient } from '../src/client/TijoriClient.js';
import { createMockFetch } from './mock-transport.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

test('getScenarioProjections rejects sample forecasts belonging to another company', async () => {
  const liveHtml = readFileSync(join(__dirname, 'fixtures', 'bank-of-maharashtra-shareholding.html'), 'utf-8');
  const mockFetch = createMockFetch({
    '/company/bank-of-maharashtra/shareholding/': { status: 200, body: liveHtml }
  });
  const client = new TijoriClient({ fetchFn: mockFetch, cacheEnabled: false });
  const res = await client.getScenarioProjections('bank-of-maharashtra');

  assert.equal(res.slug, 'bank-of-maharashtra');
  assert.equal(res.has_projections, false);
  assert.deepEqual(res.scenarios, []);
  assert.equal(res.forecasts, null);
  assert.match(res.note, /sample|company-specific/i);
});

test('getScenarioProjections accepts a report only when its company matches the page', async () => {
  const matchingHtml = `
    <html><head><title>Acme Industries | Tijori</title></head><body>
      <div class="peg-sample__company">Acme Industries</div>
      <table class="peg-sample__table">
        <tr><th>Scenario</th><th>Probability</th><th>Key Drivers</th></tr>
        <tr><td>Base Case</td><td>50%</td><td>Verified company-specific base case</td></tr>
      </table>
    </body></html>`;
  const client = new TijoriClient({
    fetchFn: createMockFetch({ '/company/acme-industries/shareholding/': { body: matchingHtml } }),
    cacheEnabled: false
  });

  const result = await client.getScenarioProjections('acme-industries');
  assert.equal(result.has_projections, true);
  assert.equal(result.scenarios[0].scenario, 'Base Case');
  assert.equal(result.report_company, 'Acme Industries');
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
