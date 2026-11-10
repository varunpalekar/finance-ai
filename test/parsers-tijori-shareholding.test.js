import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  parseShareholdingSummaryHtml,
  parseShareholdingDetailedHtml,
} from '../src/parsers/tijori/shareholding.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

test('parseShareholdingSummaryHtml extracts quarterly periods and percentage holdings', () => {
  const fixturePath = path.join(__dirname, 'fixtures', 'tata-steel-shareholding.html');
  const html = fs.readFileSync(fixturePath, 'utf8');

  const result = parseShareholdingSummaryHtml(html);
  assert.ok(Array.isArray(result.quarters));
  assert.ok(result.quarters.length > 0);
  const q0 = result.quarters[0];
  assert.ok(q0.period);
});

test('parseShareholdingDetailedHtml parses institutions, non-institutions, and converts em-dash to null', () => {
  const fixturePath = path.join(__dirname, 'fixtures', 'bank-of-maharashtra-shareholding.html');
  const html = fs.readFileSync(fixturePath, 'utf8');

  const result = parseShareholdingDetailedHtml(html, { slug: 'bank-of-maharashtra' });
  assert.equal(result.slug, 'bank-of-maharashtra');
  assert.equal(result.detailed, true);
  assert.ok(Array.isArray(result.quarters));
  assert.ok(Array.isArray(result.summary));
  assert.ok(Array.isArray(result.institutions));
  assert.ok(Array.isArray(result.non_institutions));
  assert.ok(result.summary.length > 0);

  // Check that empty / dash cells become null
  const allValues = [
    ...result.summary.flatMap(r => r.shares_pct),
    ...result.institutions.flatMap(r => r.shares_pct),
    ...result.non_institutions.flatMap(r => r.shares_pct),
  ];
  assert.ok(allValues.includes(null));
});
