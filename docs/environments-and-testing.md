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
| **Unit, Mock & Conditional Live Suite** | `npm test` | Verified | 161/161 passed on 2026-11-09. Includes offline fixtures and live contracts when network/session access is available; conditional live suites may skip on provider preflight failures. |
| **Live Provider Preflight Contracts** | `node --test test/live-preflight.test.js` | Verified | 4/4 passed. HTTP and network failures are reported; explicit `npm run test:live` and `npm run test:pplx` runs fail instead of silently skipping. |
| **Tijori Live Integration Suite** | `npm run test:live` | Verified | 31/31 passed with no skips on 2026-11-09. Covers all 28 Tijori MCP tools, source reporting basis, nested financial rows, finite/bounded metrics, and `get_user_info`. |
| **Perplexity Live Integration Suite** | `npm run test:pplx` | Verified | 17/17 passed with no skips on 2026-11-09. Covers all 5 Perplexity tools, source-derived earnings arithmetic, quote freshness/source comparison, USD/INR units, transcript chapter bounds, BSE resolution, and bare/`.US` CRM earnings. |
| **Tijori Auth & Cookie Capture** | `npm run auth` / `npm run reauth` | Verified | Launches headed Playwright to capture Tijori login session with mode 0600 |
| **Perplexity Auth & Cookie Capture** | `npm run auth:pplx` / `npm run auth:pplx -- --token <val>` / `npm run reauth:pplx` / `npm run status:pplx` / `npm run daemon:pplx` | Verified | Launches anti-detection Chrome to capture Perplexity login session, allows direct `--token` import to bypass Google OAuth blocks, monitors keep-alive daemon, or probes status |
| **Perplexity Live Fixture Capture** | `npm run record:pplx [TICKER]` | Verified | Records authentic REST payloads from live Perplexity Finance endpoints into `test/fixtures/perplexity/` |
