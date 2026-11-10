import test from 'node:test';
import assert from 'node:assert/strict';
import { registerCompanyTools } from '../src/tools/company.js';
import { registerFinancialsTools } from '../src/tools/financials.js';
import { registerOperationsTools } from '../src/tools/operations.js';
import { registerValuationTools } from '../src/tools/valuation.js';
import { registerMacroTools } from '../src/tools/macro.js';
import { registerResearchTools } from '../src/tools/research.js';
import { registerScreenerTools } from '../src/tools/screener.js';
import { registerPerplexityTools } from '../src/tools/perplexity.js';

function createMockServer() {
  const registered = new Map();
  return {
    registered,
    registerTool(name, schema, handler) {
      registered.set(name, { schema, handler });
    },
  };
}

test('modular domain tool registries register all 33 tools correctly', () => {
  const server = createMockServer();
  const mockClient = {};
  const mockPplxClient = {};

  registerCompanyTools(server, { client: mockClient });
  registerFinancialsTools(server, { client: mockClient });
  registerOperationsTools(server, { client: mockClient });
  registerValuationTools(server, { client: mockClient });
  registerMacroTools(server, { client: mockClient });
  registerResearchTools(server, { client: mockClient });
  registerScreenerTools(server, { client: mockClient });
  registerPerplexityTools(server, { client: mockClient, pplxClient: mockPplxClient });

  assert.equal(server.registered.size, 33);
  assert.ok(server.registered.has('search_company'));
  assert.ok(server.registered.has('get_financials'));
  assert.ok(server.registered.has('get_operational_metrics'));
  assert.ok(server.registered.has('get_valuation_bands'));
  assert.ok(server.registered.has('get_macro_indicators'));
  assert.ok(server.registered.has('get_knowledge_base'));
  assert.ok(server.registered.has('screen_companies'));
  assert.ok(server.registered.has('get_earnings_intelligence'));
});
