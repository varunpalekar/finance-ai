---
id: "006"
title: "Modular parser decomposition and zero-Cheerio client architecture"
status: "Accepted"
date: 2026-11-10
supersedes: N/A
---

## Context
As the repository expanded to support the Quad-MCP Equity Research Engine across 28+ tools:
1. `src/client/TijoriClient.js` grew to 2,453 lines because it mixed HTTP fetch, cookie session management, and SQLite SWR caching with complex DOM scraping implementations for over 15 distinct HTML page formats.
2. `src/index.js` expanded to 527 lines with inline schema definitions, Zod validation, tool error wrappers, and CLI startup logic for 33 MCP tools.
3. DOM parsing dependencies (Cheerio) were coupled directly into `TijoriClient`, making it difficult to unit-test scraping logic in isolation without mocking full HTTP roundtrips.

## Learning / Decision
1. **Decouple Transport from DOM Scraping**: Extracted all HTML and XML parsing routines into pure, single-responsibility functions in `src/parsers/tijori/`:
   - `screener.js`: query builders, filter field filters, popular query parsers.
   - `financials.js`: tabular statement parsers preserving nested line-item hierarchy.
   - `shareholding.js`: 10-quarter summary and detailed line-item institutional ownership parsers.
   - `valuation.js`: historical daily P/E percentile bands, probabilistic scenario models, and factor benchmarking.
   - `overview.js`: company metadata, timeline, corporate actions, and supply chain notes.
   - `markets.js`: raw materials, macro indicators, sector/conglomerate index tables, and knowledge base document links.
   - `news.js`: Google News RSS XML parser with ISO timestamp normalization.
   - `company.js`: entity resolution, capital allocation fund flows, and constituent listings.
2. **Zero-Cheerio Client**: `TijoriClient.js` now has zero Cheerio imports. It orchestrates HTTP transport, session authentication, and SQLite SWR caching, delegating pure text/JSON response bodies directly to the extracted parsers.
3. **Domain-Scoped Tool Registration**: Modularized `src/index.js` into 8 focused registry modules in `src/tools/` (`company.js`, `financials.js`, `operations.js`, `valuation.js`, `macro.js`, `research.js`, `screener.js`, `perplexity.js`), shrinking `src/index.js` from 527 to 85 lines.
4. **Strict TDD & Zero API Breakage**: Every parser and tool module was developed using Red-Green-Refactor with authentic live fixtures. All 141 test contracts pass with 100% backward compatibility for all MCP tools and public client methods.

## Rejected Alternatives
* Rewriting client methods with new parameter signatures: rejected because backward compatibility with the MCP SDK protocol and external agent callers was an ironclad constraint.
* Keeping tool schemas inlined in `src/index.js` with only handlers extracted: rejected because domain-scoped registration functions allow adding or modifying tools within a single focused domain module without touching server bootstrap code.
