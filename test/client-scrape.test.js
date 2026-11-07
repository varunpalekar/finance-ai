import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { TijoriClient } from '../src/client/TijoriClient.js';
import { createMockFetch } from './mock-transport.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

test('getCompanyOverview parses ratios, inline script metadata, and market share', async () => {
  const html = readFileSync(join(__dirname, 'fixtures', 'tata-steel-overview.html'), 'utf-8');
  const mockFetch = createMockFetch({
    '/company/tata-steel-limited/': { status: 200, body: html }
  });
  const client = new TijoriClient({ fetchFn: mockFetch, cacheEnabled: false });
  const overview = await client.getCompanyOverview('tata-steel-limited');
  assert.equal(overview.slug, 'tata-steel-limited');
  assert.ok(overview.ratios);
  assert.equal(overview.ratios['PE Ratio'], '15.2');
  assert.ok(Array.isArray(overview.market_share));
  assert.equal(overview.market_share[0].metric, 'Crude Steel');
});

test('getFinancials parses table rows and headers for pl', async () => {
  const html = readFileSync(join(__dirname, 'fixtures', 'tata-steel-financials.html'), 'utf-8');
  const mockFetch = createMockFetch({
    '/company/tata-steel-limited/financials/': { status: 200, body: html }
  });
  const client = new TijoriClient({ fetchFn: mockFetch, cacheEnabled: false });
  const fin = await client.getFinancials('tata-steel-limited', 'pl');
  assert.equal(fin.type, 'pl');
  assert.ok(Array.isArray(fin.rows));
  assert.equal(fin.rows[0].metric, 'Revenue');
  assert.equal(fin.rows[0]['FY24'], '229,171');
  // Check em-dash sanitization
  assert.equal(fin.rows[2]['FY20'], null);
  assert.equal(fin.rows[2]['FY21'], null);
});

test('getShareholding parses quarterly trend and cleans em-dash to null', async () => {
  const html = readFileSync(join(__dirname, 'fixtures', 'tata-steel-shareholding.html'), 'utf-8');
  const mockFetch = createMockFetch({
    '/company/tata-steel-limited/shareholding/': { status: 200, body: html }
  });
  const client = new TijoriClient({ fetchFn: mockFetch, cacheEnabled: false });
  const sh = await client.getShareholding('tata-steel-limited');
  assert.ok(Array.isArray(sh.quarters));
  assert.equal(sh.quarters.length, 4);
  const jun24 = sh.quarters.find(q => q.period === 'Jun 2024');
  assert.ok(jun24);
  assert.equal(jun24.Promoter, 33.2);
  assert.equal(jun24.Public, null);
});

test('getRawMaterials parses sections from raw materials page', async () => {
  const sampleHtml = `
    <div id="chemicals">
      <table>
        <thead><tr><th>Metric</th><th>Price</th></tr></thead>
        <tbody>
          <tr><td class="firstcol"><span class="nameofmetriccol">Caustic Soda</span></td><td class="numericvalue">45,000</td></tr>
        </tbody>
      </table>
    </div>
  `;
  const mockFetch = createMockFetch({
    '/in/raw-materials': { status: 200, body: sampleHtml }
  });
  const client = new TijoriClient({ fetchFn: mockFetch, cacheEnabled: false });
  const res = await client.getRawMaterials('chemicals');
  assert.ok(Array.isArray(res.rows));
  assert.equal(res.rows[0].metric, 'Caustic Soda');
  assert.equal(res.rows[0].Price, '45,000');
});
