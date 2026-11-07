import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

test('src/index.js has zero imports from browser.js or playwright', () => {
  const code = readFileSync(join(__dirname, '..', 'src', 'index.js'), 'utf-8');
  assert.equal(code.includes('./browser.js'), false, 'Should not import browser.js');
  assert.equal(code.includes('playwright'), false, 'Should not import playwright');
  assert.ok(code.includes('TijoriClient'), 'Should import TijoriClient');
  assert.ok(code.includes('clear_cache'), 'Should register clear_cache tool');
});
