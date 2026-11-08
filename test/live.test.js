import assert from 'node:assert/strict';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { TijoriClient } from '../src/client/TijoriClient.js';
import { get, set } from '../src/cache.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const sessionPath = join(__dirname, '..', 'output', 'session.json');

let isOnline = false;
try {
  const probe = await fetch('https://www.tijorifinance.com/api/v1/ind/company_search/?q=tata', { signal: AbortSignal.timeout(3000) });
  isOnline = probe.ok;
} catch (_) {}

test('live integration test suite covering all 20 MCP functions with real data verification', { skip: !isOnline && 'Network unreachable or sandboxed — run npm run test:live unsandboxed' }, async (t) => {
  // Use cacheEnabled: false to guarantee every test queries real live network endpoints directly
  const client = new TijoriClient({ sessionPath, cacheEnabled: false });

  // 1. search_company
  await t.test('1. search_company: resolves real Tata Steel company record', async () => {
    const results = await client.searchCompany('Tata Steel');
    assert.ok(Array.isArray(results) && results.length >= 1, 'Expected at least 1 result');
    const match = results.find(r => r.slug === 'tata-steel-limited');
    assert.ok(match, 'Expected to find tata-steel-limited in search results');
    assert.equal(match.name, 'Tata Steel Ltd.');
    assert.equal(typeof match.slug, 'string');
  });

  // 2. resolve_company_ids
  let companyId;
  await t.test('2. resolve_company_ids: resolves slug to numeric company_id 338', async () => {
    const ids = await client.resolveCompanyIds('tata-steel-limited');
    assert.equal(ids.company_id, 338, 'Tata Steel company_id must be 338');
    assert.equal(ids.symbol, 'TATASTEEL');
    assert.equal(ids.name, 'Tata Steel Ltd.');
    assert.equal(ids.slug, 'tata-steel-limited');
    companyId = ids.company_id;
  });

  // 3. get_company_overview
  await t.test('3. get_company_overview: retrieves authentic valuation multiples and return ratios', async () => {
    const overview = await client.getCompanyOverview('tata-steel-limited');
    assert.ok(overview);
    assert.equal(overview.slug, 'tata-steel-limited');
    assert.equal(overview.company, 'Tata Steel Ltd.');
    assert.ok(overview.ratios, 'Overview must have ratios map');
    assert.ok(Object.keys(overview.ratios).length >= 10, 'Expected at least 10 financial ratios');
    assert.ok(overview.ratios['ROE'], 'Expected ROE ratio');
    assert.ok(overview.ratios['ROCE'], 'Expected ROCE ratio');
    assert.ok(overview.ratios['Debt to Equity Ratio'], 'Expected Debt to Equity ratio');
    assert.ok(overview.ratios['Net Sales'], 'Expected Net Sales ratio');
  });

  // 4. get_financials
  await t.test('4. get_financials: extracts multi-year P&L statement from SSR embedded data', async () => {
    const financials = await client.getFinancials('tata-steel-limited', 'pl');
    assert.ok(financials);
    assert.equal(financials.type, 'pl');
    assert.ok(financials.headers.length >= 10, 'Expected at least 10 period headers');
    assert.ok(financials.rows.length >= 10, 'Expected at least 10 line-item rows');

    const salesRow = financials.rows.find(r => r.metric === 'Sales');
    assert.ok(salesRow, 'P&L must have Sales row');
    const latestPeriod = financials.headers[financials.headers.length - 2];
    assert.ok(salesRow[latestPeriod] !== null && salesRow[latestPeriod] !== undefined, 'Sales must not be null');
    assert.ok(parseFloat(salesRow[latestPeriod]) > 100000, 'Tata Steel annual sales must exceed 100,000 Cr');
  });

  // 5. get_shareholding
  await t.test('5. get_shareholding: returns 10-quarter verified ownership trend', async () => {
    const shareholding = await client.getShareholding('tata-steel-limited');
    assert.ok(shareholding);
    assert.ok(Array.isArray(shareholding.quarters) && shareholding.quarters.length >= 8, 'Expected at least 8 quarters');
    const latestQ = shareholding.quarters[0];
    assert.ok(latestQ.period, 'Quarter must have period string');
    assert.equal(typeof latestQ.Promoter, 'number', 'Promoter holding must be a numeric percentage');
    assert.ok(latestQ.Promoter > 25 && latestQ.Promoter < 45, 'Tata Steel promoter holding must be ~33%');
    assert.equal(typeof latestQ['Indian Promoters'], 'number');
    assert.equal(typeof latestQ['Public Shareholding'], 'number');
  });

  // 6. get_operational_metrics
  await t.test('6. get_operational_metrics: retrieves live unit KPIs for swaraj-engines-limited', async () => {
    const op = await client.getOperationalMetrics('swaraj-engines-limited');
    assert.ok(op);
    assert.equal(op.slug, 'swaraj-engines-limited');
    assert.equal(op.company_id, 298, 'Swaraj Engines company_id must be 298');
    assert.ok(Array.isArray(op.metrics) && op.metrics.length >= 2, 'Expected at least 2 operational metrics');

    const capUtil = op.metrics.find(m => m.name.includes('Capacity Utilization'));
    assert.ok(capUtil, 'Expected Capacity Utilization KPI');
    assert.equal(capUtil.unit, '%');
    assert.equal(typeof capUtil.latest_value, 'number');
    assert.ok(capUtil.latest_value > 50 && capUtil.latest_value <= 100);
    assert.ok(Array.isArray(capUtil.history) && capUtil.history.length >= 5, 'Expected historical time series');
  });

  // 7. get_fund_flow
  await t.test('7. get_fund_flow: returns cash sources and uses breakdown over 3 years', async () => {
    const ff = await client.getFundFlow(companyId, 3);
    assert.ok(ff);
    assert.equal(ff.company_id, companyId);
    assert.equal(ff.years, 3);
    assert.ok(Array.isArray(ff.sources) && ff.sources.length >= 3, 'Expected at least 3 sources of cash');
    assert.ok(Array.isArray(ff.uses) && ff.uses.length >= 3, 'Expected at least 3 uses of cash');
    assert.ok(ff.sources.every(s => typeof s.name === 'string' && typeof s.y === 'number'), 'Sources must be valid objects');
    assert.ok(ff.uses.every(u => typeof u.name === 'string' && typeof u.y === 'number'), 'Uses must be valid objects');
  });

  // 8. get_raw_materials
  await t.test('8. get_raw_materials: returns commodity price spreads for chemicals', async () => {
    const raw = await client.getRawMaterials('chemicals');
    assert.ok(raw);
    assert.ok(Array.isArray(raw.rows) && raw.rows.length >= 20, 'Expected at least 20 chemicals');
    const acetone = raw.rows.find(r => r.metric === 'Acetone');
    assert.ok(acetone, 'Expected Acetone commodity');
    assert.equal(acetone.family, 'Phenolic Ketones');
  });

  // 9. get_macro_indicators
  await t.test('9. get_macro_indicators: returns macroeconomic industry credit table', async () => {
    const macro = await client.getMacroIndicators('industry');
    assert.ok(macro);
    assert.ok(Array.isArray(macro.rows) && macro.rows.length >= 10, 'Expected at least 10 macro indicators');
    assert.ok(macro.rows.some(r => r.metric.includes('Credit') || r.metric.includes('Industry')));
  });

  // 10. get_markets
  let nicheTjiid;
  let congloTjiid;
  await t.test('10. get_markets: returns headline indices, 80 niche sectors, and 9 conglomerates', async () => {
    const headline = await client.getMarkets('headline');
    assert.ok(headline.rows.length >= 3);
    assert.ok(headline.rows.some(r => r.metric === 'Nifty 50'), 'Headline must include Nifty 50');

    const niche = await client.getMarkets('niche');
    assert.ok(niche.rows.length >= 50, 'Expected at least 50 niche sector indices');
    assert.ok(niche.rows.every(r => r.sector && r.tjiid), 'Every niche row must have sector and tjiid');
    nicheTjiid = parseInt(niche.rows[0].tjiid, 10);

    const conglo = await client.getMarkets('conglomerates');
    assert.ok(conglo.rows.length >= 5, 'Expected conglomerate groups');
    const tataRow = conglo.rows.find(r => r.conglomerate.includes('Tata'));
    assert.ok(tataRow, 'Expected Tata Group in conglomerates');
    congloTjiid = parseInt(tataRow.tjiid, 10);
  });

  // 11. get_sector_constituents
  await t.test('11. get_sector_constituents: returns constituents of niche sector with returns', async () => {
    assert.ok(nicheTjiid);
    const constituents = await client.getSectorConstituents(nicheTjiid);
    assert.ok(constituents);
    assert.ok(Array.isArray(constituents.companies) && constituents.companies.length >= 3);
    assert.ok(constituents.companies.every(c => c.name && c.slug && c.returns && c.returns['1D'] !== undefined));
  });

  // 12. get_conglomerate_constituents
  await t.test('12. get_conglomerate_constituents: returns Tata group company constituents', async () => {
    assert.ok(congloTjiid);
    const constituents = await client.getConglomerateConstituents(congloTjiid);
    assert.ok(constituents);
    assert.ok(Array.isArray(constituents.companies) && constituents.companies.length >= 15, 'Tata group has 20+ listed entities');
    assert.ok(constituents.companies.some(c => c.slug.includes('tata-power') || c.slug.includes('tata-motors')));
  });

  // 13. get_knowledge_base
  let sampleDocUrl;
  await t.test('13. get_knowledge_base: returns categorized filings from files.tijorifinance.com', async () => {
    const kb = await client.getKnowledgeBase('tata-steel-limited');
    assert.ok(kb);
    assert.equal(kb.slug, 'tata-steel-limited');
    assert.ok(Array.isArray(kb.annual_reports) && kb.annual_reports.length >= 5, 'Expected 5+ annual reports');
    assert.ok(Array.isArray(kb.conference_calls) && kb.conference_calls.length >= 5, 'Expected 5+ conference calls');
    sampleDocUrl = kb.conference_calls[0]?.url;
    assert.ok(sampleDocUrl && sampleDocUrl.startsWith('https://files.tijorifinance.com/'), 'Doc URL must point to Tijori CDN');
  });

  // 14. fetch_document
  await t.test('14. fetch_document: parses real PDF concall transcript into clean text', async () => {
    assert.ok(sampleDocUrl);
    const doc = await client.fetchDocument(sampleDocUrl);
    assert.ok(doc);
    assert.ok(doc.pages >= 5, 'Concall transcript must be multiple pages');
    assert.ok(doc.text.length > 5000, 'Parsed text must exceed 5,000 characters');
    assert.ok(doc.text.includes('Tata Steel') || doc.text.includes('BSE') || doc.text.includes('transcript'));
  });

  // 15. get_revenue_mix
  await t.test('15. get_revenue_mix: returns segment breakdowns with percentage sums', async () => {
    const rmix = await client.getRevenueMix('tata-steel-limited');
    assert.ok(rmix);
    assert.equal(rmix.slug, 'tata-steel-limited');
    assert.ok(Array.isArray(rmix.charts) && rmix.charts.length >= 3, 'Expected at least 3 revenue charts');
    const prodChart = rmix.charts.find(c => c.title?.toLowerCase().includes('product'));
    assert.ok(prodChart, 'Expected Product Wise Break-Up chart');
    assert.ok(prodChart.latest_breakdown.length >= 2, 'Expected multiple product segments');
    assert.ok(prodChart.latest_breakdown.every(s => typeof s.name === 'string' && typeof s.pct === 'number'));
  });

  // 16. get_market_share
  await t.test('16. get_market_share: returns verified Crude Steel market share metric', async () => {
    const ms = await client.getMarketShare('tata-steel-limited');
    assert.ok(ms);
    assert.equal(ms.slug, 'tata-steel-limited');
    assert.ok(Array.isArray(ms.metrics) && ms.metrics.length >= 1, 'Expected market share metrics');
    const crude = ms.metrics.find(m => m.metric.includes('Crude Steel'));
    assert.ok(crude, 'Expected Crude Steel market share');
    assert.equal(typeof crude.value, 'number');
    assert.ok(crude.value > 5 && crude.value < 40, 'Crude Steel market share must be ~14-15%');
    assert.ok(crude.as_of);
  });

  // 17. list_popular_screens
  await t.test('17. list_popular_screens: returns verified pre-built institutional queries', async () => {
    const screens = await client.listPopularScreens();
    assert.ok(Array.isArray(screens) && screens.length >= 10, 'Expected at least 10 popular screens');
    const stake = screens.find(s => s.name === 'Promoter Increasing Stake');
    assert.ok(stake, 'Expected Promoter Increasing Stake screen');
    assert.equal(stake.category, 'Fundamentals');
    assert.ok(stake.query && stake.query.includes('Promoter Holding'), 'Screen must contain query condition');
  });

  // 18. screen_companies
  await t.test('18. screen_companies: executes live query and validates ROCE criteria', async () => {
    const screen = await client.screenCompanies({ filters: 'ROCE > 20%', limit: 3 });
    assert.ok(screen);
    assert.ok(screen.total_results > 500, 'Expected >500 companies matching ROCE > 20% in India');
    assert.equal(screen.returned, 3);
    assert.ok(screen.results.every(r => r.name && r.slug && typeof r['ROCE%'] === 'number' && r['ROCE%'] >= 20), 'Every returned company must have ROCE >= 20%');
  });

  // 19. search_screener_fields
  await t.test('19. search_screener_fields: searches official screener catalog for promoter fields', async () => {
    const fields = await client.searchScreenerFields({ query: 'promoter' });
    assert.ok(fields);
    assert.ok(fields.total_matches >= 10, 'Expected 10+ promoter holding fields');
    assert.ok(fields.fields.some(f => f.name.toLowerCase().includes('promoter holding')));
  });

  // 20. clear_cache
  await t.test('20. clear_cache: purges SQLite cache and verifies record deletion', () => {
    // Seed test record
    set('test_clear:tata-steel-limited', { seeded: true }, 60000, 'json', 'tata-steel-limited');
    assert.ok(get('test_clear:tata-steel-limited'), 'Record must exist before clear');
    client.clearCache('tata-steel-limited');
    assert.equal(get('test_clear:tata-steel-limited'), null, 'Record must be deleted after clearCache');
  });

  // 21. get_factors_and_benchmarking
  await t.test('21. get_factors_and_benchmarking: extracts authentic radar axes and formulas for bank-of-maharashtra', async () => {
    const res = await client.getFactorsAndBenchmarking('bank-of-maharashtra');
    assert.ok(res);
    assert.equal(res.slug, 'bank-of-maharashtra');
    assert.ok(Array.isArray(res.radar_axes) && res.radar_axes.length >= 2);
    assert.equal(typeof res.radar_axes[0].company_score, 'number');
    assert.equal(typeof res.radar_axes[0].peer_median, 'number');
  });

  // 22. get_valuation_bands
  await t.test('22. get_valuation_bands: aggregates authentic daily historical P/E for swaraj-engines-limited', async () => {
    const res = await client.getValuationBands('swaraj-engines-limited');
    assert.ok(res);
    assert.equal(res.slug, 'swaraj-engines-limited');
    assert.equal(typeof res.current_pe, 'number');
    assert.ok(res.valuation_bands['1y']);
    assert.ok(res.valuation_bands['3y']);
    assert.ok(res.valuation_bands['5y']);
    assert.ok(res.valuation_bands['10y']);
    const b1y = res.valuation_bands['1y'];
    assert.ok(b1y.min <= b1y.p25 && b1y.p25 <= b1y.median && b1y.median <= b1y.p75 && b1y.p75 <= b1y.max);
    assert.ok(Array.isArray(res.peers) && res.peers.length >= 1);
  });
});
