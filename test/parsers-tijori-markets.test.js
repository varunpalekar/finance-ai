import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  extractSectionTable,
  parseRawMaterialsHtml,
  parseMacroIndicatorsHtml,
  parseMarketsHtml,
  parseMarketShareHtml,
  parseKnowledgeBaseHtml,
} from '../src/parsers/tijori/markets.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

test('parseRawMaterialsHtml parses section table rows from chemicals table', () => {
  const html = `
    <div id="chemicals">
      <table>
        <thead><tr><th>Metric</th><th>Price</th></tr></thead>
        <tbody>
          <tr><td class="firstcol"><span class="nameofmetriccol">Caustic Soda</span></td><td class="numericvalue">45,000</td></tr>
        </tbody>
      </table>
    </div>
  `;
  const result = parseRawMaterialsHtml(html, 'chemicals');
  assert.ok(Array.isArray(result.rows));
  assert.equal(result.rows[0].metric, 'Caustic Soda');
  assert.equal(result.rows[0].Price, '45,000');
});

test('parseMarketsHtml parses conglomerates table with tjiid and myid', () => {
  const html = `
    <div id="conglomerates">
      <table>
        <tbody>
          <tr parent="1" tjiid="101" myid="202">
            <td><span class="nameofmetriccol">Tata Group +</span></td>
          </tr>
        </tbody>
      </table>
    </div>
  `;
  const result = parseMarketsHtml(html, 'conglomerates');
  assert.ok(Array.isArray(result.rows));
  assert.equal(result.rows[0].conglomerate, 'Tata Group');
  assert.equal(result.rows[0].tjiid, '101');
  assert.equal(result.rows[0].myid, '202');
});

test('parseMarketShareHtml extracts metrics and percentages from overview fixture', () => {
  const fixturePath = path.join(__dirname, 'fixtures', 'tata-steel-overview.html');
  const html = fs.readFileSync(fixturePath, 'utf8');

  const result = parseMarketShareHtml(html, { slug: 'tata-steel-limited' });
  assert.equal(result.slug, 'tata-steel-limited');
  assert.ok(Array.isArray(result.metrics));
});

test('parseKnowledgeBaseHtml extracts and categorizes reports by period', () => {
  const fixturePath = path.join(__dirname, 'fixtures', 'tata-steel-overview.html');
  const html = fs.readFileSync(fixturePath, 'utf8');

  const result = parseKnowledgeBaseHtml(html, { slug: 'tata-steel-limited' });
  assert.equal(result.slug, 'tata-steel-limited');
  assert.ok(Array.isArray(result.annual_reports));
  assert.ok(Array.isArray(result.investor_presentations));
});
