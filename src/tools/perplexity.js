import { z } from 'zod';
import { wrap } from './helpers.js';

export async function resolveTicker(args, tijoriClient, perplexityClient) {
  if (args?.ticker && typeof args.ticker === 'string' && args.ticker.trim()) {
    const rawTicker = args.ticker.trim();
    if (/^\d+$/.test(rawTicker)) {
      const results = await tijoriClient.searchCompany(rawTicker).catch(() => []);
      if (results && results[0]?.slug) {
        const info = await tijoriClient.resolveCompanyIds(results[0].slug).catch(() => null);
        if (info?.symbol) {
          return info.symbol.toUpperCase();
        }
      }
    }
    return rawTicker.toUpperCase().endsWith('.US')
      ? rawTicker.toUpperCase()
      : rawTicker.includes('.')
      ? perplexityClient.normalizeTicker(rawTicker)
      : rawTicker.toUpperCase();
  }
  if (args?.slug && typeof args.slug === 'string' && args.slug.trim()) {
    const info = await tijoriClient.resolveCompanyIds(args.slug.trim());
    if (!info?.symbol) {
      throw new Error(`No stock ticker found for slug: ${args.slug}`);
    }
    return info.symbol.toUpperCase();
  }
  throw new Error('Either ticker or slug must be provided');
}

export function registerPerplexityTools(server, { client, pplxClient }) {
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
      const ticker = await resolveTicker(args, client, pplxClient);
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
      const ticker = await resolveTicker(args, client, pplxClient);
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
      const ticker = await resolveTicker(args, client, pplxClient);
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
      const ticker = await resolveTicker(args, client, pplxClient);
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
      const ticker = await resolveTicker(args, client, pplxClient);
      return pplxClient.getCuratedNews(ticker, { limit: args.limit, fresh: args.fresh });
    })
  );
}
