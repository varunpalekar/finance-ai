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
  assert.equal(overview.currency, 'INR');
  assert.equal(overview.mcap_crores, 180000);
  assert.equal(overview.mcap_inr, 1800000000000);
  assert.ok(overview.denomination_scale.includes('Crores'));
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
  assert.equal(fin.currency, 'INR');
  assert.ok(fin.denomination.includes('Crores'));
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

test('resolveCompanyIds extracts name, symbol, and id independently regardless of key order', async () => {
  const customHtml = `<html><body><script>
    var meta = {"company_id": 999, "symbol": "TESTSYM", "company": "Test Enterprise Ltd"};
  </script></body></html>`;
  const mockFetch = createMockFetch({
    '/company/test-enterprise/': { status: 200, body: customHtml }
  });
  const client = new TijoriClient({ fetchFn: mockFetch, cacheEnabled: false });
  const res = await client.resolveCompanyIds('test-enterprise');
  assert.equal(res.slug, 'test-enterprise');
  assert.equal(res.company_id, 999);
  assert.equal(res.name, 'Test Enterprise Ltd');
  assert.equal(res.symbol, 'TESTSYM');
});

test('getOperationalMetrics processes metrics in bounded batches without failing', async () => {
  const metricLis = Array.from({ length: 12 }, (_, i) => `<li metricid="${100 + i}" title="Metric ${i}" indent="0" onclick="company_op_metrics/888/">Metric ${i}</li>`).join('\n');
  const customHtml = `<html><body><ul>${metricLis}</ul></body></html>`;
  
  const mockRoutes = {
    '/company/multi-metric/': { status: 200, body: customHtml }
  };
  for (let i = 0; i < 12; i++) {
    mockRoutes[`/api/v1/ind/company_op_metrics/888/${100 + i}/`] = {
      status: 200,
      body: JSON.stringify({ data: [[1719273600000, 42.5]] })
    };
  }

  const mockFetch = createMockFetch(mockRoutes);
  const client = new TijoriClient({ fetchFn: mockFetch, cacheEnabled: false });
  const res = await client.getOperationalMetrics('multi-metric');
  assert.equal(res.company_id, 888);
  assert.equal(res.metrics.length, 12);
  assert.equal(res.metrics[0].latest_value, 42.5);
  assert.equal(res.metrics[11].latest_value, 42.5);
});
