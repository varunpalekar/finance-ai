# Environments & Testing Tracker — Tijori Finance MCP

Status tracking for prerequisites, local execution environments, test suites, and operational dry-runs.

---

## 1. Prerequisites & Environment Matrix

| Prerequisite / Tool | Required Version | Status | Verification Evidence |
| :--- | :--- | :--- | :--- |
| **Node.js** | `>= 24.0.0` (for `node:sqlite` DatabaseSync) | Verified | System v24.19.0 verified |
| **npm** | `>= 9.0.0` | Verified | Standard system binary |
| **Playwright Chromium** | Latest | Verified | CLI interactive auth via `scripts/auth.js` and `scripts/auth-perplexity.js` |
| **Tijori Active Session** | Valid cookies in `output/session.json` | Verified | Verified in `test:live` against live Tijori backend |
| **Perplexity Active Session** | Optional cookies in `output/perplexity_session.json` | Verified | Verified in `test:pplx` against live Perplexity backend |
| **MCP Host Client** | Antigravity / Claude Desktop / Cursor | Verified | Configured in `.mcp.json` |

---

## 2. Test Suites & Regression Benchmarks

| Test Target | Execution Command | Status | Coverage / Focus |
| :--- | :--- | :--- | :--- |
| **Hermetic Unit & Mock Suite** | `npm test` | Verified | 87 offline tests (86 pass, 1 skipped offline) pass in ~1.2s (SQLite WAL cache, SWR fallback, dynamic session reload, Cheerio scrapers, statistical percentiles, PerplexityClient core, in-flight dedup, 5 Perplexity modular parsers grounded in real fixtures, numeric BSE cross-resolution, and 33 MCP tool registrations) |
| **Tijori Live Integration Suite** | `npm run test:live` | Verified | 29 live tests pass in ~9s across all 28 Tijori MCP tools with real data assertions on `tata-steel-limited`, `swaraj-engines-limited`, `bank-of-maharashtra`, and Google News RSS |
| **Perplexity Live Integration Suite** | `npm run test:pplx` | Verified | 16 live tests pass across 7 suites in ~6.5s covering all 5 Perplexity tools, BSE tickers (.BO), numeric BSE scrip code resolution, US tickers with 404 auto-fallback, concall chapters (prepared remarks vs Q&A), and error handling |
| **Tijori Auth & Cookie Capture** | `npm run auth` / `npm run reauth` | Verified | Launches headed Playwright to capture Tijori login session with mode 0600 |
| **Perplexity Auth & Cookie Capture** | `npm run auth:pplx` / `npm run auth:pplx -- --token <val>` / `npm run reauth:pplx` / `npm run status:pplx` / `npm run daemon:pplx` | Verified | Launches anti-detection Chrome to capture Perplexity login session, allows direct `--token` import to bypass Google OAuth blocks, monitors keep-alive daemon, or probes status |
| **Perplexity Live Fixture Capture** | `npm run record:pplx [TICKER]` | Verified | Records authentic REST payloads from live Perplexity Finance endpoints into `test/fixtures/perplexity/` |
