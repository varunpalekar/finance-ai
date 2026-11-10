import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseGoogleNewsXml } from '../src/parsers/tijori/news.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

test('parseGoogleNewsXml parses items, strips trailing source suffix, and normalizes date', () => {
  const fixturePath = path.join(__dirname, 'fixtures', 'google-news-mahabank.xml');
  const xml = fs.readFileSync(fixturePath, 'utf8');

  const items = parseGoogleNewsXml(xml);
  assert.ok(Array.isArray(items));
  assert.ok(items.length > 0);
  assert.ok(items[0].title);
  assert.ok(items[0].url);
  assert.ok(items[0].source);
  assert.ok(!items[0].title.endsWith(` - ${items[0].source}`));
  assert.ok(items[0].published_at);
});

test('parseGoogleNewsXml handles empty or malformed xml gracefully', () => {
  assert.deepEqual(parseGoogleNewsXml(''), []);
  assert.deepEqual(parseGoogleNewsXml('<rss><channel></channel></rss>'), []);
  assert.deepEqual(parseGoogleNewsXml('not xml at all'), []);
});
