import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

test('src/index.js has zero imports from browser.js or playwright', () => {
  const indexCode = readFileSync(join(__dirname, '..', 'src', 'index.js'), 'utf-8');
  assert.equal(indexCode.includes('./browser.js'), false, 'Should not import browser.js');
  assert.equal(indexCode.includes('playwright'), false, 'Should not import playwright');
  assert.ok(indexCode.includes('TijoriClient'), 'Should import TijoriClient');

  const toolsDir = join(__dirname, '..', 'src', 'tools');
  const toolsCode = readdirSync(toolsDir).map(f => readFileSync(join(toolsDir, f), 'utf-8')).join('\n');
  const allCode = `${indexCode}\n${toolsCode}`;
  assert.ok(allCode.includes('clear_cache'), 'Should register clear_cache tool');
  assert.ok(allCode.includes('get_user_info'), 'Should register get_user_info tool');
});
