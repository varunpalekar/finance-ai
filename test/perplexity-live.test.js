import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { PerplexityClient } from '../src/client/PerplexityClient.js';
import { TijoriClient } from '../src/client/TijoriClient.js';
import { resolveTicker } from '../src/index.js';
import { initDb } from '../src/cache.js';
import { probeLiveProvider } from './live-test-utils.js';

initDb(':memory:');
const preflight = await probeLiveProvider('https://www.perplexity.ai/rest/finance/quote/HEROMOTOCO.NS', {
    headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36' },
    required: process.env.npm_lifecycle_event === 'test:pplx'
});

describe('Perplexity Live Exhaustive Contract & Edge Case Suite', {
  skip: !preflight.available && `Live Perplexity unavailable (${preflight.reason}); run npm run test:pplx with network access`
}, () => {
  const client = new PerplexityClient();
  const tijori = new TijoriClient();
  const TICKER = 'HEROMOTOCO.NS';

  // 1. Catalysts & Narrative Drivers
  describe('Catalysts API & Edge Cases', () => {
    test('live getPriceMovementCatalysts returns complete schema with matching percent alias', async () => {
      const res = await client.getPriceMovementCatalysts(TICKER, { limit: 10, fresh: true });
      assert.equal(res.ticker, TICKER);
      assert.ok(Array.isArray(res.timeline));
      assert.ok(res.timeline.length > 0);
      assert.ok(res.timeline.length <= 10);

      for (const entry of res.timeline) {
        assert.ok(typeof entry.date === 'string' && entry.date.length > 0, 'Entry date must be non-empty string');
        assert.ok(typeof entry.price === 'number' && entry.price > 0, 'Price must be positive number');
        assert.ok(typeof entry.price_movement === 'number', 'Price movement must be number');
        assert.equal(entry.price_movement_percent, entry.price_movement, 'Percent alias must match price_movement');
        assert.ok(typeof entry.narrative === 'string' && entry.narrative.length > 10, 'Narrative must be descriptive');
        assert.ok(typeof entry.has_catalyst === 'boolean', 'has_catalyst must be boolean');
        assert.ok(Array.isArray(entry.sources), 'Sources must be array');
        for (const src of entry.sources) {
          assert.ok(src.url.startsWith('http'), `Source URL must start with http: ${src.url}`);
        }
      }
    });

    test('auto-normalizes unsuffixed Indian ticker to .NS', async () => {
      const res = await client.getPriceMovementCatalysts('HEROMOTOCO', { limit: 2, fresh: true });
      assert.equal(res.ticker, 'HEROMOTOCO.NS');
      assert.ok(res.timeline.length > 0);
    });
  });

  // 2. Institutional Brokerage Research Reports
  describe('Brokerage Reports API & Edge Cases', () => {
    test('live getBrokerageReports validates broker credentials, PDF URLs, and enums', async () => {
      const res = await client.getBrokerageReports(TICKER, { fresh: true });
      assert.equal(res.ticker, TICKER);
      assert.ok(res.total_reports > 0);
      assert.equal(res.reports.length, res.total_reports);

      const validOutlooks = new Set(['bullish', 'upbeat', 'neutral', 'bearish', 'unknown']);
      for (const rep of res.reports) {
        assert.ok(rep.title.length > 0, 'Report title must be non-empty');
        assert.ok(rep.provider.length > 0, 'Report provider must be non-empty');
        assert.ok(rep.pdf_url.startsWith('http'), `PDF URL must be HTTP link: ${rep.pdf_url}`);
        assert.ok(validOutlooks.has(rep.outlook), `Outlook must be valid enum: ${rep.outlook}`);
        assert.ok(rep.summary.length > 10, 'Summary must be descriptive');
      }
    });
  });

  // 3. Earnings Intelligence, Consensus Comparison & Concall Transcripts
  describe('Earnings Intelligence & Transcript Edge Cases', () => {
    test('live getEarningsIntelligence extracts reported event, consensus surprise, and historical quarters', async () => {
      const res = await client.getEarningsIntelligence(TICKER, { includeTranscript: false, fresh: true });
      assert.equal(res.ticker, TICKER);
      assert.ok(res.active_event_id > 0, 'Active event ID must be positive');
      assert.ok(typeof res.fiscal_period === 'string');
      assert.ok(typeof res.fiscal_year === 'number');

      // Consensus verification
      const comparison = res.consensus_comparison;
      for (const key of ['actual_revenue', 'estimated_revenue', 'revenue_beat_percent', 'actual_eps', 'estimated_eps', 'eps_beat_percent']) {
        assert.ok(Number.isFinite(comparison[key]), `${key} must be finite`);
      }
      const rawEvents = await client.fetchJson(`/rest/finance/earnings/${TICKER}`, { fresh: true });
      const sourceEvent = rawEvents.find(event => event.id === res.active_event_id);
      assert.ok(sourceEvent, 'Active event must match a source earnings record');
      assert.equal(comparison.actual_revenue, sourceEvent.actualRevenue);
      assert.equal(comparison.estimated_revenue, sourceEvent.estimatedRevenue);
      assert.equal(comparison.actual_eps, sourceEvent.actualEps);
      assert.equal(comparison.estimated_eps, sourceEvent.estimatedEps);
      assert.equal(comparison.currency, 'INR');
      assert.equal(
        comparison.revenue_beat_percent,
        Number((((sourceEvent.actualRevenue - sourceEvent.estimatedRevenue) / sourceEvent.estimatedRevenue) * 100).toFixed(2))
      );
      assert.equal(
        comparison.eps_beat_percent,
        Number((((sourceEvent.actualEps - sourceEvent.estimatedEps) / Math.abs(sourceEvent.estimatedEps)) * 100).toFixed(2))
      );
      assert.equal(
        comparison.actual_revenue_crores,
        Number((sourceEvent.actualRevenue / 1e7).toFixed(2))
      );

      // Multi-quarter historical series
      assert.ok(Array.isArray(res.historical_quarters));
      assert.ok(res.historical_quarters.length >= 8, 'Must return at least 8 quarters of track record');
      const q = res.historical_quarters[0];
      assert.ok(q.id > 0);
      assert.ok(typeof q.fiscal_year === 'number');
      for (const quarter of res.historical_quarters) {
        for (const key of ['actual_revenue', 'estimated_revenue', 'actual_eps', 'estimated_eps']) {
          assert.ok(quarter[key] === null || Number.isFinite(quarter[key]), `${key} must be finite or null`);
        }
      }

      // AI highlights
      assert.ok(Array.isArray(res.ai_highlights));
      assert.ok(res.ai_highlights.length > 0, 'Reported quarter must contain AI highlights');
      assert.equal(res.transcript, null, 'Transcript must be null when includeTranscript is false');
    });

    test('fetches specific historical quarter via eventId', async () => {
      // Event 661066 is Q1 FY27 for Hero MotoCorp
      const res = await client.getEarningsIntelligence(TICKER, { eventId: 661066, includeTranscript: false, fresh: true });
      assert.equal(res.active_event_id, 661066);
      assert.equal(res.fiscal_period, 'Q1');
      assert.equal(res.fiscal_year, 2027);
    });

    test('live concall transcript extraction with prepared_remarks filtering', async () => {
      const res = await client.getEarningsIntelligence(TICKER, {
        includeTranscript: true,
        chapterFilter: 'prepared_remarks',
        fresh: true
      });

      assert.ok(res.transcript !== null, 'Transcript object must be present');
      assert.ok(res.transcript.audio_url.startsWith('http'), 'Audio URL must be HTTP link');
      assert.equal(res.transcript.chapter_selected, 'prepared_remarks');
      assert.equal(res.transcript.chapter_available, true);
      assert.ok(Array.isArray(res.transcript.chapters) && res.transcript.chapters.length > 0);
      assert.ok(Array.isArray(res.transcript.paragraphs) && res.transcript.paragraphs.length > 0);
      assert.ok(res.transcript.paragraphs.length <= 50, 'Must respect 50-paragraph token bound');
      const chapter = res.transcript.chapters.find(value => value.title.toLowerCase().includes('prepared remarks'));
      assert.ok(chapter, 'Prepared remarks chapter must exist in the source transcript');
      assert.ok(res.transcript.paragraphs.every(paragraph =>
        paragraph.time >= chapter.startTimestamp
        && (chapter.endTimestamp == null || paragraph.time <= chapter.endTimestamp)
      ), 'Every paragraph must fall inside the prepared remarks chapter');

      const p0 = res.transcript.paragraphs[0];
      assert.ok(typeof p0.speaker === 'string' && p0.speaker.length > 0);
      assert.ok(typeof p0.text === 'string' && p0.text.length > 10);
      assert.ok(typeof p0.time === 'number');
    });

    test('live concall transcript extraction with Q&A filtering', async () => {
      const res = await client.getEarningsIntelligence(TICKER, {
        includeTranscript: true,
        chapterFilter: 'qa',
        fresh: true
      });

      assert.ok(res.transcript !== null);
      assert.equal(res.transcript.chapter_selected, 'qa');
      assert.equal(res.transcript.chapter_available, true);
      assert.ok(res.transcript.paragraphs.length > 0);
      const chapter = res.transcript.chapters.find(value =>
        value.title.toLowerCase().includes('q&a') || value.title.toLowerCase().includes('question')
      );
      assert.ok(chapter, 'Q&A chapter must exist in the source transcript');
      assert.ok(res.transcript.paragraphs.every(paragraph =>
        paragraph.time >= chapter.startTimestamp
        && (chapter.endTimestamp == null || paragraph.time <= chapter.endTimestamp)
      ), 'Every paragraph must fall inside the Q&A chapter');
    });
  });

  // 4. Strategic Profile, Multiples & Multi-Exchange Fallbacks
  describe('Strategic Profile & Multi-Exchange Edge Cases', () => {
    test('live getCompanyStrategicProfile returns full valuation and strategic summary', async () => {
      const res = await client.getCompanyStrategicProfile(TICKER, { fresh: true });
      assert.equal(res.ticker, TICKER);
      assert.equal(res.company_name, 'Hero MotoCorp Limited');
      assert.equal(res.exchange, 'NSE');
      assert.equal(res.currency, 'INR');
      assert.ok(res.price > 1000, 'Price must be positive');
      assert.ok(res.market_cap > 500000000000, 'Market cap must be > 50k Cr');
      assert.ok(res.pe_ratio > 0, 'PE ratio must be positive');
      assert.ok(res['52_week_high'] > res['52_week_low'], '52W High must exceed 52W Low');
      const quoteTime = Date.parse(res.quote_timestamp);
      assert.ok(Number.isFinite(quoteTime), 'Quote timestamp must be parseable');
      assert.ok(quoteTime <= Date.now() + 5 * 60 * 1000, 'Quote timestamp must not be in the future');
      assert.ok(quoteTime >= Date.now() - 7 * 86400 * 1000, 'Quote must be from the last seven days');
      assert.equal(res.data_freshness.is_cached, false);
      assert.equal(res.data_freshness.is_stale, false);
      const source = await client.fetchJson(`/rest/finance/quote/${TICKER}`, { fresh: true });
      const closeToSource = (actual, expected) =>
        Number.isFinite(actual) && Number.isFinite(expected)
        && Math.abs(actual - expected) <= Math.max(Math.abs(expected) * 0.01, 0.01);
      assert.ok(closeToSource(res.price, source.price), 'Price must match the live source within 1%');
      assert.ok(closeToSource(res.market_cap, source.marketCap), 'Market cap must match the live source within 1%');
      assert.equal(res.currency, source.currency);
      assert.ok(closeToSource(res.pe_ratio, source.pe), 'P/E must match the live source within 1%');
      assert.equal(res.market_cap_crores, Number((res.market_cap / 1e7).toFixed(2)));
      assert.match(res.denomination_scale, /Raw INR units/);
      assert.ok(
        Math.abs(Date.parse(res.quote_timestamp) - source.timestamp * 1000) <= 5 * 60 * 1000,
        'Quote timestamp must match a recent live source observation'
      );
      assert.ok(res.strategic_summary.full_profile.length > 100, 'Strategic description must be rich text');
    });

    test('supports BSE exchange tickers (.BO)', async () => {
      const res = await client.getCompanyStrategicProfile('HEROMOTOCO.BO', { fresh: true });
      assert.equal(res.ticker, 'HEROMOTOCO.BO');
      assert.equal(res.company_name, 'Hero MotoCorp Limited');
      assert.equal(res.currency, 'INR');
    });

    test('supports bare US ticker with 404 auto-fallback (CRM -> Salesforce)', async () => {
      const res = await client.getCompanyStrategicProfile('CRM', { fresh: true });
      assert.ok(res.company_name.toLowerCase().includes('salesforce'));
      assert.equal(res.currency, 'USD');
      assert.ok(Number.isFinite(res.market_cap) && res.market_cap > 1e9);
      assert.equal(res.market_cap_crores, null);
      assert.match(res.denomination_scale, /USD raw units/);
    });

    test('supports .US suffixed tickers (AAPL.US -> Apple)', async () => {
      const res = await client.getCompanyStrategicProfile('AAPL.US', { fresh: true });
      assert.ok(res.company_name.toLowerCase().includes('apple'));
      assert.equal(res.currency, 'USD');
      assert.ok(Number.isFinite(res.market_cap) && res.market_cap > 1e9);
      assert.equal(res.market_cap_crores, null);
      assert.match(res.denomination_scale, /USD raw units/);
    });

    test('supports bare and explicit .US tickers for earnings data', async () => {
      for (const ticker of ['CRM', 'CRM.US']) {
        const res = await client.getEarningsIntelligence(ticker, { fresh: true });
        assert.equal(res.ticker, 'CRM');
        assert.equal(res.currency, 'USD');
        assert.ok(res.active_event_id > 0, `${ticker} must resolve to a reported Salesforce event`);
        assert.ok(res.historical_quarters.length >= 8, `${ticker} must return historical Salesforce quarters`);
        assert.equal(res.consensus_comparison.actual_revenue_crores, null);
        assert.equal(res.consensus_comparison.estimated_revenue_crores, null);
      }
    });

    test('throws structured HTTP 404 error on invalid nonexistent ticker', async () => {
      await assert.rejects(
        async () => client.getCompanyStrategicProfile('NONEXISTENT_XYZ_999999', { fresh: true }),
        (err) => err.status === 404
      );
    });
  });

  // 5. Publisher News & Limit Handling
  describe('Curated Publisher News API & Edge Cases', () => {
    test('live getCuratedNews respects limit and returns valid article objects', async () => {
      const res = await client.getCuratedNews(TICKER, { limit: 3, fresh: true });
      assert.equal(res.ticker, TICKER);
      assert.ok(Array.isArray(res.articles));
      assert.ok(res.articles.length > 0 && res.articles.length <= 3);

      for (const art of res.articles) {
        assert.ok(art.title.length > 0);
        assert.ok(art.source.length > 0);
        assert.ok(art.url.startsWith('http'), `Article URL must start with http: ${art.url}`);
        assert.ok(typeof art.published_at === 'string' && art.published_at.length > 0);
      }
    });
  });

  // 6. Cross-Source Dual Resolution via Tijori
  describe('Cross-Source Dual Resolution (Slug -> Ticker -> Perplexity)', () => {
    test('resolves Tijori slug to stock ticker in live integration', async () => {
      const resolved = await resolveTicker({ slug: 'hero-motocorp-limited' }, tijori, client);
      assert.equal(resolved, 'HEROMOTOCO');
    });

    test('resolves numeric BSE scrip code 500182 without adding an exchange suffix prematurely', async () => {
      const resolved = await resolveTicker({ ticker: '500182' }, tijori, client);
      assert.equal(resolved, 'HEROMOTOCO');
    });

    test('fetches strategic profile using numeric BSE scrip code resolved ticker', async () => {
      const resolved = await resolveTicker({ ticker: '500182' }, tijori, client);
      const res = await client.getCompanyStrategicProfile(resolved, { fresh: true });
      assert.equal(res.ticker, 'HEROMOTOCO.NS');
      assert.equal(res.company_name, 'Hero MotoCorp Limited');
    });
  });
});
