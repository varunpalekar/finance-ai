# Environments & Testing Tracker — Tijori Finance MCP

Status tracking for prerequisites, local execution environments, test suites, and operational dry-runs.

---

## 1. Prerequisites & Environment Matrix

| Prerequisite / Tool | Required Version | Status | Verification Evidence |
| :--- | :--- | :--- | :--- |
| **Node.js** | `>= 24.0.0` (for `node:sqlite` DatabaseSync) | Verified | System v24.19.0 verified |
| **npm** | `>= 9.0.0` | Verified | Standard system binary |
| **Playwright Chromium** | Latest | Verified | CLI interactive auth via `scripts/auth.js` |
| **Tijori Active Session** | Valid cookies in `output/session.json` | Verified | Verified in `test:live` against live Tijori backend |
| **MCP Host Client** | Antigravity / Claude Desktop / Cursor | Verified | Configured in `.mcp.json` |

---

## 2. Test Suites & Regression Benchmarks

| Test Target | Execution Command | Status | Coverage / Focus |
| :--- | :--- | :--- | :--- |
| **Hermetic Unit & Mock Suite** | `npm test` | Verified | 48 offline tests pass in ~1.2s (SQLite WAL cache, SWR 5xx fallback, dynamic session reload, Cheerio scrapers, statistical percentiles, domain TTLs, mock fetch delegates, and authentic browser fixtures) |
| **Live Integration Suite** | `npm run test:live` | Verified | 28 live tests pass in 8.8s across all 28 MCP tools with real data assertions on `tata-steel-limited`, `swaraj-engines-limited`, `bank-of-maharashtra`, and Google News RSS |
| **Auth & Cookie Capture** | `npm run auth` | Verified | Launches headed Playwright to capture login session with mode 0600 |
| **Live Fixture Capture** | `stock-research_agent-browser` MCP server | Verified | Authentic browser session DOM snapshots captured for factors, valuation P/E series, probabilistic scenarios, shareholding line-items, and Google News RSS |
