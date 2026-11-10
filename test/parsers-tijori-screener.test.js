import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  stripSpans,
  METRIC_MAP,
  POPULAR_SECTORS,
  parseFilterFields,
  parsePopularScreensHtml,
  buildScreenerQueryParams,
} from '../src/parsers/tijori/screener.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

test('stripSpans removes HTML spans from object keys', () => {
  const input = {
    '<span>latest</span>Mcap<span>Cr</span>': 1234,
    'clean_key': 'value',
    nested: {
      '<span>nested</span>Field': 42
    }
  };
  const cleaned = stripSpans(input);
  assert.equal(cleaned['latestMcapCr'], 1234);
  assert.equal(cleaned['clean_key'], 'value');
  assert.equal(cleaned.nested['nestedField'], 42);
});

test('parseFilterFields filters catalog by query and type', () => {
  const fields = [
    { name: 'ROCE', type: 'Financials', display_name: 'ROCE %' },
    { name: 'Steel', type: 'Products', display_name: 'Steel Making' },
    { name: 'North America', type: 'Regions', display_name: 'North America' },
  ];
  const results = parseFilterFields(fields, { query: 'steel', type: 'Products' });
  assert.equal(results.length, 1);
  assert.equal(results[0].name, 'Steel');
});

test('buildScreenerQueryParams compiles query strings and boolean flags', () => {
  const params = buildScreenerQueryParams({
    filters: { roe: 15, pe: 25 },
    alternate: 'makes Steel',
    isChecked: true,
    whales: false,
    isSme: false,
    columns: ['Mcap', 'PE'],
  });

  assert.equal(params.financial, 'ROE > 15 AND PE Ratio < 25');
  assert.equal(params.alternate, 'makes Steel');
  assert.equal(params.is_checked, 'True');
  assert.equal(params.whales, 'False');
  assert.equal(params.is_sme, 'False');
  assert.equal(params.columns, 'Mcap,PE');
});

test('parsePopularScreensHtml extracts popular screen cards with categories', () => {
  const html = `
    <div class="popular_query_title">Growth Screens</div>
    <div class="query_card">
      <div class="query_name">High ROCE Compounders</div>
      <div class="query_desc">Companies with ROCE > 20% over 5 years</div>
      <a href="/filter/advanced_search/?query_id=101&financial=ROCE%20%3E%2020">Run Query</a>
    </div>
  `;
  const screens = parsePopularScreensHtml(html);
  assert.equal(screens.length, 1);
  assert.equal(screens[0].name, 'High ROCE Compounders');
  assert.equal(screens[0].category, 'Growth Screens');
  assert.equal(screens[0].query_id, '101');
});
