import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { PerplexityClient } from '../src/client/PerplexityClient.js';
import { resolveTicker } from '../src/index.js';

describe('Perplexity MCP Tool Helpers & Registration', () => {
  const pplxClient = new PerplexityClient();

  test('resolves slug to ticker via Tijori when ticker omitted', async () => {
    const mockTijori = {
      resolveCompanyIds: async (slug) => {
        if (slug === 'hero-motocorp-limited') return { symbol: 'HEROMOTOCO' };
        throw new Error('Company not found');
      }
    };

    assert.equal(await resolveTicker({ ticker: 'reliance.ns' }, mockTijori, pplxClient), 'RELIANCE.NS');
    assert.equal(await resolveTicker({ ticker: 'crm.us' }, mockTijori, pplxClient), 'CRM.US');
    assert.equal(await resolveTicker({ slug: 'hero-motocorp-limited' }, mockTijori, pplxClient), 'HEROMOTOCO');

    const mockTijoriWithSearch = {
      searchCompany: async (query) => {
        if (query === '500182') return [{ name: 'Hero MotoCorp Ltd.', slug: 'hero-motocorp-limited' }];
        return [];
      },
      resolveCompanyIds: async (slug) => {
        if (slug === 'hero-motocorp-limited') return { symbol: 'HEROMOTOCO' };
        throw new Error('Company not found');
      }
    };
    assert.equal(await resolveTicker({ ticker: '500182' }, mockTijoriWithSearch, pplxClient), 'HEROMOTOCO');

    await assert.rejects(
      async () => resolveTicker({ slug: 'invalid-slug' }, mockTijori, pplxClient),
      /Company not found/
    );
    await assert.rejects(
      async () => resolveTicker({}, mockTijori, pplxClient),
      /Either ticker or slug must be provided/
    );
  });

  test('routes a bare US ticker directly without adding an Indian exchange suffix', async () => {
    const resolved = await resolveTicker({ ticker: 'COIN' }, {}, pplxClient);
    const client = new PerplexityClient();
    const requests = [];
    client.fetchJson = async (endpoint) => {
      requests.push(endpoint);
      if (endpoint.includes('/quote/COIN')) return { currency: 'USD', name: 'Coinbase' };
      return {};
    };
    client.fetchText = async (endpoint) => {
      requests.push(endpoint);
      return '';
    };

    await client.getCompanyStrategicProfile(resolved);

    assert.equal(resolved, 'COIN');
    assert.ok(requests.some(endpoint => endpoint.includes('/quote/COIN')));
    assert.ok(requests.every(endpoint => !endpoint.includes('/quote/COIN.NS')));
  });

  test('src/index.js registers all 5 Perplexity tools', () => {
    const code = fs.readFileSync('src/index.js', 'utf8');
    const tools = [
      'get_price_movement_catalysts',
      'get_brokerage_reports',
      'get_earnings_intelligence',
      'get_company_strategic_profile',
      'get_curated_news'
    ];

    for (const tool of tools) {
      assert.ok(code.includes(`'${tool}'`), `Tool '${tool}' must be registered`);
    }
  });
});
