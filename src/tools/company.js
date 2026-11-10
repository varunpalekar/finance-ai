import { z } from 'zod';
import { wrap } from './helpers.js';

export function registerCompanyTools(server, { client }) {
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

  // 20. clear_cache
  server.registerTool(
    'clear_cache',
    {
      description: 'Clear the persistent HTTP cache. Pass an optional company slug to purge cache entries for that stock only, or omit slug to clear the entire cache.',
      inputSchema: {
        slug: z.string().optional(),
      },
    },
    wrap(async ({ slug }) => {
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
}
