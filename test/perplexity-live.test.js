import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { PerplexityClient } from '../src/client/PerplexityClient.js';

let isOnline = false;
try {
  const probe = await fetch('https://www.perplexity.ai/rest/finance/quote/HEROMOTOCO.NS', {
    headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36' },
    signal: AbortSignal.timeout(3000)
  });
  isOnline = probe.ok;
} catch (_) {}

describe('Perplexity Live Integration (HEROMOTOCO.NS)', { skip: !isOnline && 'Network unreachable or sandboxed — run npm run test:pplx unsandboxed' }, () => {
  const client = new PerplexityClient();
  const TICKER = 'HEROMOTOCO.NS';

  test('live getPriceMovementCatalysts returns valid timeline', async () => {
    const res = await client.getPriceMovementCatalysts(TICKER, { limit: 10, fresh: true });
    assert.equal(res.ticker, TICKER);
    assert.ok(Array.isArray(res.timeline));
    assert.ok(res.timeline.length > 0);
    assert.ok(typeof res.timeline[0].narrative === 'string');
  });

  test('live getBrokerageReports returns institutional reports', async () => {
    const res = await client.getBrokerageReports(TICKER, { fresh: true });
    assert.equal(res.ticker, TICKER);
    assert.ok(Array.isArray(res.reports));
    assert.ok(res.reports.length > 0);
    assert.ok(res.reports[0].provider.length > 0);
  });

  test('live getEarningsIntelligence returns consensus surprise and AI highlights', async () => {
    const res = await client.getEarningsIntelligence(TICKER, { includeTranscript: false, fresh: true });
    assert.equal(res.ticker, TICKER);
    assert.ok(res.active_event_id > 0);
    assert.ok(res.consensus_comparison.actual_revenue !== undefined);
    assert.ok(Array.isArray(res.ai_highlights));
  });

  test('live getCompanyStrategicProfile returns quote metadata and moat summary', async () => {
    const res = await client.getCompanyStrategicProfile(TICKER, { fresh: true });
    assert.equal(res.ticker, TICKER);
    assert.equal(res.company_name, 'Hero MotoCorp Limited');
    assert.ok(typeof res.strategic_summary.full_profile === 'string');
  });

  test('live getCuratedNews returns publisher news items', async () => {
    const res = await client.getCuratedNews(TICKER, { limit: 5, fresh: true });
    assert.equal(res.ticker, TICKER);
    assert.ok(Array.isArray(res.articles));
    assert.ok(res.articles.length > 0);
  });
});
