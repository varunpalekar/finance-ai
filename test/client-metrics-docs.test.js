import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { test } from 'node:test';
import { TijoriClient } from '../src/client/TijoriClient.js';
import { createMockFetch } from './mock-transport.js';

test('getMarketShare returns empty list and note when no data exists without throwing', async () => {
  const mockFetch = createMockFetch({
    '/company/swaraj-engines-limited/': {
      status: 200,
      body: '<html><body><div id="content"></div></body></html>'
    }
  });
  const client = new TijoriClient({ fetchFn: mockFetch, cacheEnabled: false });
  const result = await client.getMarketShare('swaraj-engines-limited');
  assert.deepEqual(result.metrics, []);
  assert.ok(result.note);
});

test('getOperationalMetrics returns empty list and note when no KPIs exist without throwing', async () => {
  const mockFetch = createMockFetch({
    '/company/unknown-stock/': {
      status: 200,
      body: '<html><body></body></html>'
    }
  });
  const client = new TijoriClient({ fetchFn: mockFetch, cacheEnabled: false });
  const result = await client.getOperationalMetrics('unknown-stock');
  assert.deepEqual(result.metrics, []);
  assert.ok(result.note);
});

test('fetchDocument enforces strict hostname check against SSRF', async () => {
  const client = new TijoriClient({ cacheEnabled: false });
  await assert.rejects(
    () => client.fetchDocument('https://evil.internal.network/secret.pdf'),
    /Only files\.tijorifinance\.com URLs are supported/
  );
  await assert.rejects(
    () => client.fetchDocument('http://files.tijorifinance.com/test.pdf'),
    /Only HTTPS URLs are supported/
  );
});

test('getKnowledgeBase categorizes reports by period', async () => {
  const html = `
    <div id="knowledgebase">
      <a href="https://files.tijorifinance.com/reports/tata/AR-24.pdf?type=Annual%20Report">AR-24</a>
      <a href="https://files.tijorifinance.com/reports/tata/CC-Jan24.pdf?type=Conference%20Call">CC-Jan24</a>
    </div>
  `;
  const mockFetch = createMockFetch({
    '/company/tata-steel-limited/': { status: 200, body: html }
  });
  const client = new TijoriClient({ fetchFn: mockFetch, cacheEnabled: false });
  const kb = await client.getKnowledgeBase('tata-steel-limited');
  assert.equal(kb.slug, 'tata-steel-limited');
  assert.equal(kb.annual_reports.length, 1);
  assert.equal(kb.annual_reports[0].period, 'FY24');
  assert.equal(kb.conference_calls.length, 1);
  assert.equal(kb.conference_calls[0].period, 'Jan 2024');
});

test('fetchDocument forwards session cookies and attaches abort signal', async () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tijori-doc-test-'));
  const testSessionPath = path.join(tmpDir, 'session.json');
  fs.writeFileSync(
    testSessionPath,
    JSON.stringify([{ name: 'sessionid', value: 'xyz' }, { name: 'csrftoken', value: 'abc' }])
  );

  let capturedHeaders = null;
  let capturedSignal = null;
  const mockFetch = async (url, init) => {
    capturedHeaders = init.headers;
    capturedSignal = init.signal;
    return {
      status: 200,
      arrayBuffer: async () => new Uint8Array([]).buffer,
    };
  };

  const client = new TijoriClient({ sessionPath: testSessionPath, fetchFn: mockFetch, cacheEnabled: false });

  try {
    await client.fetchDocument('https://files.tijorifinance.com/reports/tata/test.pdf');
  } catch (_) {
    // pdf-parse throws on empty buffer, but fetch headers/signal are already captured
  }

  assert.equal(capturedHeaders?.Cookie, 'sessionid=xyz; csrftoken=abc');
  assert.ok(capturedSignal, 'AbortSignal should be present');

  fs.rmSync(tmpDir, { recursive: true, force: true });
});
