# 0002. Expanded Research Tools & Two-Tier Live Data TDD Protocol

Date: 2026-11-08
Status: Accepted

## Context
While the base Tijori Finance MCP server successfully provided statutory financials, ratios, and basic operational metrics, autonomous equity research workflows suffered from blind spots in competitive moat benchmarking, valuation percentile bands, probabilistic scenario modeling, forward guidance, corporate actions history, and real-time financial media news. Moreover, financial scraping parsers frequently suffer from fragile DOM selection when built against synthetic mocks.

## Decision
1. **7 New Research Tools & 1 Enhanced Tool**:
   - `get_factors_and_benchmarking`: Parses 0-10 radar moat scores against peer medians and 57 qualitative formula explanations.
   - `get_valuation_bands`: Computes 1Y, 3Y, 5Y, and 10Y continuous percentile bands (`min`, `p25`, `median`, `p75`, `max`) from daily historical P/E series, filtering out negative loss-making days, combined with a peer multiples matrix.
   - `get_scenario_projections`: Extracts forward-looking Base, Bear, and Bull probabilistic scenarios with odds, triggers, and 5-year forward financial forecast models.
   - `get_company_timeline`: Extracts chronological corporate milestones (`key_events`) and "What to watch" analyst monitorables.
   - `get_stock_news`: Queries and cleans Google News RSS headlines, extracting sources, ISO timestamps, and URLs.
   - `get_corporate_actions`: Extracts historical dividends, bonus issues, stock splits, and rights offerings.
   - `get_supply_chain`: Maps relational products, industries catered, and operational customer/supplier monitorables.
   - Enhanced `get_shareholding({ detailed: true })`: Parses line-item institutional fund holdings (LIC, Mutual Funds) and retail investor tiers (`< 2 lac`, `> 2 lac`).
2. **Two-Tier Live Data TDD Protocol**:
   - Tier 1: Authentic live DOM and JSON payloads captured from benchmark stocks (`bank-of-maharashtra`, `swaraj-engines-limited`) and Google News using the `stock-research_agent-browser` MCP server into `test/fixtures/` for hermetic unit testing (`npm test`).
   - Tier 2: Real endpoint integration test assertions in `test/live.test.js` (`npm run test:live`) ensuring end-to-end network compatibility.
3. **Smart Domain TTL Cache**:
   - Each domain adheres to an explicit TTL matrix in `src/cache.js` (e.g. 7 days for factors, scenarios, actions, supply chain; 12 hours for valuation bands; 24 hours for timeline; 1 hour for news) with full SWR offline fallback.
4. **Isolated Cache Keys**:
   - `detailed: false` vs `detailed: true` shareholding queries are cleanly isolated (`shareholding:${slug}` vs `shareholding_detailed:${slug}`) to prevent cache collision.

## Consequences
- **Positive**:
  - Provides institutional research agents with quantitative moat factors, historical valuation multiples, and forward projections.
  - Zero browser processes launched at runtime; execution remains fast (<50-200ms) with SQLite caching.
  - Test suite grounded in real, authentic production data prevents brittle mock rot.
- **Negative / Trade-offs**:
  - Google News RSS depends on external Google network availability, but is safeguarded by timeouts, rate-limiting, and error-resilient fallbacks.
