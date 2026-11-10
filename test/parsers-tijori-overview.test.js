import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  parseCompanyOverviewHtml,
  parseCompanyTimelineHtml,
  parseCorporateActionsHtml,
  parseSupplyChainHtml,
} from '../src/parsers/tijori/overview.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

test('parseCompanyOverviewHtml extracts metadata, ratios, and market share from authentic fixture', () => {
  const fixturePath = path.join(__dirname, 'fixtures', 'swaraj-engines-overview.html');
  const html = fs.readFileSync(fixturePath, 'utf8');

  const result = parseCompanyOverviewHtml(html, { slug: 'swaraj-engines-limited' });
  assert.equal(result.slug, 'swaraj-engines-limited');
  assert.ok(result.company);
  assert.ok(result.company_id);
  assert.equal(result.currency, 'INR');
  assert.ok(result.denomination_scale);
  assert.ok(result.ratios);
});

test('parseCompanyTimelineHtml extracts key_events and what_to_watch', () => {
  const fixturePath = path.join(__dirname, 'fixtures', 'bank-of-maharashtra-overview.html');
  const html = fs.readFileSync(fixturePath, 'utf8');

  const result = parseCompanyTimelineHtml(html, { slug: 'bank-of-maharashtra' });
  assert.equal(result.slug, 'bank-of-maharashtra');
  assert.ok(Array.isArray(result.key_events));
  assert.ok(result.what_to_watch);
});

test('parseCorporateActionsHtml extracts dividends, splits, and bonuses', () => {
  const fixturePath = path.join(__dirname, 'fixtures', 'swaraj-engines-overview.html');
  const html = fs.readFileSync(fixturePath, 'utf8');

  const result = parseCorporateActionsHtml(html, { slug: 'swaraj-engines-limited' });
  assert.equal(result.slug, 'swaraj-engines-limited');
  assert.ok(Array.isArray(result.dividends));
  assert.ok(Array.isArray(result.splits));
  assert.ok(Array.isArray(result.bonuses));
  assert.ok(Array.isArray(result.rights));
});

test('parseSupplyChainHtml extracts supplier/customer notes and industries', () => {
  const fixturePath = path.join(__dirname, 'fixtures', 'swaraj-engines-overview.html');
  const html = fs.readFileSync(fixturePath, 'utf8');

  const result = parseSupplyChainHtml(html, { slug: 'swaraj-engines-limited' });
  assert.equal(result.slug, 'swaraj-engines-limited');
  assert.ok(Array.isArray(result.operational_supplier_notes));
  assert.ok(Array.isArray(result.operational_customer_notes));
  assert.ok(Array.isArray(result.industries_catered));
});
