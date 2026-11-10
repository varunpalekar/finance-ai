import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  parseValuationBands,
  parseScenarioProjectionsHtml,
  parseFactorsAndBenchmarkingHtml,
} from '../src/parsers/tijori/valuation.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

test('parseValuationBands calculates statistical percentile bands from authentic daily P/E data', () => {
  const fixturePath = path.join(__dirname, 'fixtures', 'swaraj-engines-pe.json');
  const rawJson = JSON.parse(fs.readFileSync(fixturePath, 'utf8'));

  const result = parseValuationBands(rawJson, { slug: 'swaraj-engines-limited', companyId: 2195, peers: [] });
  assert.equal(result.slug, 'swaraj-engines-limited');
  assert.equal(result.company_id, 2195);
  assert.ok(result.current_pe > 0);
  assert.ok(result.as_of);
  assert.ok(result.valuation_bands['1y']);
  assert.ok(result.valuation_bands['3y']);
  assert.ok(result.valuation_bands['5y']);
  assert.ok(result.valuation_bands['10y']);
  assert.ok(result.valuation_bands['1y'].p25 <= result.valuation_bands['1y'].median);
  assert.ok(result.valuation_bands['1y'].median <= result.valuation_bands['1y'].p75);
});

test('parseScenarioProjectionsHtml rejects sample reports or mismatching slugs', () => {
  const sampleHtml = `
    <html>
      <head><title>Tata Steel | Stock Details</title></head>
      <body>
        <div class="peg-sample__table"><table><tr><td>Base</td><td>60%</td><td>Growth</td></tr></table></div>
        <div class="peg-sample__company">Sample Report of Another Company</div>
      </body>
    </html>
  `;
  const result = parseScenarioProjectionsHtml(sampleHtml, { slug: 'tata-steel' });
  assert.equal(result.has_projections, false);
  assert.ok(result.note.includes('No verified company-specific scenario projections available'));
});

test('parseFactorsAndBenchmarkingHtml extracts radar axes and scores from authentic fixture', () => {
  const fixturePath = path.join(__dirname, 'fixtures', 'bank-of-maharashtra-factors.html');
  const html = fs.readFileSync(fixturePath, 'utf8');

  const result = parseFactorsAndBenchmarkingHtml(html, { slug: 'bank-of-maharashtra' });
  assert.equal(result.slug, 'bank-of-maharashtra');
  assert.ok(Array.isArray(result.radar_axes));
  assert.ok(result.radar_axes.length > 0);
  assert.ok(result.radar_axes[0].name);
});
