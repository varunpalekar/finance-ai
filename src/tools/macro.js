import { z } from 'zod';
import { wrap } from './helpers.js';

export function registerMacroTools(server, { client }) {
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
}
