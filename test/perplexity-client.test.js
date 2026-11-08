import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { PerplexityClient } from '../src/client/PerplexityClient.js';
import { initDb } from '../src/cache.js';

describe('PerplexityClient Core', () => {
  beforeEach(() => {
    initDb(':memory:');
  });

  test('normalizes unsuffixed Indian tickers to .NS while preserving .BO and US tickers', () => {
    const client = new PerplexityClient();
    assert.equal(client.normalizeTicker('HEROMOTOCO'), 'HEROMOTOCO.NS');
    assert.equal(client.normalizeTicker('heromotoco'), 'HEROMOTOCO.NS');
    assert.equal(client.normalizeTicker('HEROMOTOCO.NS'), 'HEROMOTOCO.NS');
    assert.equal(client.normalizeTicker('500182.BO'), '500182.BO');
    assert.equal(client.normalizeTicker('AAPL.US'), 'AAPL');
    assert.equal(client.normalizeTicker('AAPL'), 'AAPL');
  });

  test('generates strictly namespaced cache keys', () => {
    const client = new PerplexityClient();
    const key = client.cacheKey('timeline', 'HEROMOTOCO.NS', 'limit=50');
    assert.equal(key, 'pplx:timeline:HEROMOTOCO.NS:limit=50');
  });

  test('deduplicates in-flight network requests for identical endpoints', async () => {
    let callCount = 0;
    const client = new PerplexityClient();
    client._rawFetch = async () => {
      callCount++;
      await new Promise(r => setTimeout(r, 50));
      return { ok: true, status: 200, json: async () => ({ status: 'ok' }), text: async () => '{"status":"ok"}' };
    };

    const [r1, r2] = await Promise.all([
      client.fetchJson('/test-dedup'),
      client.fetchJson('/test-dedup')
    ]);

    assert.equal(callCount, 1);
    assert.deepEqual(r1, { status: 'ok' });
    assert.deepEqual(r2, { status: 'ok' });
  });

  test('cleans up in-flight map even if network request rejects', async () => {
    const client = new PerplexityClient();
    client._rawFetch = async () => {
      throw new Error('Network failure');
    };

    await assert.rejects(async () => client.fetchJson('/test-fail'), /Network failure/);
    assert.equal(client._inFlight.size, 0);
  });

  test('translates 401/403/Cloudflare challenge into PERPLEXITY_AUTH_REQUIRED error', async () => {
    const client = new PerplexityClient();
    client._rawFetch = async () => ({
      ok: false,
      status: 403,
      statusText: 'Forbidden',
      text: async () => 'Cloudflare Turnstile Challenge'
    });

    await assert.rejects(
      async () => client.fetchJson('/test-blocked'),
      (err) => err.code === 'PERPLEXITY_AUTH_REQUIRED'
    );
  });

  test('fetchText and fetchJson return identical plain types on SQLite cache hits', async () => {
    let textCalls = 0;
    let jsonCalls = 0;
    const client = new PerplexityClient();
    client._rawFetch = async (url) => {
      if (url.includes('/text')) {
        textCalls++;
        return { ok: true, status: 200, text: async () => 'raw profile text description' };
      }
      jsonCalls++;
      return { ok: true, status: 200, json: async () => ({ company: 'Hero' }) };
    };

    // First calls (cache miss)
    const t1 = await client.fetchText('/text', { cacheKey: 'pplx:test:text', ttl: 10000 });
    const j1 = await client.fetchJson('/json', { cacheKey: 'pplx:test:json', ttl: 10000 });

    assert.equal(typeof t1, 'string');
    assert.equal(t1, 'raw profile text description');
    assert.equal(typeof j1, 'object');
    assert.equal(j1.company, 'Hero');

    // Second calls (cache hit)
    const t2 = await client.fetchText('/text', { cacheKey: 'pplx:test:text', ttl: 10000 });
    const j2 = await client.fetchJson('/json', { cacheKey: 'pplx:test:json', ttl: 10000 });

    assert.equal(textCalls, 1, 'Should not fetch text from network again');
    assert.equal(jsonCalls, 1, 'Should not fetch json from network again');
    assert.equal(typeof t2, 'string', 'Cached text must be string, not object with _cache_meta');
    assert.equal(t2, 'raw profile text description');
    assert.equal(j2.company, 'Hero');
  });

  test('retries with bare US ticker if auto-suffixed .NS returns 404', async () => {
    const client = new PerplexityClient();
    const queried = [];
    client._rawFetch = async (url) => {
      queried.push(url);
      if (url.includes('/CRM.NS')) {
        return { ok: false, status: 404, statusText: 'Not Found', text: async () => 'Not found' };
      }
      if (url.includes('/CRM')) {
        return { ok: true, status: 200, json: async () => ({ name: 'Salesforce', symbol: 'CRM' }), text: async () => 'Salesforce profile' };
      }
      throw new Error('Unexpected url: ' + url);
    };

    const res = await client.getCompanyStrategicProfile('CRM');
    assert.equal(res.company_name, 'Salesforce');
    assert.ok(queried.some(u => u.includes('/CRM.NS')), 'Must query auto-suffixed .NS first');
    assert.ok(queried.some(u => u.includes('/quote/CRM')), 'Must fall back to bare US ticker');
  });

  test('getUserInfo extracts authenticated profile data or returns unauthenticated fallback', async () => {
    const client = new PerplexityClient();
    client._rawFetch = async (url) => {
      if (url.includes('/api/auth/session')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            user: {
              name: 'Varun Palekar',
              username: 'varunpalekar',
              email: 'varun@example.com',
              subscription_status: 'pro'
            }
          })
        };
      }
      throw new Error('Unexpected url: ' + url);
    };

    const info = await client.getUserInfo();
    assert.equal(info.is_authenticated, true);
    assert.equal(info.name, 'Varun Palekar');
    assert.equal(info.username, 'varunpalekar');
    assert.equal(info.email, 'varun@example.com');
    assert.equal(info.subscription_status, 'pro');

    const unauthClient = new PerplexityClient();
    unauthClient._rawFetch = async () => ({ ok: false, status: 401 });
    const unauthInfo = await unauthClient.getUserInfo({ fresh: true });
    assert.equal(unauthInfo.is_authenticated, false);
    assert.equal(unauthInfo.name, null);
  });
});

describe('PerplexityClient High-Level Methods', () => {
  test('getPriceMovementCatalysts fetches timeline and returns parsed result', async () => {
    const client = new PerplexityClient();
    client.fetchJson = async (endpoint, opts) => {
      assert.ok(endpoint.includes('/timeline/HEROMOTOCO.NS/entries'));
      return [{ last_modified: '2026-11-08', price: 5478, price_movement: -0.65, description: 'Muhurat trading flat', sources: [] }];
    };

    const res = await client.getPriceMovementCatalysts('HEROMOTOCO.NS');
    assert.equal(res.ticker, 'HEROMOTOCO.NS');
    assert.equal(res.total_entries, 1);
  });

  test('getEarningsIntelligence staggers analysis and transcript requests by 150ms and handles 404 gracefully', async () => {
    const client = new PerplexityClient();
    const timestamps = [];

    client.fetchJson = async (endpoint) => {
      timestamps.push(Date.now());
      if (endpoint.includes('/earnings/HEROMOTOCO.NS/analysis/')) {
        const err = new Error('Not found');
        err.status = 404;
        throw err;
      }
      if (endpoint.includes('/earnings/HEROMOTOCO.NS/transcript/')) {
        return { paragraphs: [] };
      }
      return [{ id: 718533, fiscalPeriod: 'Q2', fiscalYear: 2027, actualRevenue: 145000000000 }];
    };

    const res = await client.getEarningsIntelligence('HEROMOTOCO.NS', { includeTranscript: true });
    assert.equal(res.active_event_id, 718533);
    assert.deepEqual(res.ai_highlights, []);
    assert.ok(res.transcript !== null);
    assert.ok(timestamps.length >= 2);
    if (timestamps.length >= 3) {
      assert.ok(timestamps[1] - timestamps[0] >= 140);
    }
  });

  test('getCompanyStrategicProfile parallelizes quote and description queries', async () => {
    const client = new PerplexityClient();
    client.fetchJson = async (endpoint) => {
      if (endpoint.includes('/quote/')) return { name: 'Hero MotoCorp Limited', symbol: 'HEROMOTOCO.NS' };
      throw new Error('Unknown');
    };
    client.fetchText = async (endpoint) => {
      if (endpoint.includes('/profile/')) return 'Hero is leader in two wheelers.';
      throw new Error('Unknown');
    };

    const res = await client.getCompanyStrategicProfile('HEROMOTOCO.NS');
    assert.equal(res.company_name, 'Hero MotoCorp Limited');
    assert.equal(res.strategic_summary.full_profile, 'Hero is leader in two wheelers.');
  });
});

