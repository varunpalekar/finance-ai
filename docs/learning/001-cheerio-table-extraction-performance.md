---
id: "001"
title: "Cheerio and Native Fetch Outperforms Runtime Browser Automation for Tijori Finance"
status: "Accepted"
date: 2026-11-07
supersedes: N/A
---

## Context
Tijori Finance serves financial statements, shareholding tables, and corporate ratios as server-side rendered (SSR) HTML with DataTables formatting, and exposes internal REST endpoints for operational metrics, screener queries, and group constituent prices. Running a full Chromium instance via Playwright inside an MCP process incurred multi-second latency, random timeouts waiting for DOM selectors, and heavy memory usage.

## Learning / Decision
1. Always inspect target web applications for SSR HTML and internal REST APIs before defaulting to headless browser automation.
2. In Node 24+, combine native `fetch` with `cheerio` and native `node:sqlite` (`DatabaseSync` with WAL mode).
3. Treat company IDs and parsed PDF documents as immutable, caching them with `expires_at = NULL`.
4. Implement offline-first SWR fallback so that network disruptions fall back to cached records with `is_stale: true` rather than failing outright.
5. Isolate Playwright strictly to CLI authentication (`scripts/auth.js`) where user-interactive login is mandatory.

## Rejected Alternatives
* Running headless Playwright at runtime with request interception: Rejected due to 300MB+ memory footprint and multi-second boot latency.
* In-memory cache with node-cache: Rejected because memory caches do not persist across MCP server reboots and fail under multi-agent processes.
