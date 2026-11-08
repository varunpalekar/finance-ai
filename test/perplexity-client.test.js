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
});
