import { z } from 'zod';
import { wrap } from './helpers.js';

export function registerScreenerTools(server, { client }) {
  // 17. list_popular_screens
  server.registerTool(
    'list_popular_screens',
    {
      description: 'List all pre-built popular stock screens on Tijori Finance, grouped by category, with each screen\'s name, description, and underlying query. Run one with screen_companies { preset: "<name>" }.',
      inputSchema: {},
    },
    wrap(() => client.listPopularScreens())
  );

  // 18. screen_companies
  server.registerTool(
    'screen_companies',
    {
      description: "Screen companies by financial metrics and/or business data. Pass 'preset' (a popular screen name from list_popular_screens, e.g. 'Cash Flow Machines'), OR 'filters' and/or 'alternate'. 'filters' accepts a query string like '( ROE > 15 ) and ( Market Capitalization > 500 )' or a shorthand object like {roe:{min:15}, debt_to_equity:{max:0.5}}. Query strings support any field name from search_screener_fields, % values ('ROCE > 20%'), field-vs-field comparisons ('Net Sales > 3Yrs ago Net Sales'), and arithmetic ('capex/Net Block > 0.5'). 'alternate' is a business-data query using relationships: 'makes <product>', 'revenue from <product/region> > N', 'market share > N', 'uses <product>', 'caters to <product>', 'has plant in <region>' — combinable with AND/OR/NOT, e.g. 'market share > 50' or 'revenue from Defence > 50'. Product/region names come from search_screener_fields with type Products/Regions. Optional flags: latest_results_only (only companies that reported the latest quarter), superstar_investors (only companies a superstar/whale investor holds — adds a 'whales' column), sme (search the SME-listed universe instead of mainboard). 'limit' caps returned rows (default 50) and 'offset' pages through the rest (e.g. offset: 50 for rows 51-100 — served from cache, no refetch); total_results always reports the full match count.",
      inputSchema: {
        filters: z.union([
          z.string(),
          z.record(z.object({ min: z.number().optional(), max: z.number().optional() })),
        ]).optional(),
        alternate: z.string().optional(),
        preset: z.string().optional(),
        latest_results_only: z.boolean().optional(),
        superstar_investors: z.boolean().optional(),
        sme: z.boolean().optional(),
        offset: z.number().int().nonnegative().optional(),
        limit: z.number().int().positive().max(500).optional(),
      },
    },
    wrap((args) => client.screenCompanies(args))
  );

  // 19. search_screener_fields
  server.registerTool(
    'search_screener_fields',
    {
      description: "Search Tijori's screener field catalog (~1,500 financial metrics with time-period variants like '3yr Avg ROCE', '5yr Growth Net Sales', '10Yrs ago PAT', plus product segments and regions). Use to find the exact field name before building a screen_companies query. Example: query 'promoter holding' or 'npa'.",
      inputSchema: {
        query: z.string().min(1),
        type: z.enum(['Financials', 'Products', 'Regions']).optional(),
      },
    },
    wrap((args) => client.searchScreenerFields(args))
  );
}
