# Features Ledger — Tijori Finance MCP

Living ledger of all capabilities, tool features, and operational requirements.

| Feature ID | Feature Name | Description | Status | Verification Evidence |
| :--- | :--- | :--- | :--- | :--- |
| `FEAT-001` | Entity Search & Slug Resolution | `search_company` and `resolve_company_ids` resolving tickers to slugs | Verified | Pass on `tata-steel-limited`, `swaraj-engines-limited` |
| `FEAT-002` | Overview & 17-Point Forensics | `get_company_overview` returning ratios and 17 accounting flags | Verified | Pass on `tata-steel-limited` |
| `FEAT-003` | Multi-Cycle Financials | `get_financials` for 10Y/10Q P&L, balance sheets, cash flows | Verified | Pass on `tata-steel-limited` |
| `FEAT-004` | 10-Quarter Shareholding | `get_shareholding` returning promoter/FII/DII/retail/pledge trends | Verified | Pass on `tata-steel-limited` |
| `FEAT-005` | 6,000+ Operational KPIs | `get_operational_metrics` returning unit volumes, capacity, and utilization | Verified | Pass on `swaraj-engines-limited` |
| `FEAT-006` | Capital Allocation Fund Flows | `get_fund_flow` returning 1/3/5/7/10Y sources vs. uses of cash | Verified | Pass on `tata-steel-limited` |
| `FEAT-007` | Revenue Mix (Product & Location) | `get_revenue_mix` returning multi-year segment contribution | Verified | Pass on `swaraj-engines-limited` |
| `FEAT-008` | Micro-Segment Market Share % | `get_market_share` returning niche market share % and as-of dates | Verified | Pass on `swaraj-engines-limited` |
| `FEAT-009` | Knowledge Base & Document Text | `get_knowledge_base` and `fetch_document` parsing PDF concalls/filings | Verified | Pass on `tata-steel-limited` |
| `FEAT-010` | Macro & Raw Material Spreads | `get_macro_indicators` and `get_raw_materials` commodity tracking | Verified | Pass on `crude`, `steel` |
| `FEAT-011` | Thematic & Conglomerate Baskets | `get_markets`, `get_niche_constituents`, `get_conglomerate_constituents` | Verified | Pass on `Tata Group`, `Defence` |
| `FEAT-012` | Natural Language Stock Screening| `screen_companies`, `list_popular_screens`, `search_screener_fields` | Verified | Pass on popular screens |
| `FEAT-013` | Playwright Session Vault | `scripts/auth.js` (`npm run auth`) and `output/session.json` cookie lifecycle (mode 0600) | Verified | Passes session validation in `test/auth-script.test.js` |
| `FEAT-014` | Zero-Browser Standalone TijoriClient | Pure Node 24+ fetch + Cheerio client, SQLite WAL cache (`~/.cache/tijori/cache.db`), offline SWR fallback, clear_cache tool | Verified | 25 unit tests pass offline in `npm test`, 21 live tests in `npm run test:live` |
| `FEAT-015` | SWR 5xx Resilience & Dynamic Session Reload | 5xx status fallback to stale SQLite cache, dynamic session reload on `session.json` mtime update without server restart, SSRF & CDN auth forwarding | Verified | Verified in `test/client-rest.test.js`, `test/auth-script.test.js`, and `test/client-metrics-docs.test.js` |
