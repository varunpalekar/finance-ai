# Environments & Testing Tracker — Tijori Finance MCP

Status tracking for prerequisites, local execution environments, test suites, and operational dry-runs.

---

## 1. Prerequisites & Environment Matrix

| Prerequisite / Tool | Required Version | Status | Verification Evidence |
| :--- | :--- | :--- | :--- |
| **Node.js** | `>= 18.0.0` | Verified | System v20+ installed |
| **npm** | `>= 9.0.0` | Verified | Standard system binary |
| **Playwright Chromium** | Latest | Planned | Requires `npx playwright install` |
| **Tijori Active Session** | Valid cookies in `output/session.json` | Planned | Requires running `npm run auth` |
| **MCP Host Client** | Antigravity / Claude Desktop / Cursor | Verified | Configured in `.mcp.json` |

---

## 2. Test Suites & Regression Benchmarks

| Test Target | Execution Command | Status | Coverage / Focus |
| :--- | :--- | :--- | :--- |
| **Unit & Parser Suite** | `npm test` | Verified | Tests Cheerio and regex DOM extractors |
| **Auth & Cookie Injection** | `npm run auth` | Planned | Launches Playwright to capture login session |
| **Benchmark: Swaraj Engines** | `node test/test-company.js swaraj-engines-limited` | Planned | Validates operational KPIs & single-segment mix |
| **Benchmark: Tata Steel** | `node test/test-company.js tata-steel-limited` | Planned | Validates multi-geography mix & commodity links |
