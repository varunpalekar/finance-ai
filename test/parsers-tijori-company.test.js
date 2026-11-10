import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  parseResolveCompanyIdsHtml,
  parseFundFlowJson,
  parseConglomerateConstituentsJson,
  parseNicheConstituentsJson,
} from '../src/parsers/tijori/company.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

test('parseResolveCompanyIdsHtml extracts name, symbol, and id independently regardless of key order', () => {
  const html = `<html><body><script>
    var meta = {"company_id": 999, "symbol": "TESTSYM", "company": "Test Enterprise Ltd"};
  </script></body></html>`;

  const result = parseResolveCompanyIdsHtml(html, { slug: 'test-enterprise' });
  assert.equal(result.slug, 'test-enterprise');
  assert.equal(result.company_id, 999);
  assert.equal(result.symbol, 'TESTSYM');
  assert.equal(result.name, 'Test Enterprise Ltd');
});

test('parseFundFlowJson formats sources and uses correctly for requested year window', () => {
  const fixturePath = path.join(__dirname, 'fixtures', 'fund-flow-tata.json');
  const raw = JSON.parse(fs.readFileSync(fixturePath, 'utf8'));

  const result = parseFundFlowJson(raw, 2195, 5);
  assert.equal(result.company_id, 2195);
  assert.equal(result.years, 5);
  assert.equal(result.currency, 'INR');
  assert.equal(result.denomination, 'Crores (1 Cr = 10,000,000 INR)');
  assert.ok(Array.isArray(result.sources));
  assert.ok(Array.isArray(result.uses));
  assert.equal(result.sources[0].name, 'Cash from Operations');
  assert.equal(result.sources[0].value, 95000);
  assert.equal(result.uses[0].name, 'CapEx');
  assert.equal(result.uses[0].value, 55000);
});

test('parseConglomerateConstituentsJson formats constituent companies and return series', () => {
  const raw = {
    data: [
      {
        name: 'Tata Motors',
        slug: 'tata-motors',
        data: [1.2, 3.4, 5.6, 7.8, 9.0, 15.0, 25.0, 40.0, 60.0, 100.0],
      },
    ],
  };

  const result = parseConglomerateConstituentsJson(raw, 'tata-group');
  assert.equal(result.tjiid, 'tata-group');
  assert.equal(result.total, 1);
  assert.equal(result.companies[0].name, 'Tata Motors');
  assert.equal(result.companies[0].returns['1D'], 1.2);
  assert.equal(result.companies[0].returns['1Y'], 15.0);
});

test('parseNicheConstituentsJson formats weights and returns', () => {
  const raw = {
    data: [
      {
        name: 'Solar Ind',
        slug: 'solar-ind',
        weight: 12.5,
        eq_weight: 10.0,
        data: [0.5, 1.0, 2.0, 3.0, 4.0, 5.0, 6.0, 7.0, 8.0, 9.0],
      },
    ],
  };

  const result = parseNicheConstituentsJson(raw, 'defence');
  assert.equal(result.tjiid, 'defence');
  assert.equal(result.total, 1);
  assert.equal(result.companies[0].weight_pct, 12.5);
  assert.equal(result.companies[0].eq_weight_pct, 10.0);
});
