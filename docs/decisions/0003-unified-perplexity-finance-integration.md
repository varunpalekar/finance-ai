# 0003. Unified Multi-Source Architecture & Perplexity Finance Integration

Date: 2026-11-08
Status: Accepted

## Context
Indian equity fundamental analysis previously relied on statutory statements and sector KPIs via Tijori Finance, basic ratios via Screener, and global market quotes via Yahoo Finance. However, research agents lacked causal explanations for notable daily price swings, access to institutional brokerage research reports (Axis, Motilal Oswal, ICICI Securities), consensus revenue/EPS estimate beat tracking, and diarized earnings call transcripts.

Perplexity Finance (`https://www.perplexity.ai/finance`) exposes non-statutory operational intelligence, institutional broker PDFs, earnings call transcripts, and price catalysts via internal REST endpoints.

## Decision
1. **Approach 1: Unified Multi-Source Server**:
   Instead of spinning up a separate standalone MCP server with independent connection overhead, integrate Perplexity Finance directly into the existing unified MCP server (`src/index.js`), expanding the server from 28 to 33 tools.

2. **PerplexityClient Core Architecture**:
   - Zero browser overhead at MCP runtime: Node.js 24 native `fetch` with browser header spoofing (`User-Agent`, `Sec-Ch-Ua`, `Referer`).
   - In-flight promise deduplication (`this._inFlight = new Map()`) to eliminate redundant parallel network requests across concurrent agent subtasks.
   - Namespaced SQLite caching (`pplx:*`) using WAL mode and `PRAGMA busy_timeout = 5000;`.
   - Domain-specific TTLs (24h for timeline/reports, 7d for earnings track records, 30d for immutable transcripts, 2h for quotes).

3. **5 New Research Tools**:
   - `get_price_movement_catalysts`: Daily causal price movements, narrative drivers, and source citations.
   - `get_brokerage_reports`: Institutional broker research reports with outlook (`bullish`/`neutral`/`bearish`), 2-sentence summary, and direct PDF download links.
   - `get_earnings_intelligence`: Consensus estimates vs actuals (beat %), AI earnings call highlights, and diarized transcript paragraphs.
   - `get_company_strategic_profile`: Quote multiples (PE, Market Cap, 52W High/Low) and long-form strategic business description.
   - `get_curated_news`: Publisher news articles and market commentary.

4. **Dual Ticker / Slug Resolution**:
   All 5 tools accept either `{ ticker?: string, slug?: string }`. If `slug` is provided without `ticker`, `resolveTicker()` queries Tijori's `resolveCompanyIds(slug)` to resolve the stock symbol and normalizes it to Yahoo/Perplexity symbology (`HEROMOTOCO.NS`), ensuring zero friction for calling agents.

5. **Session Governance & Interactive Sign-in**:
   - Headed Chromium interactive login script (`scripts/auth-perplexity.js`) waiting up to 120s for `__Secure-next-auth.session-token`.
   - Session tokens saved to `output/perplexity_session.json` (`0o600`).
   - Dynamic disk reload without server restart on session file update.
   - CLI commands: `npm run auth:pplx`, `npm run reauth:pplx`, `npm run status:pplx`.

6. **Grounding in Real Live Fixtures & Test Coverage**:
   - Authentic payloads captured from `HEROMOTOCO.NS` into `test/fixtures/perplexity/`.
   - 100% offline hermetic unit test coverage across parsers, client core, and MCP tool registration (`npm test`).
   - Dedicated live contract test suite `test/perplexity-live.test.js` (`npm run test:pplx`).

## Alternatives Considered
- **Separate Standalone MCP Server**: Rejected due to multi-server configuration friction for IDE clients, fragmented caching, and inability to seamlessly cross-resolve Tijori slugs to stock tickers.
- **Full Browser Scraping via Playwright at Runtime**: Rejected due to high RAM overhead (300-500MB per instance), slow execution (3-8 seconds vs 50-300ms for REST), and Cloudflare detection risks.

## Consequences
- **Positive**:
  - Research agents gain institutional-grade causal price catalysts, broker reports, consensus surprises, and concall transcripts in a single unified MCP tool registry.
  - Zero browser processes launched during tool execution.
  - SWR and SQLite caching preserve responsiveness and protect against upstream rate limiting.
- **Negative / Trade-offs**:
  - Perplexity internal REST endpoints could change shape in the future, requiring re-running `npm run record:pplx` to detect schema drift.
