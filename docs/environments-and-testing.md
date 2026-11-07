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
| **Hermetic Unit & Mock Suite** | `npm test` | Verified | 25 offline tests (SQLite WAL cache, SWR 5xx fallback, dynamic session reload, Cheerio scrapers, REST methods, MCP delegation) |
| **Live Integration Suite** | `npm run test:live` | Verified | 21 live tests pass in 3.5s across all 20 MCP tools with real data assertions (`tata-steel-limited`, `swaraj-engines-limited`) |
| **Auth & Cookie Capture** | `npm run auth` | Verified | Launches headed Playwright to capture login session with mode 0600 |
