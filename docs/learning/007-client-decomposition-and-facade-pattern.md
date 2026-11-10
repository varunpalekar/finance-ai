---
id: "007"
title: "TijoriClient decomposition and facade pattern refactoring"
status: "Accepted"
date: 2026-11-10
supersedes: N/A
---

## Context
Following the extraction of DOM scrapers into `src/parsers/tijori/` (`FEAT-034`), `src/client/TijoriClient.js` was still 1,326 lines long. It suffered from multiple architectural responsibilities:
1. **Divergent Change in Screener Logic**: Inlined query construction, field search caching, REST/HTML popular query fallback, and results pagination (~230 lines).
2. **Single Responsibility Violation in Document Fetching**: Direct coupling to `pdf-parse`, `createRequire`, console stream silencing, and binary array buffer parsing (~80 lines).
3. **Session Management Coupled to HTTP Client**: Dynamic session file mtime polling, cookie header/CSRF token parsing, guest session live probing, and regex HTML scraping for user profiles (~130 lines).
4. **Duplicate Scraper Boilerplate**: Identical caching, overview HTML fetching, stale fallback handling, and parser execution across `getCompanyTimeline`, `getCorporateActions`, and `getSupplyChain`.

## Learning / Decision
1. **Façade Pattern with Full Backward Compatibility**:
   - `TijoriClient` remains the single public client interface, preserving all 32+ methods, argument signatures, and return shapes.
   - Instance properties accessed directly by test suites (`client._session`, `client._sessionMtime`, `client.sessionPath`, `client.baseUrl`, `client.cacheEnabled`, `client.fetchFn`) are maintained with bidirectional synchronization via ES6 getters and setters.
2. **Dedicated Subsystem Extraction**:
   - `TijoriDocumentFetcher.js` encapsulates PDF binary download, SSRF hostname boundary checks (`files.tijorifinance.com`), and `pdf-parse` execution with TT font warning suppression.
   - `TijoriScreener.js` encapsulates screener API execution (`screenCompanies`, `searchScreenerFields`, `listPopularScreens`, `_runScreenerApi`, and `paginate`).
   - `SessionManager.js` encapsulates filesystem session discovery, mtime reload checking, cookie/CSRF parsing, live `/alerts/` authentication probing, and `/account/subscription/` profile extraction.
3. **Overview Scraper Boilerplate Consolidation**:
   - Created `_getOverviewParsed(slug, cacheKey, ttl, parser, { fresh })` inside `TijoriClient`, eliminating duplicate code across `getCompanyTimeline`, `getCorporateActions`, and `getSupplyChain`.
4. **Strict TDD & Codebase Health**:
   - Executed strictly following the Test-Driven Development Iron Law (failing test -> verify failure -> minimal code -> verify pass -> refactor).
   - Created 3 new unit test suites: `test/document-fetcher.test.js`, `test/screener-service.test.js`, and `test/session-manager.test.js`.
   - All 146 tests across 7 test suites pass in `npm test`.

## Rejected Alternatives
* Breaking internal properties (`_session`, `_sessionMtime`) or moving them exclusively to `SessionManager`: rejected because existing tests directly mutate `client._session` to test edge cases without modifying filesystem session fixtures.
* Merging `TijoriScreener` and `TijoriDocumentFetcher` into a single helper: rejected because screener query logic and PDF stream parsing have completely different dependencies, lifecycle, and failure domains.
