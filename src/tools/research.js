import { z } from 'zod';
import { wrap } from './helpers.js';

export function registerResearchTools(server, { client }) {
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
}
