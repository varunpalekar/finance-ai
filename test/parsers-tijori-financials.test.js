import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseFinancialsHtml } from '../src/parsers/tijori/financials.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

test('parseFinancialsHtml parses consolidated P&L statements from fixture', () => {
  const fixturePath = path.join(__dirname, 'fixtures', 'tata-steel-financials.html');
  const html = fs.readFileSync(fixturePath, 'utf8');

  const result = parseFinancialsHtml(html, { type: 'pl', basis: 'consolidated' });
  assert.equal(result.type, 'pl');
  assert.equal(result.reporting_basis, 'consolidated');
  assert.equal(result.currency, 'INR');
  assert.ok(Array.isArray(result.headers));
  assert.ok(result.headers.length > 1);
  assert.ok(Array.isArray(result.rows));
  assert.ok(result.rows.length > 0);
  assert.ok(result.rows[0].metric);
});

test('parseFinancialsHtml rejects mismatched or unavailable reporting basis', () => {
  const fixturePath = path.join(__dirname, 'fixtures', 'tata-steel-financials.html');
  const html = fs.readFileSync(fixturePath, 'utf8');

  assert.throws(
    () => parseFinancialsHtml(html, { type: 'pl', basis: 'standalone' }),
    /Requested standalone P&L statement is unavailable/
  );
});

test('parseFinancialsHtml throws on unsupported statement type or basis', () => {
  assert.throws(
    () => parseFinancialsHtml('<html></html>', { type: 'unknown', basis: 'consolidated' }),
    /Unsupported financial statement type/
  );
  assert.throws(
    () => parseFinancialsHtml('<html></html>', { type: 'pl', basis: 'unsupported' }),
    /Unsupported reporting basis/
  );
});
