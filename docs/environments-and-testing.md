# Environments & Testing Tracker — Tijori Finance MCP

Status tracking for prerequisites, local execution environments, test suites, and operational dry-runs.

---

## 1. Prerequisites & Environment Matrix

| Prerequisite / Tool | Required Version | Status | Verification Evidence |
| :--- | :--- | :--- | :--- |
| **Node.js** | `>= 24.0.0` (for `node:sqlite` DatabaseSync) | Verified | System v24.19.0 verified |
| **npm** | `>= 9.0.0` | Verified | Standard system binary |
| **Playwright Chromium** | Latest | Verified | CLI interactive auth via `scripts/auth.js` |
| **Tijori Active Session** | Valid cookies in `output/session.json` | Planned | Requires running `npm run auth` |
| **MCP Host Client** | Antigravity / Claude Desktop / Cursor | Verified | Configured in `.mcp.json` |

---

## 2. Test Suites & Regression Benchmarks

| Test Target | Execution Command | Status | Coverage / Focus |
| :--- | :--- | :--- | :--- |
| **Hermetic Unit & Mock Suite** | `npm test` | Verified | 20 offline tests (SQLite WAL cache, SWR fallback, Cheerio scrapers, REST methods, MCP delegation) |
| **Live Integration Suite** | `npm run test:live` | Verified | End-to-end verification across benchmark companies (`tata-steel-limited`, `swaraj-engines-limited`), gracefully skips when session is missing |
| **Auth & Cookie Capture** | `npm run auth` | Verified | Launches headed Playwright to capture login session with mode 0600 |
