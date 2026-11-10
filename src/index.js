#!/usr/bin/env node
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { TijoriClient } from './client/TijoriClient.js';
import { PerplexityClient } from './client/PerplexityClient.js';
import { registerCompanyTools } from './tools/company.js';
import { registerFinancialsTools } from './tools/financials.js';
import { registerOperationsTools } from './tools/operations.js';
import { registerValuationTools } from './tools/valuation.js';
import { registerMacroTools } from './tools/macro.js';
import { registerResearchTools } from './tools/research.js';
import { registerScreenerTools } from './tools/screener.js';
import { registerPerplexityTools, resolveTicker as _resolveTicker } from './tools/perplexity.js';

// Reserve stdout exclusively for JSON-RPC messages; divert console.log to stderr
console.log = console.error;

export const client = new TijoriClient();
export const pplxClient = new PerplexityClient();
export const server = new McpServer({ name: 'tijori-finance', version: '1.0.0' });

export function resolveTicker(args, tijoriClient = client, perplexityClient = pplxClient) {
  return _resolveTicker(args, tijoriClient, perplexityClient);
}

// Register modular domain tools
registerCompanyTools(server, { client });
registerFinancialsTools(server, { client });
registerOperationsTools(server, { client });
registerValuationTools(server, { client });
registerMacroTools(server, { client });
registerResearchTools(server, { client });
registerScreenerTools(server, { client });
registerPerplexityTools(server, { client, pplxClient });

async function main() {
  const syncCheck = await client.validateSession({ probe: false });
  if (!syncCheck.valid) {
    process.stderr.write(`\n[tijori-mcp] ⚠️ WARNING: ${syncCheck.message}\n\n`);
  } else {
    // Non-blocking live probe to verify active session without delaying MCP handshake
    client.validateSession({ probe: true }).then(async res => {
      if (!res.valid) {
        process.stderr.write(`\n[tijori-mcp] ⚠️ WARNING: ${res.message}\n\n`);
      } else if (!res.offline) {
        const info = await client.getUserInfo().catch(() => null);
        const plan = info?.plan_tier ? ` (${info.plan_tier.toUpperCase()} plan)` : '';
        const user = (info?.username || info?.email) ? ` as ${info.username || info.email}` : '';
        process.stderr.write(`[tijori-mcp] Connected — authenticated${user}${plan}.\n`);
      }
    }).catch(() => {});
  }

  const pplxCheck = await pplxClient.validateSession({ probe: false });
  if (pplxCheck.valid) {
    pplxClient.getUserInfo().then(info => {
      const user = info?.name || info?.username || info?.email;
      const userStr = user ? ` as ${user}` : '';
      const sub = info?.subscription_status ? ` (${info.subscription_status.toUpperCase()})` : '';
      process.stderr.write(`[tijori-mcp] Perplexity connected — authenticated${userStr}${sub}.\n`);
    }).catch(() => {
      process.stderr.write(`[tijori-mcp] Perplexity session active.\n`);
    });
  }

  const transport = new StdioServerTransport();
  await server.connect(transport);
}

const isEntry = Boolean(
  process.argv[1] && (
    fileURLToPath(import.meta.url) === path.resolve(process.argv[1]) ||
    (fs.existsSync(process.argv[1]) && fileURLToPath(import.meta.url) === fs.realpathSync(process.argv[1]))
  )
);

if (isEntry) {
  main().catch(err => {
    process.stderr.write(`[tijori-mcp] Fatal: ${err.message}\n`);
    process.exit(1);
  });
}
