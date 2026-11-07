import assert from 'node:assert/strict';
import { test } from 'node:test';
import { existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { TijoriClient } from '../src/client/TijoriClient.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const sessionPath = join(__dirname, '..', 'output', 'session.json');

let isOnline = false;
try {
  const probe = await fetch('https://www.tijorifinance.com/api/v1/ind/company_search/?q=tata', { signal: AbortSignal.timeout(3000) });
  isOnline = probe.ok;
} catch (_) {}

test('live integration test suite against benchmark companies', { skip: !isOnline && 'Network unreachable or sandboxed — run npm run test:live unsandboxed' }, async (t) => {
  const client = new TijoriClient({ sessionPath, cacheEnabled: true });

  await t.test('searchCompany resolves Tata Steel', async () => {
    const results = await client.searchCompany('Tata Steel');
    assert.ok(Array.isArray(results));
    assert.ok(results.length > 0);
    assert.ok(results.some(r => r.slug === 'tata-steel-limited'));
  });

  await t.test('getCompanyOverview retrieves ratios and valuation', async () => {
    const overview = await client.getCompanyOverview('tata-steel-limited');
    assert.ok(overview);
    assert.equal(overview.slug, 'tata-steel-limited');
    assert.ok(overview.ratios);
  });

  await t.test('getFinancials returns profit & loss statement', async () => {
    const financials = await client.getFinancials('tata-steel-limited', 'pl');
    assert.ok(financials);
    assert.equal(financials.type, 'pl');
    assert.ok(Array.isArray(financials.rows));
    assert.ok(financials.rows.length > 0);
  });

  await t.test('getShareholding returns quarterly breakdown', async () => {
    const shareholding = await client.getShareholding('tata-steel-limited');
    assert.ok(shareholding);
    assert.ok(Array.isArray(shareholding.quarters));
    assert.ok(shareholding.quarters.length > 0);
  });

  await t.test('getOperationalMetrics retrieves or handles single-segment benchmark cleanly', async () => {
    const op = await client.getOperationalMetrics('swaraj-engines-limited');
    assert.ok(op);
    assert.equal(op.slug, 'swaraj-engines-limited');
    assert.ok(Array.isArray(op.metrics));
  });

  await t.test('getFundFlow returns cash sources and uses breakdown', async () => {
    const ids = await client.resolveCompanyIds('tata-steel-limited');
    assert.ok(ids.company_id);
    const ff = await client.getFundFlow(ids.company_id, 3);
    assert.ok(ff);
    assert.equal(ff.company_id, ids.company_id);
    assert.equal(ff.years, 3);
  });

  await t.test('screenCompanies executes query screen', async () => {
    const screen = await client.screenCompanies({ filters: 'ROCE > 20%', limit: 5 });
    assert.ok(screen);
    assert.ok(screen.total_results > 0);
    assert.ok(screen.results.length <= 5);
  });
});
