# Tijori Finance MCP — Claude Code instructions

Unofficial MCP server exposing Tijori Finance (tijorifinance.com, Indian equities) to AI agents via a standalone, zero-browser native HTTP client (`TijoriClient`). **Read `docs/ARCHITECTURE.md` before changing anything non-trivial — it records the API behaviors, traps, and design decisions that were expensive to discover.**

## Hard rules

- **Never write to stdout** in server code (`console.log`, stray prints). stdout *is* the MCP stdio channel; one stray line corrupts the protocol. In `src/index.js`, `console.log = console.error` is bound to protect stdio. Use `process.stderr.write` for diagnostics.
- `pdf-parse` is pinned to v1.1.1 — v2.x broke the function export. Don't bump it.
- API responses embed HTML in JSON keys (`<span>latest</span>Mcap<span>Cr</span>`) — always strip tags from keys before returning (`stripSpans` in `TijoriClient`).
- **Never commit `.env` or session tokens**. Session credentials reside in `output/session.json` (`mode: 0o600`).

## Quick facts

- Session cookie: `output/session.json`. 403 ⇒ tell user to run `npm run auth` (or `npm run reauth`). Client dynamically reloads credentials upon file modification without requiring an MCP server restart.
- Zero-browser runtime: `TijoriClient` uses Node 24+ native `fetch`, Cheerio, and persistent SQLite WAL cache (`~/.cache/tijori/cache.db`).
- Hermetic unit tests: `npm test` (25 offline tests).
- Live integration tests: `npm run test:live` (21 live tests covering all 20 MCP tools).
- Tijori universe: ~5,000 mainboard (server caps the count at 5000) + ~1,050 SME.

## Working style that works here

To understand an undocumented Tijori behavior: write a throwaway `explore_*.js` that drives the real site with `src/browser.js` helpers and captures network calls (or fetch the site's own JS, e.g. `filters.js`, and read it) — then **replicate exactly what the site sends, never guess params** (unknown query params are *silently ignored*, which produces wrong-but-plausible results). Delete exploration scripts after committing findings to `docs/ARCHITECTURE.md`.
