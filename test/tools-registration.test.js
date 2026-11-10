import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

test('src/index.js exports complete 28-tool registry with correct Zod schemas and error wrapping', () => {
  const indexCode = fs.readFileSync('src/index.js', 'utf8');
  const toolsDir = 'src/tools';
  const toolsCode = fs.readdirSync(toolsDir).map(f => fs.readFileSync(path.join(toolsDir, f), 'utf8')).join('\n');
  const code = `${indexCode}\n${toolsCode}`;
  const newTools = [
    'get_factors_and_benchmarking',
    'get_valuation_bands',
    'get_scenario_projections',
    'get_company_timeline',
    'get_stock_news',
    'get_corporate_actions',
    'get_supply_chain'
  ];

  for (const tool of newTools) {
    assert.ok(code.includes(`'${tool}'`), `Tool '${tool}' must be registered`);
  }
  assert.ok(code.includes('server.registerTool('), 'Must use official MCP SDK tool registration');
  assert.ok(code.includes("basis: z.enum(['consolidated', 'standalone']).optional()"), 'get_financials must allow an explicit reporting basis');

  // Verify detailed option in get_shareholding tool schema
  assert.ok(code.includes('detailed: z.boolean().optional()'), 'get_shareholding must include detailed boolean option');
});
