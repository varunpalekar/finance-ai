# 0001. Zero-Browser Runtime TijoriClient

Date: 2026-11-07
Status: Accepted

## Context
The Tijori Finance MCP server originally depended on runtime browser automation via Playwright/Chromium for all tool executions. This created significant latency (>3-8 seconds per query), excessive memory and CPU overhead (~300MB+ per browser context), fragile DOM waiting, and concurrency race conditions under multi-tool agent workloads.

## Decision
1. Eliminate runtime Playwright and Chromium automation entirely.
2. Implement `TijoriClient` using native Node 24+ `fetch` and `cheerio` for internal REST APIs and SSR tables.
3. Restrict Playwright exclusively to a one-time interactive login gateway CLI script (`scripts/auth.js` via `npm run auth`) storing verified session cookies in `output/session.json` with `mode: 0o600`.
4. Implement a persistent SQLite cache at user-level (`~/.cache/tijori/cache.db`, dir `mode: 0o700`) using native `node:sqlite` (`DatabaseSync`) configured with WAL mode (`PRAGMA journal_mode = WAL; PRAGMA synchronous = NORMAL;`) and an indexed `slug TEXT` column (`idx_cache_slug`).
5. Employ an Offline-First Stale-While-Revalidate (SWR) policy ("Keep Until Replaced"): expired cache entries are never auto-deleted. When network connectivity fails, stale cached data is returned with `_cache_meta.is_stale: true`.
6. Permanent caching (`expires_at = NULL`) for immutable data (annual reports/concalls and company slug-to-ID mappings).
7. Expose a 20th MCP tool `clear_cache({ slug?: string })` providing $O(1)$ selective company purging without full-table LIKE scans.

## Consequences
- **Positive**:
  - Response latencies drop from ~3-8s to 50-200ms.
  - Zero browser process overhead at runtime.
  - Offline resilience allowing continuous local research without internet connection for previously accessed stocks.
  - 100% hermetic unit testing without session or browser requirements.
- **Negative / Trade-offs**:
  - Requires Node.js >= 24.0.0 for `node:sqlite` and native `fetch`.
  - Initial setup still requires a manual headed login once via `npm run auth`.
