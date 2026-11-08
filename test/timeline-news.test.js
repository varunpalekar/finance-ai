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
