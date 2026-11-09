import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { parseCatalysts } from '../src/parsers/perplexity/catalysts.js';
import { parseReports } from '../src/parsers/perplexity/reports.js';
import { parseEarnings } from '../src/parsers/perplexity/earnings.js';
import { parseProfile } from '../src/parsers/perplexity/profile.js';
import { parseNews } from '../src/parsers/perplexity/news.js';

const fixtureDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), 'fixtures/perplexity');
const readJson = (file) => JSON.parse(fs.readFileSync(path.join(fixtureDir, file), 'utf8'));
const readText = (file) => fs.readFileSync(path.join(fixtureDir, file), 'utf8');

describe('Perplexity Parsers with Real Live Fixtures', () => {
  const TICKER = 'HEROMOTOCO.NS';

  test('parseCatalysts extracts causal timeline from authentic timeline.json', () => {
    const raw = readJson('timeline.json');
    const res = parseCatalysts(raw, TICKER);

    assert.equal(res.ticker, TICKER);
    assert.ok(res.total_entries > 0);
    const entry = res.timeline[0];
    assert.ok(typeof entry.price === 'number');
    assert.ok(typeof entry.price_movement === 'number');
    assert.ok(typeof entry.price_movement_percent === 'number');
    assert.ok(entry.narrative.length > 20);
    assert.equal(entry.has_catalyst, true);

    const noCat = parseCatalysts([{ description: 'No new macro, sector or company catalysts detected' }], TICKER);
    assert.equal(noCat.timeline[0].has_catalyst, false);

    assert.ok(Array.isArray(entry.sources));
    assert.ok(entry.sources.length > 0);
    assert.ok(entry.sources[0].url.startsWith('http'));
  });

  test('parseReports formats institutional brokerage reports from authentic documents.json', () => {
    const raw = readJson('documents.json');
    const res = parseReports(raw, TICKER);

    assert.equal(res.ticker, TICKER);
    assert.ok(res.total_reports > 0);
    const rep = res.reports[0];
    assert.ok(rep.title.includes('Hero MotoCorp'));
    assert.ok(rep.provider.length > 0);
    assert.ok(rep.pdf_url.startsWith('http'));
    assert.ok(['bullish', 'upbeat', 'bearish', 'neutral'].includes(rep.outlook));
    assert.ok(rep.summary.length > 20);
  });

  test('parseEarnings extracts reported quarter, consensus comparison, and AI highlights from authentic earnings fixtures', () => {
    const earningsRaw = readJson('earnings.json');
    const analysisRaw = readJson('earnings_analysis.json');
    const transcriptRaw = readJson('earnings_transcript.json');

    const res = parseEarnings(earningsRaw, analysisRaw, transcriptRaw, { ticker: TICKER, currency: 'INR', includeTranscript: true });

    assert.equal(res.ticker, TICKER);
    // Live discovery: Q2 2027 is the reported quarter (id 718533), while Q3 is upcoming with null actuals
    assert.equal(res.active_event_id, 718533);
    assert.equal(res.fiscal_period, 'Q2');
    assert.equal(res.fiscal_year, 2027);
    assert.equal(res.consensus_comparison.actual_revenue, 145471600000);
    assert.equal(res.consensus_comparison.actual_revenue_crores, 14547.16);
    assert.equal(res.consensus_comparison.actual_eps, 72.69);
    assert.equal(res.consensus_comparison.currency, 'INR');
    assert.ok(Array.isArray(res.historical_quarters));
    assert.ok(res.historical_quarters.length > 0);
    assert.equal(res.historical_quarters[1].actual_revenue, 145471600000);
    assert.equal(res.historical_quarters[1].actual_revenue_crores, 14547.16);
    assert.ok(res.ai_highlights.length > 0);
    assert.ok(res.transcript.paragraphs.length > 0);
    assert.ok(res.transcript.paragraphs[0].speaker.length > 0);
    assert.ok(Array.isArray(res.transcript.chapters));
    assert.ok(res.transcript.chapters.length > 0);
    assert.ok(res.transcript.audio_url.startsWith('http'));
    assert.equal(res.transcript.chapter_selected, 'prepared_remarks');

    // Test Q&A filter
    const qaRes = parseEarnings(earningsRaw, analysisRaw, transcriptRaw, { ticker: TICKER, currency: 'INR', includeTranscript: true, chapterFilter: 'qa' });
    assert.equal(qaRes.transcript.chapter_selected, 'qa');
    assert.ok(qaRes.transcript.paragraphs.length > 0);
    assert.ok(qaRes.transcript.paragraphs[0].time >= 1113, 'Q&A first paragraph must be within Q&A chapter timestamp');
  });

  test('parseEarnings never converts foreign or unknown revenue into INR crores', () => {
    const event = [{
      id: 1,
      currency: 'USD',
      actualRevenue: 1_000_000_000,
      estimatedRevenue: 900_000_000,
      actualEps: 2,
      estimatedEps: 1.9,
    }];
    const usd = parseEarnings(event, null, null, { ticker: 'AAPL' }).consensus_comparison;
    const unknown = parseEarnings([{ ...event[0], currency: undefined }], null, null, { ticker: 'AAPL' }).consensus_comparison;

    assert.equal(usd.currency, 'USD');
    assert.equal(usd.actual_revenue, 1_000_000_000);
    assert.equal(usd.actual_revenue_crores, null);
    assert.equal(unknown.currency, null);
    assert.equal(unknown.actual_revenue_crores, null);
  });

  test('parseEarnings gracefully degrades when analysis or transcript is null/missing (404)', () => {
    const earningsRaw = readJson('earnings.json');
    const res = parseEarnings(earningsRaw, null, null, { ticker: TICKER, includeTranscript: false });

    assert.equal(res.active_event_id, 718533);
    assert.deepEqual(res.ai_highlights, []);
    assert.equal(res.transcript, null);
  });

  test('parseEarnings does not return prepared remarks when the requested Q&A chapter is absent', () => {
    const res = parseEarnings([{ id: 1 }], null, {
      chapters: [{ title: 'Prepared Remarks', startTimestamp: 0, endTimestamp: 100 }],
      paragraphs: [{ speakers: ['Management'], text: 'Prepared remarks only', time: 20 }]
    }, { ticker: TICKER, includeTranscript: true, chapterFilter: 'qa' });

    assert.equal(res.transcript.chapter_selected, 'qa');
    assert.equal(res.transcript.chapter_available, false);
    assert.deepEqual(res.transcript.paragraphs, []);
  });

  test('parseEarnings includes only paragraphs inside the requested chapter timestamps', () => {
    const res = parseEarnings([{ id: 1 }], null, {
      chapters: [
        { title: 'Prepared Remarks', startTimestamp: 0, endTimestamp: 9 },
        { title: 'Q&A', startTimestamp: 10, endTimestamp: 20 }
      ],
      paragraphs: [9, 10, 20, 21].map(time => ({ speakers: ['Speaker'], text: `Paragraph ${time}`, time }))
    }, { ticker: TICKER, includeTranscript: true, chapterFilter: 'qa' });

    assert.equal(res.transcript.chapter_available, true);
    assert.deepEqual(res.transcript.paragraphs.map(paragraph => paragraph.time), [10, 20]);
  });

  test('parseProfile combines quote metadata and strategic description from authentic fixtures', () => {
    const quoteRaw = readJson('quote.json');
    const descRaw = readText('profile_description.txt');

    const res = parseProfile(quoteRaw, descRaw, TICKER);

    assert.equal(res.ticker, TICKER);
    assert.equal(res.company_name, 'Hero MotoCorp Limited');
    assert.equal(res.exchange, 'NSE');
    assert.equal(res.currency, 'INR');
    assert.equal(res.market_cap, 1096486460916);
    assert.equal(res.market_cap_crores, 109648.65);
    assert.ok(res.denomination_scale.includes('Crores') || res.denomination_scale.includes('1 Cr'));
    assert.ok(res.pe_ratio > 0);
    assert.ok(res.strategic_summary.full_profile.length > 50);
    assert.equal(res.quote_timestamp, new Date(1794131970 * 1000).toISOString());
    assert.equal(res.data_freshness.is_stale, null);
  });

  test('parseProfile does not label foreign market cap as INR crores', () => {
    const res = parseProfile({ currency: 'USD', marketCap: 1_000_000_000, timestamp: 100 }, null, 'AAPL');

    assert.equal(res.currency, 'USD');
    assert.equal(res.market_cap_crores, null);
    assert.match(res.denomination_scale, /USD.*not performed/i);
  });

  test('parseReports exposes numeric targets only when source supplies structured values', () => {
    const res = parseReports({
      documents: [
        { title: 'Target included', target_price: 120, currency: 'INR' },
        { title: 'Target only in prose', summary: 'Target price is ₹120' },
      ],
    }, TICKER);

    assert.equal(res.reports[0].target_price, 120);
    assert.equal(res.reports[0].currency, 'INR');
    assert.equal(res.reports[1].target_price, null);
    assert.equal(res.reports[1].currency, null);
  });

  test('parseNews formats publisher news articles from authentic news.json', () => {
    const raw = readJson('news.json');
    const res = parseNews(raw, TICKER);

    assert.equal(res.ticker, TICKER);
    assert.ok(res.articles.length > 0);
    const art = res.articles[0];
    assert.ok(art.title.length > 0);
    assert.ok(art.source.length > 0);
    assert.ok(art.url.startsWith('http'));
  });

  test('parsers handle empty or non-array inputs without throwing', () => {
    assert.equal(parseCatalysts([], TICKER).total_entries, 0);
    assert.equal(parseCatalysts(null, TICKER).total_entries, 0);
    assert.equal(parseReports({}, TICKER).total_reports, 0);
    assert.equal(parseReports(null, TICKER).total_reports, 0);
    assert.equal(parseEarnings([], null, null, { ticker: TICKER }).active_event_id, null);
    assert.equal(parseEarnings(null, null, null, { ticker: TICKER }).active_event_id, null);
    assert.equal(parseProfile(null, null, TICKER).company_name, null);
    assert.equal(parseNews([], TICKER).articles.length, 0);
    assert.equal(parseNews(null, TICKER).articles.length, 0);
  });
});
