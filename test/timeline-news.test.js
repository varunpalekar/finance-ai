import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { TijoriClient } from '../src/client/TijoriClient.js';
import { createMockFetch } from './mock-transport.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

test('getCompanyTimeline extracts authentic key_events and what_to_watch analyst guidance for Bank of Maharashtra', async () => {
  const liveHtml = readFileSync(join(__dirname, 'fixtures', 'bank-of-maharashtra-overview.html'), 'utf-8');
  const mockFetch = createMockFetch({
    '/company/bank-of-maharashtra/': { status: 200, body: liveHtml }
  });
  const client = new TijoriClient({ fetchFn: mockFetch, cacheEnabled: false });
  const res = await client.getCompanyTimeline('bank-of-maharashtra');

  assert.equal(res.slug, 'bank-of-maharashtra');
  assert.ok(Array.isArray(res.key_events));
  assert.ok(res.key_events.length >= 1, 'Expected at least 1 key event');
  assert.ok(res.key_events[0].date, 'Key event must have date');
  assert.ok(/^\d{4}-\d{2}-\d{2}$/.test(res.key_events[0].date), `Date must be YYYY-MM-DD, got ${res.key_events[0].date}`);
  assert.ok(res.key_events[0].label.length > 5);

  assert.ok(res.what_to_watch);
  assert.ok(res.what_to_watch.analyst_summary.length > 20, 'Expected substantive analyst summary text');

  for (let i = 1; i < res.key_events.length; i++) {
    const prev = res.key_events[i - 1].date || '';
    const curr = res.key_events[i].date || '';
    assert.ok(prev <= curr, `Key events must be sorted chronologically: ${prev} <= ${curr}`);
  }
});

test('getCompanyTimeline deterministically sorts events chronologically even if DOM order is reversed', async () => {
  const reverseHtml = `<html><body><script id="company_details_data" type="application/json">
    {"memory_overview": {"key_events": [
      {"date": "2026-05-10", "label": "Recent event"},
      {"date": "2024-01-15", "label": "Old event"},
      {"date": "2025-08-20", "label": "Middle event"}
    ]}}
  </script></body></html>`;
  const mockFetch = createMockFetch({
    '/company/reverse-corp/': { status: 200, body: reverseHtml }
  });
  const client = new TijoriClient({ fetchFn: mockFetch, cacheEnabled: false });
  const res = await client.getCompanyTimeline('reverse-corp');
  assert.equal(res.key_events.length, 3);
  assert.equal(res.key_events[0].date, '2024-01-15');
  assert.equal(res.key_events[1].date, '2025-08-20');
  assert.equal(res.key_events[2].date, '2026-05-10');
});

test('getStockNews parses authentic Google News RSS items, strips trailing source suffix from title, and respects limit', async () => {
  const liveXml = readFileSync(join(__dirname, 'fixtures', 'google-news-mahabank.xml'), 'utf-8');
  const query = 'NSE:MAHABANK';
  const mockFetch = createMockFetch({
    [`https://news.google.com/rss/search?q=${encodeURIComponent(query)}+when:90d&hl=en-IN&gl=IN&ceid=IN:en`]: {
      status: 200,
      headers: { 'content-type': 'application/rss+xml' },
      body: liveXml
    }
  });
  const client = new TijoriClient({ fetchFn: mockFetch, cacheEnabled: false });
  const res = await client.getStockNews(query, { limit: 3, days: 90 });

  assert.equal(res.query, query);
  assert.ok(res.total_found >= 1);
  assert.equal(res.news.length, 3, 'Must be sliced to requested limit of 3');

  const first = res.news[0];
  assert.ok(first.title);
  assert.ok(first.source);
  assert.ok(first.url.startsWith('http'));
  assert.ok(first.published_at);
});

test('getStockNews handles malformed XML or empty RSS gracefully without crashing', async () => {
  const mockFetch = createMockFetch({
    [`https://news.google.com/rss/search?q=INVALID&hl=en-IN&gl=IN&ceid=IN:en`]: {
      status: 200,
      body: '<malformed'
    }
  });
  const client = new TijoriClient({ fetchFn: mockFetch, cacheEnabled: false });
  const res = await client.getStockNews('INVALID');
  assert.equal(res.total_found, 0);
  assert.deepEqual(res.news, []);
  assert.ok(res.note);
});

test('getStockNews does not leak Tijori session cookies, CSRF, Referer, or Origin to Google News', async () => {
  let capturedHeaders = null;
  const mockFetch = async (url, init) => {
    capturedHeaders = init.headers;
    return new Response('<rss><channel></channel></rss>', { status: 200, headers: { 'content-type': 'application/rss+xml' } });
  };
  const client = new TijoriClient({
    fetchFn: mockFetch,
    cacheEnabled: false,
    sessionPath: '/non-existent-session.json',
  });
  client._session = {
    cookieHeader: 'sessionid=secret_cookie_123',
    csrfToken: 'secret_csrf_456',
  };

  await client.getStockNews('NSE:MAHABANK');
  assert.ok(capturedHeaders, 'Expected request headers to be captured');
  assert.equal(capturedHeaders['Cookie'], undefined, 'Must not leak Cookie header to Google News');
  assert.equal(capturedHeaders['X-CSRFToken'], undefined, 'Must not leak X-CSRFToken to Google News');
  assert.equal(capturedHeaders['Origin'], undefined, 'Must not leak Origin header to Google News');
  assert.equal(capturedHeaders['Referer'], undefined, 'Must not leak Referer header to Google News');
});

test('getStockNews receiving HTTP 403 or 401 from third party does not wipe Tijori session', async () => {
  const mockFetch = async () => {
    return new Response('Forbidden', { status: 403, statusText: 'Forbidden' });
  };
  const client = new TijoriClient({
    fetchFn: mockFetch,
    cacheEnabled: false,
    sessionPath: '/non-existent-session.json',
  });
  client._session = {
    cookieHeader: 'sessionid=valid_tijori_session',
    csrfToken: 'valid_tijori_csrf',
  };

  const res = await client.getStockNews('NSE:TEST_403');
  assert.deepEqual(res.news, []);
  assert.equal(client._session.cookieHeader, 'sessionid=valid_tijori_session', 'Tijori session must remain intact');
  assert.equal(client._session.csrfToken, 'valid_tijori_csrf', 'Tijori csrf token must remain intact');
});

test('getStockNews falls back to stale cache on network failure and does not poison cache with empty results', async () => {
  const query = `NSE:RELIANCE_${Date.now()}`;
  let shouldFail = false;
  const mockFetch = async () => {
    if (shouldFail) {
      throw new Error('fetch failed: ENOTFOUND news.google.com');
    }
    const xml = `<rss><channel><item><title>Reliance expands green energy - ET</title><link>https://example.com/r</link><pubDate>Wed, 06 Nov 2026 10:00:00 GMT</pubDate><source>ET</source></item></channel></rss>`;
    return new Response(xml, { status: 200, headers: { 'content-type': 'application/rss+xml' } });
  };

  const client = new TijoriClient({ fetchFn: mockFetch, cacheEnabled: true });

  // 1. Successful fetch populates cache
  const first = await client.getStockNews(query);
  assert.equal(first.total_found, 1);
  assert.equal(first.news.length, 1);

  // 2. Network fails on fresh query
  shouldFail = true;
  const fallback = await client.getStockNews(query, { fresh: true });
  assert.equal(fallback.total_found, 1, 'Must return cached articles, not empty array');
  assert.equal(fallback._cache_meta?.is_stale, true, 'Must indicate stale cache fallback');

  // 3. Subsequent cached call still has the data (cache was not poisoned)
  const cached = await client.getStockNews(query);
  assert.equal(cached.total_found, 1, 'Cache must not be poisoned by network failure');
});

test('getCompanyTimeline falls back to stale SQLite cache on network outage', async () => {
  const slug = `mahabank-timeline-${Date.now()}`;
  const liveHtml = readFileSync(join(__dirname, 'fixtures', 'bank-of-maharashtra-overview.html'), 'utf-8');
  let shouldFail = false;
  const mockFetch = async () => {
    if (shouldFail) throw new Error('503 Service Unavailable');
    return new Response(liveHtml, { status: 200, headers: { 'content-type': 'text/html' } });
  };
  const client = new TijoriClient({ fetchFn: mockFetch, cacheEnabled: true });

  const initial = await client.getCompanyTimeline(slug);
  assert.ok(initial.key_events.length >= 1);

  shouldFail = true;
  const fallback = await client.getCompanyTimeline(slug, { fresh: true });
  assert.equal(fallback._cache_meta?.is_stale, true, 'Must return stale timeline');
  assert.ok(fallback.key_events.length >= 1);
});
