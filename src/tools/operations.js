import { z } from 'zod';
import { wrap } from './helpers.js';

export function registerOperationsTools(server, { client }) {
  // 6. get_operational_metrics
  server.registerTool(
    'get_operational_metrics',
    {
      description: 'Get all operational KPIs for a company with latest values and recent trend. Pass the company slug.',
      inputSchema: { slug: z.string() },
    },
    wrap(({ slug }) => client.getOperationalMetrics(slug))
  );

  // 15. get_revenue_mix
  server.registerTool(
    'get_revenue_mix',
    {
      description: 'Get revenue/segment mix breakdowns for a company. Returns latest % breakdown and full historical trend per segment.',
      inputSchema: { slug: z.string() },
    },
    wrap(({ slug }) => client.getRevenueMix(slug))
  );

  // 16. get_market_share
  server.registerTool(
    'get_market_share',
    {
      description: 'Get all market share metrics for a company (e.g. Bank Advances, Credit Cards, Housing Loans). Returns latest % value and as-of date for each metric.',
      inputSchema: { slug: z.string() },
    },
    wrap(({ slug }) => client.getMarketShare(slug))
  );

  // 28. get_supply_chain
  server.registerTool(
    'get_supply_chain',
    {
      description: 'Get relational products, industries catered, and operational supplier and customer notes from research disclosures.',
      inputSchema: { slug: z.string() },
    },
    wrap(({ slug }) => client.getSupplyChain(slug))
  );
}
