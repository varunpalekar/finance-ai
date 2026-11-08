import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { TijoriClient } from './client/TijoriClient.js';
import { PerplexityClient } from './client/PerplexityClient.js';

// Reserve stdout exclusively for JSON-RPC messages; divert console.log to stderr
console.log = console.error;

const client = new TijoriClient();
const pplxClient = new PerplexityClient();
const server = new McpServer({ name: 'tijori-finance', version: '1.0.0' });

export async function resolveTicker(args, tijoriClient = client, perplexityClient = pplxClient) {
  if (args?.ticker && typeof args.ticker === 'string' && args.ticker.trim()) {
    const rawTicker = args.ticker.trim();
    if (/^\d+$/.test(rawTicker)) {
      const results = await tijoriClient.searchCompany(rawTicker).catch(() => []);
      if (results && results[0]?.slug) {
        const info = await tijoriClient.resolveCompanyIds(results[0].slug).catch(() => null);
        if (info?.symbol) {
          return perplexityClient.normalizeTicker(info.symbol);
        }
      }
    }
    return perplexityClient.normalizeTicker(rawTicker);
  }
  if (args?.slug && typeof args.slug === 'string' && args.slug.trim()) {
    const info = await tijoriClient.resolveCompanyIds(args.slug.trim());
    if (!info?.symbol) {
      throw new Error(`No stock ticker found for slug: ${args.slug}`);
    }
    return perplexityClient.normalizeTicker(info.symbol);
  }
  throw new Error('Either ticker or slug must be provided');
}

function wrap(fn) {
  return async (args) => {
    try {
      const result = await fn(args);
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    } catch (err) {
      return {
        content: [{ type: 'text', text: JSON.stringify({ error: err.code ?? 'ERROR', message: err.message }) }],
        isError: true,
      };
    }
  };
}

// 1. search_company
server.registerTool(
  'search_company',
  {
    description: 'Search Tijori Finance for companies by name. Returns name and slug. Use the slug with all other tools.',
    inputSchema: { query: z.string().min(1) },
  },
  wrap(({ query }) => client.searchCompany(query))
);

// 2. resolve_company_ids
server.registerTool(
  'resolve_company_ids',
  {
    description: 'Resolve a company slug to its numeric company_id. Required before calling get_fund_flow.',
    inputSchema: { slug: z.string() },
  },
  wrap(({ slug }) => client.resolveCompanyIds(slug))
);

// 3. get_company_overview
server.registerTool(
  'get_company_overview',
  {
    description: 'Get company overview: key financial ratios, forensics score, market cap, PE, ROE, ROCE.',
    inputSchema: { slug: z.string() },
  },
  wrap(({ slug }) => client.getCompanyOverview(slug))
);

// 4. get_financials
server.registerTool(
  'get_financials',
  {
    description: 'Get financial statements. type: pl=Profit&Loss, bs=Balance Sheet, cf=Cash Flow, ratios=Financial Ratios, quarterly=Quarterly Results.',
    inputSchema: {
      slug: z.string(),
      type: z.enum(['pl', 'bs', 'cf', 'ratios', 'quarterly']),
    },
  },
  wrap(({ slug, type }) => client.getFinancials(slug, type))
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

// 6. get_operational_metrics
server.registerTool(
  'get_operational_metrics',
  {
    description: 'Get all operational KPIs for a company with latest values and recent trend. Pass the company slug.',
    inputSchema: { slug: z.string() },
  },
  wrap(({ slug }) => client.getOperationalMetrics(slug))
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

// 8. get_raw_materials
server.registerTool(
  'get_raw_materials',
  {
    description: 'Get commodity price performance for Chemicals, Spreads, or Metals.',
    inputSchema: { tab: z.enum(['chemicals', 'spreads', 'metals']) },
  },
  wrap(({ tab }) => client.getRawMaterials(tab))
);

// 9. get_macro_indicators
server.registerTool(
  'get_macro_indicators',
  {
    description: 'Get India macro indicators: industry credit/IIP, demand (GST/auto), or GDP & trade.',
    inputSchema: { tab: z.enum(['industry', 'demand', 'gdp']) },
  },
  wrap(({ tab }) => client.getMacroIndicators(tab))
);

// 10. get_markets
server.registerTool(
  'get_markets',
  {
    description: 'Get index performance: headline (Nifty/Sensex/Nifty Bank etc.), niche (TJI sector indices with 1D–5Y price returns — each row includes tjiid for get_sector_constituents), or conglomerates (9 Indian business groups — each row includes tjiid for get_conglomerate_constituents).',
    inputSchema: {
      tab: z.enum(['headline', 'niche', 'conglomerates']),
    },
  },
  wrap(({ tab }) => client.getMarkets(tab))
);

// 11. get_sector_constituents
server.registerTool(
  'get_sector_constituents',
  {
    description: 'Get all constituent companies of a TJI niche sector index. Pass the tjiid from get_markets({ tab: "niche" }). Returns each company\'s slug (usable with other tools), market-cap weight %, equal weight %, and price returns for 1D/1W/1M/3M/6M/1Y/2Y/3Y/5Y/10Y.',
    inputSchema: {
      tjiid: z.number().int().positive(),
    },
  },
  wrap(({ tjiid }) => client.getNicheConstituents(tjiid))
);

// 12. get_conglomerate_constituents
server.registerTool(
  'get_conglomerate_constituents',
  {
    description: 'Get all constituent companies of a conglomerate group. Pass the tjiid from get_markets({ tab: "conglomerates" }). Returns each company\'s slug (usable with other tools) and price returns for 1D/1W/1M/3M/6M/1Y/2Y/3Y/5Y/10Y. The conglomerates tab itself shows ROE by year; this tool gives the underlying price performance per stock.',
    inputSchema: {
      tjiid: z.number().int().positive(),
    },
  },
  wrap(({ tjiid }) => client.getConglomerateConstituents(tjiid))
);

// 13. get_knowledge_base
server.registerTool(
  'get_knowledge_base',
  {
    description: 'Get all investor documents for a company: annual reports, earnings releases, investor presentations, conference call transcripts, and curated research links. Returns URLs grouped by document type.',
    inputSchema: { slug: z.string() },
  },
  wrap(({ slug }) => client.getKnowledgeBase(slug))
);

// 14. fetch_document
server.registerTool(
  'fetch_document',
  {
    description: 'Fetch and extract text from a Tijori Finance document (PDF). Pass a URL returned by get_knowledge_base. Uses the authenticated session to bypass CDN access controls. Returns the full text content and page count.',
    inputSchema: { url: z.string().url() },
  },
  wrap(({ url }) => client.fetchDocument(url))
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

// 20. clear_cache
server.registerTool(
  'clear_cache',
  {
    description: 'Clear the persistent HTTP cache. Pass an optional company slug to purge cache entries for that stock only, or omit slug to clear the entire cache.',
    inputSchema: {
      slug: z.string().optional(),
    },
  },
  wrap(({ slug }) => {
    client.clearCache(slug);
    return { success: true, message: slug ? `Cleared cache for slug: ${slug}` : 'Cleared all cache entries' };
  })
);

// 21. get_user_info
server.registerTool(
  'get_user_info',
  {
    description: 'Check Tijori authentication status and active subscription tier (e.g. anonymous_guest, free, pro). Use to verify if session token is logged in.',
    inputSchema: {},
  },
  wrap(() => client.getUserInfo())
);

// 22. get_factors_and_benchmarking
server.registerTool(
  'get_factors_and_benchmarking',
  {
    description: 'Get quantitative moat factors, radar benchmarking scores (0-10 vs peer medians), and 57 qualitative formula explanations.',
    inputSchema: { slug: z.string() },
  },
  wrap(({ slug }) => client.getFactorsAndBenchmarking(slug))
);

// 23. get_valuation_bands
server.registerTool(
  'get_valuation_bands',
  {
    description: 'Get statistical valuation bands (1Y, 3Y, 5Y, 10Y P/E percentiles: min, p25, median, p75, max) and peer multiples matrix.',
    inputSchema: { slug: z.string() },
  },
  wrap(({ slug }) => client.getValuationBands(slug))
);

// 24. get_scenario_projections
server.registerTool(
  'get_scenario_projections',
  {
    description: 'Get forward-looking Base, Bear, and Bull probabilistic scenarios with odds, triggers, and 5-year financial forecast models.',
    inputSchema: { slug: z.string() },
  },
  wrap(({ slug }) => client.getScenarioProjections(slug))
);

// 25. get_company_timeline
server.registerTool(
  'get_company_timeline',
  {
    description: 'Get curated company milestones timeline (date, label) and "What to watch" analyst guidance notes.',
    inputSchema: { slug: z.string() },
  },
  wrap(({ slug }) => client.getCompanyTimeline(slug))
);

// 26. get_stock_news
server.registerTool(
  'get_stock_news',
  {
    description: 'Fetch recent real-time financial media headlines from Google News RSS for a ticker, company name, or query.',
    inputSchema: {
      query: z.string().min(1),
      limit: z.number().int().positive().optional(),
      days: z.number().int().positive().optional(),
    },
  },
  wrap(({ query, limit, days }) => client.getStockNews(query, { limit, days }))
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

// 28. get_supply_chain
server.registerTool(
  'get_supply_chain',
  {
    description: 'Get relational products, industries catered, and operational supplier and customer notes from research disclosures.',
    inputSchema: { slug: z.string() },
  },
  wrap(({ slug }) => client.getSupplyChain(slug))
);

// 29. get_price_movement_catalysts (Perplexity Finance)
server.registerTool(
  'get_price_movement_catalysts',
  {
    description: 'Get historical price movement catalysts, causal explanations, and source links from Perplexity Finance. Provide ticker (e.g. HEROMOTOCO.NS, AAPL) or slug (e.g. hero-motocorp-limited).',
    inputSchema: {
      ticker: z.string().optional(),
      slug: z.string().optional(),
      limit: z.number().int().positive().optional(),
      fresh: z.boolean().optional(),
    },
  },
  wrap(async (args) => {
    const ticker = await resolveTicker(args);
    return pplxClient.getPriceMovementCatalysts(ticker, { limit: args.limit, fresh: args.fresh });
  })
);

// 30. get_brokerage_reports (Perplexity Finance)
server.registerTool(
  'get_brokerage_reports',
  {
    description: 'Get institutional brokerage research reports with outlook (bullish/neutral/bearish), 2-sentence summary, and direct PDF download links from Perplexity Finance. Provide ticker or slug.',
    inputSchema: {
      ticker: z.string().optional(),
      slug: z.string().optional(),
      fresh: z.boolean().optional(),
    },
  },
  wrap(async (args) => {
    const ticker = await resolveTicker(args);
    return pplxClient.getBrokerageReports(ticker, { fresh: args.fresh });
  })
);

// 31. get_earnings_intelligence (Perplexity Finance)
server.registerTool(
  'get_earnings_intelligence',
  {
    description: 'Get consensus revenue/EPS surprise, AI earnings call summary highlights, and diarized transcripts from Perplexity Finance. Provide ticker or slug.',
    inputSchema: {
      ticker: z.string().optional(),
      slug: z.string().optional(),
      event_id: z.number().int().optional(),
      include_transcript: z.boolean().optional(),
      chapter_filter: z.enum(['prepared_remarks', 'qa', 'all']).optional(),
      fresh: z.boolean().optional(),
    },
  },
  wrap(async (args) => {
    const ticker = await resolveTicker(args);
    return pplxClient.getEarningsIntelligence(ticker, {
      eventId: args.event_id,
      includeTranscript: args.include_transcript,
      chapterFilter: args.chapter_filter,
      fresh: args.fresh,
    });
  })
);

// 32. get_company_strategic_profile (Perplexity Finance)
server.registerTool(
  'get_company_strategic_profile',
  {
    description: 'Get comprehensive company profile, valuation multiples (PE, Market Cap, 52W High/Low), and strategic business description from Perplexity Finance. Provide ticker or slug.',
    inputSchema: {
      ticker: z.string().optional(),
      slug: z.string().optional(),
      fresh: z.boolean().optional(),
    },
  },
  wrap(async (args) => {
    const ticker = await resolveTicker(args);
    return pplxClient.getCompanyStrategicProfile(ticker, { fresh: args.fresh });
  })
);

// 33. get_curated_news (Perplexity Finance)
server.registerTool(
  'get_curated_news',
  {
    description: 'Get curated publisher news articles and market commentary for a company from Perplexity Finance. Provide ticker or slug.',
    inputSchema: {
      ticker: z.string().optional(),
      slug: z.string().optional(),
      limit: z.number().int().positive().optional(),
      fresh: z.boolean().optional(),
    },
  },
  wrap(async (args) => {
    const ticker = await resolveTicker(args);
    return pplxClient.getCuratedNews(ticker, { limit: args.limit, fresh: args.fresh });
  })
);

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
    process.stderr.write(`[tijori-mcp] Perplexity session active.\n`);
  }

  const transport = new StdioServerTransport();
  await server.connect(transport);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  main().catch(err => {
    process.stderr.write(`[tijori-mcp] Fatal: ${err.message}\n`);
    process.exit(1);
  });
}

