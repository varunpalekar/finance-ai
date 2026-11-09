# Quad-MCP Equity Research Engine — Agent Instructions

Enterprise-grade equity research platform and autonomous multi-agent research engine for AI agents (Antigravity, Claude Code, Cursor, OpenCode), integrating Tijori Finance (28 tools), Perplexity Finance, Screener.in, Yahoo Finance, and Agent Browser. **Read `docs/ARCHITECTURE.md` before changing anything non-trivial — it records the API behaviors, traps, and design decisions.**

## Hard rules

- **Never write to stdout** in server code (`console.log`, stray prints). stdout *is* the MCP stdio channel; one stray line corrupts the protocol. In `src/index.js`, `console.log = console.error` is bound to protect stdio. Use `process.stderr.write` for diagnostics.
- `pdf-parse` is pinned to v1.1.1 — v2.x broke the function export. Don't bump it.
- API responses embed HTML in JSON keys (`<span>latest</span>Mcap<span>Cr</span>`) — always strip tags from keys before returning (`stripSpans` in `TijoriClient`).
- **Never commit `.env`, session tokens, or machine-specific paths**. Session credentials reside in `output/session.json` and `output/perplexity_session.json` (`mode: 0o600`).
- **Fail-closed evidence validation**: All equity claims in research dossiers must be grounded in primary tool outputs or flagged as assumptions.

## Quick facts

- Sessions: `output/session.json` (Tijori) and `output/perplexity_session.json` (Perplexity). 401/403 ⇒ tell user to run `npm run auth` or `npm run auth:pplx`. Clients dynamically reload credentials without server restart.
- Zero-browser runtime: `TijoriClient` and `PerplexityClient` use Node 24+ native `fetch`, Cheerio, and persistent SQLite WAL cache (`~/.cache/tijori/cache.db`).
- Hermetic unit & parser tests: `npm test` (114 offline tests across parsers, SWR caching, and executor contracts).
- Live integration tests: `npm run test:live` (Tijori live contract suite) and `npm run test:pplx` (Perplexity live contract suite).
- Quad-MCP plugin configuration: `.agents/plugins/stock-research/mcp_config.json`.
- Research execution: Orchestrated via `.agents/skills/stock-research-executor/SKILL.md` (8-phase due diligence).

## Working style that works here

To investigate or replicate API endpoints: check recorded fixtures in `test/fixtures/`, run single targeted tests with `node --test test/<name>.test.js`, or drive live diagnostics using `scripts/auth.js` or `scripts/auth-perplexity.js`. Never guess parameters — replicate exact query parameters and headers.
