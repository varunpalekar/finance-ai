import { z } from 'zod';
import { wrap } from './helpers.js';

export function registerFinancialsTools(server, { client }) {
  // 4. get_financials
  server.registerTool(
    'get_financials',
    {
      description: 'Get financial statements. type: pl=Profit&Loss, bs=Balance Sheet, cf=Cash Flow, ratios=Financial Ratios, quarterly=Quarterly Results.',
      inputSchema: {
        slug: z.string(),
        type: z.enum(['pl', 'bs', 'cf', 'ratios', 'quarterly']),
        basis: z.enum(['consolidated', 'standalone']).optional(),
      },
    },
    wrap(({ slug, type, basis }) => client.getFinancials(slug, type, { basis }))
  );

  // 5. get_shareholding
  server.registerTool(
    'get_shareholding',
    {
      description: 'Get 10-quarter shareholding breakdown: promoter %, FII %, DII %, public %. Set detailed: true for line-item mutual funds, LIC, and retail tiers.',
      inputSchema: {
        slug: z.string(),
        detailed: z.boolean().optional(),
      },
    },
    wrap(({ slug, detailed }) => client.getShareholding(slug, { detailed }))
  );

  // 7. get_fund_flow
  server.registerTool(
    'get_fund_flow',
    {
      description: 'Get capital allocation (fund flow) breakdown over 1, 3, 5, 7, or 10 years. Run resolve_company_ids first.',
      inputSchema: {
        company_id: z.number().int().positive(),
        years: z.union([
          z.literal(1),
          z.literal(3),
          z.literal(5),
          z.literal(7),
          z.literal(10),
        ]),
      },
    },
    wrap(({ company_id, years }) => client.getFundFlow(company_id, years))
  );

  // 27. get_corporate_actions
  server.registerTool(
    'get_corporate_actions',
    {
      description: 'Get historical dividends, bonus issues, stock splits, and rights offerings with ex-dates and details.',
      inputSchema: { slug: z.string() },
    },
    wrap(({ slug }) => client.getCorporateActions(slug))
  );
}
