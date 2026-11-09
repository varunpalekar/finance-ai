# Stock Research Executor - Instructions

## Purpose

This document provides detailed instructions for executing the 8-phase investment due diligence process. It expands on the core SKILL.md with specific guidance, workflows, and best practices.

## Prerequisites

Before using this skill, you should have:

1. **A structured research prompt** from `stock-question-refiner`
   - Contains: Stock ticker, investment style, time horizon, research scope, output requirements
   - If missing, invoke `stock-question-refiner` first

2. **Clear understanding of constraints**
   - Investment parameters (style, risk tolerance, priorities)
   - Data sources to use (and avoid)
   - Output format and structure

3. **Permission to use required tools**
   - Task (for deploying research agents)
   - WebSearch, WebFetch (for research)
   - Read, Write (for generating reports)
   - TodoWrite (for tracking progress)

## Research Execution Framework

### Overview: The 8-Phase Process & 9-Step Evidence-Grounded Workflow

```
┌─────────────────────────────────────────────────────────────┐
│              Stock Research Execution Framework              │
└─────────────────────────────────────────────────────────────┘

Input: Structured Research Prompt (from stock-question-refiner)
         │
         ▼
┌─────────────────────────────────────────────────────────────┐
│  Step 0: Temporal Anchor & Dual-MCP Grounding (MANDATORY)   │
│  - Establish current calendar date and active fiscal year    │
│  - Query screener-mcp (BSE/NSE) / yfinance-mcp (Global)     │
│  - Lock currency & unit denomination (₹ Crores / $ Millions) │
│  - Declare [CONSOLIDATED] primary vs [STANDALONE] parent     │
│  - Create immutable Financial_Data/ground_truth.json        │
└─────────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────┐
│  Step 1: Verify and Understand Prompt                        │
│  - Check completeness (Ticker, ISIN, Exchange, Style, Scope) │
│  - Resolve entities and clarify missing constraints          │
└─────────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────┐
│  Step 2: Create Research Execution Plan & Ground Truth Inject│
│  - Prioritize phases based on user constraints               │
│  - Design 7 parallel batches (4 subagents per phase)         │
│  - Explicitly inject Ground Truth into all subagent prompts  │
└─────────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────┐
│  Step 3: Deploy Multi-Agent Research (Phases 1-7)            │
│  For each phase:                                             │
│    1. Launch 4 agents in PARALLEL (single message)           │
│    2. Deploy Type A (Qualitative) or Type B (Quantitative)   │
│    3. Enforce MCP-only data for financial metrics            │
└─────────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────┐
│  Step 4: Algebraic & Mathematical Verification Gate          │
│  - Audit 7 balancing invariants (EBITDA, PBT, PAT, Segments, │
│    Shareholding sum 100%, Market Cap, Enterprise Value)     │
└─────────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────┐
│  Step 5: Generate Standardized Phase Reports (01_ to 07_)    │
│  - Structured markdown files with source citations rated A-E │
└─────────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────┐
│  Step 6: Financial Quality Assurance & Math Audit (FQA)      │
│  - 8-Point institutional audit gate                          │
│  - Multi-period cash flow and working-capital analysis        │
└─────────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────┐
│  Step 7: Generate Final Synthesis Report                     │
│  - Reconcile 00_Executive_Summary.md with Phase 4 & Phase 7  │
│  - Evidence-based view, assumptions, and unresolved gaps      │
│  - Master navigation index (README.md)                       │
└─────────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────┐
│  Step 8: Citation Verification & Source Grading              │
│  - Verify Grade A (filings) and Grade B (IR disclosures)     │
└─────────────────────────────────────────────────────────────┘
         │
         ▼
Output: Complete Institutional Investment Due Diligence Dossier
        (in RESEARCH/STOCK_[ticker]_[company]/)
```

---

## Step 0: Temporal Anchor & Quad-MCP Grounding

Before planning research, the lead agent records the current date and grounds each reported value in a source. No process can guarantee zero errors; preserve uncertainty, stale-data flags, and missing values.

1. **Temporal Anchor ($T_0$) & Calendar Binding**:
   - Determine and record the exact system calendar date (e.g., `2026-11-09`).
   - Identify the active corporate fiscal year (e.g., `FY27`, April 1, 2026 – March 31, 2027 for Indian equities; calendar year for US equities).
   - Identify the current reporting quarter (e.g., Q2 FY27).

2. **Execute Quad-MCP Grounding & Multi-Key Lock**:
   - Mandate an immediate entity resolution establishing and locking all three primary keys:
     - `ticker`: Full exchange symbol (e.g. `HEROMOTOCO.NS` or `NVDA`)
     - `symbol`: Bare trading code (e.g. `HEROMOTOCO`)
     - `slug`: Standardized Tijori/web slug (e.g. `hero-motocorp-limited`)
   - **For Indian Equities (NSE/BSE)**:
     - Query **Tijori MCP** (`mcp__tijori-finance__*`):
       - `search_company(query="<ticker>")` & `resolve_company_ids(slug="<slug>")`: Lock `company_id`, ticker, and slug.
       - `get_company_overview(slug="<slug>")`: Extract valuation multiples, return ratios, forensic checklist, and both `mcap_crores` and `mcap_inr`.
       - `get_valuation_bands(slug="<slug>")`: Extract daily P/E percentile bands and the latest observation date.
       - `get_factors_and_benchmarking(slug="<slug>")`: Extract returned factor axes and peer scores; do not infer an aggregate score.
       - `get_scenario_projections(slug="<slug>")`: Check for verified, company-specific conditional scenarios. Treat source weights as assumptions, not calibrated odds.
     - Query **Perplexity Finance Tools** (`mcp__tijori-finance__*`):
       - `get_company_strategic_profile(ticker="<ticker>")`: Extract strategic business profile, consensus valuation multiples, and verify CMP.
       - `get_earnings_intelligence(ticker="<ticker>")`: Extract consensus revenue/EPS beat history and latest quarter surprise %.
     - Query **Screener MCP** (`stock-research_screener` / `screener-mcp`):
       - `get_quarterly_results(symbol="<symbol>")`: Verify latest filed statutory quarter and date of board approval.
       - `get_financials(symbol="<symbol>", basis="consolidated")`: Cross-validate statutory statements on the selected reporting basis.
       - `get_shareholding_pattern(symbol="<symbol>")`: Cross-validate latest quarter promoter, FII, DII holding and promoter pledge %.
     - Query **Yahoo Finance MCP** (`stock-research_yfinance` / `yfinance-mcp`):
       - `yfinance_get_ticker_info(symbol="<ticker>")`: Cross-validate real-time CMP, Market Cap, 52-week High/Low, Beta, Shares Outstanding.
   - **For US / Global Equities (NASDAQ, NYSE, HKEX)**:
     - Bypass Indian-only Tijori tools. Query Perplexity Finance (`get_company_strategic_profile`, `get_price_movement_catalysts`) + Yahoo Finance (`yfinance_get_ticker_info`, `yfinance_get_financials`, `yfinance_get_analyst_estimates`, `yfinance_get_price_history`) + SEC EDGAR via `mcp__web_reader__webReader`.

3. **Preserve Currency & Units**:
   - Record the source currency, unit, scale, and observation date for every value. Convert only when the source denomination is known and the conversion is explicit.
   - Indian figures may be displayed in INR and Crores when source metadata supports that conversion. Global figures retain their source currency.
   - Unknown currency, unit, or scale stays null/unknown. Never infer it from a ticker or neighboring field.

4. **Declare Accounting & Reporting Boundary**:
   - Explicitly declare whether primary analysis is **`[CONSOLIDATED]`** or **`[STANDALONE]`**.
   - If operating subsidiaries contribute $\ge 5\%$ of revenue or debt, Consolidated is mandatory for business quality, financial health, and valuation. Standalone parent figures are provided in parallel for parent-level dividend and debt coverage.

5. **Strictly Segregate Actuals from Forecasts**:
   - Statutory historical filings MUST be labeled **`[REPORTED / FILED]`**.
   - Forward run-rates, consensus models, and DCF outputs MUST be labeled **`[PROJECTED / ESTIMATE]`**, with source, as-of date, and assumptions.
   - Scenario weights supplied by a source are assumptions, not calibrated probabilities. Never invent weights or expected returns.

6. **Generate Central Ground Truth Table (`Financial_Data/ground_truth.json`)**:
   - The Lead Agent saves a central ground truth file with source, timestamp, currency, unit, reporting basis, and freshness metadata per value.
   - Keep verified observations immutable; append corrections with provenance rather than silently overwriting them. Unknown fields stay null.
```json
{
  "ticker": null,
  "symbol": null,
  "slug": null,
  "latest_filed_quarter": null,
  "observations": [
    {
      "name": null,
      "value": null,
      "source": null,
      "source_timestamp": null,
      "cache_is_stale": null,
      "reporting_basis": null,
      "currency": null,
      "denomination": null
    }
  ]
}
```

Populate a field only from a matching source response. Store per-field provenance in the research record; this schema contains no example investment data.

---

## Step 1: Verify and Understand the Structured Prompt

### Checklist: Prompt Completeness

Before proceeding, verify the structured prompt contains:

**Basic Information**:
- [ ] Stock ticker/code (e.g., 600519.SH, NVDA, 03333.HK)
- [ ] Company full name
- [ ] Market (A-share / Hong Kong / US)

**Investment Parameters**:
- [ ] Investment style (value/growth/turnaround/dividend)
- [ ] Holding period (short/medium/long)
- [ ] Risk tolerance (conservative/balanced/aggressive)

**Research Scope**:
- [ ] All 8 phases listed
- [ ] Priority phases identified (2-3 phases for deep dive)
- [ ] Phases that can be streamlined noted

**Output Requirements**:
- [ ] Report format specified (executive summary, full report, tables)
- [ ] Valuation methods specified
- [ ] Special requirements noted (language, timeframe, geography)

**Research Constraints**:
- [ ] Data sources prioritized
- [ ] Mandatory verification requirements listed
- [ ] "What NOT to do" section clear

### If Incomplete: Ask User

Don't make assumptions. Ask targeted questions:

```
I've received your research request, but I need clarification on [specific missing item].

For example:
- "You mentioned value investing, but didn't specify which phases are most important.
  Should I prioritize business quality, governance, and valuation?"
- "You didn't specify a timeframe. Should I analyze the past 3 years, 5 years, or 10 years?"

Please clarify so I can tailor the research appropriately.
```

### If Complete: Proceed to Planning

Acknowledge receipt and summarize understanding:

```
I've received your structured research request. Let me confirm my understanding:

**Target**: [ticker] [company name]
**Approach**: [investment style], [holding period], [risk tolerance]
**Priority Phases**: [list priority phases]
**Output**: [describe report structure]

I'll now create a detailed research execution plan. One moment...
```

---

## Step 2: Create Research Execution Plan

### Plan Template

```markdown
## Research Execution Plan

### Research Target
**Stock**: [ticker] [company name]
**Market**: [A-share/HK/US]
**Industry**: [sector/classification]

### Investment Parameters
**Style**: [value/growth/turnaround/dividend]
- Implications: [what this means for research focus]

**Holding Period**: [short/medium/long]
- Time horizon: [specific timeframe]
- Research implications: [which phases matter most/least]

**Risk Tolerance**: [conservative/balanced/aggressive]
- Constraints: [specific filters or red flags to emphasize]

### Phase Prioritization

**Deep Dive Phases** (allocate more resources):
- **Phase [X]**: [phase name]
  - Why prioritized: [user's specific concern]
  - Extra depth: [specific analysis to perform]

**Standard Coverage**:
- Phase [X], [Y], [Z]: Standard depth

**Quick Pass** (if user specified):
- Phase [X]: Streamlined coverage

### Multi-Agent Deployment Strategy

**Phase 1: Business Foundation**
- Agent 1A: Core business and products
- Agent 1B: Revenue and profit composition
- Agent 1C: Customers and value chain position
- Agent 1D: Recent strategic changes (3-5 years)

**Phase 2: Industry Analysis**
- Agent 2A: Industry cycle stage assessment
- Agent 2B: Supply-demand dynamics
- Agent 2C: Competitive landscape and concentration
- Agent 2D: Policy and external variables

**Phase 3: Business Breakdown**
- Agent 3A: Business segment analysis
- Agent 3B: Profit engine and economics
- Agent 3C: Customer and pricing power analysis
- Agent 3D: Subsidiaries and non-core items

**Phase 4: Financial Quality**
- Agent 4A: Key metrics trends (5-10 years)
- Agent 4B: Cash flow quality analysis
- Agent 4C: Anomaly screening (red flags)
- Agent 4D: Peer comparison

**Phase 5: Governance Analysis**
- Agent 5A: Ownership structure
- Agent 5B: Management quality and incentives
- Agent 5C: Capital allocation track record
- Agent 5D: Shareholder returns history

**Phase 6: Market Sentiment**
- Agent 6A: Bull case research
- Agent 6B: Bear case research
- Agent 6C: Key debate points identification
- Agent 6D: Verification nodes (what data will resolve debates)

**Phase 7: Valuation & Moat**
- Agent 7A: Competitive moat assessment
- Agent 7B: Relative valuation (historical + peers)
- Agent 7C: Absolute valuation (DCF, reverse DCF)
- Agent 7D: Risk scenarios and failure modes

**Total Agents**: ~28 agents (4 per phase × 7 phases)

### Output Structure

**Directory**: `RESEARCH/STOCK_[ticker]_[company_name]/`

**Files**:
1. README.md - Navigation and overview
2. 00_Executive_Summary.md - Signal rating, thesis, summary
3. 01_Business_Foundation.md
4. 02_Industry_Analysis.md
5. 03_Business_Breakdown.md
6. 04_Financial_Quality.md
7. 05_Governance_Analysis.md
8. 06_Market_Sentiment.md
9. 07_Valuation_Moat.md
10. Financial_Data/key_metrics_table.md
11. Financial_Data/cashflow_analysis.md
12. Financial_Data/peer_comparison.md
13. Valuation/historical_multiples.md
14. Valuation/dcf_analysis.md
15. Valuation/reverse_dcf_implied_growth.md
16. Risk_Monitoring/bear_case.md
17. Risk_Monitoring/black_swans.md
18. Risk_Monitoring/monitoring_checklist.md
19. sources/bibliography.md
20. sources/data_sources.md

### Data Sources (Priority Order)
1. [List primary sources from prompt]
2. [List secondary sources]
3. [List sources to avoid or verify]

### Quality Checks
- [ ] All claims cited with source quality ratings (A-E)
- [ ] Profit vs. cash flow cross-validation
- [ ] Company vs. peer comparison
- [ ] Bear case analysis included
- [ ] No investment advice given

### Estimated Timeline
- Phase 1: ~[time] minutes
- Phase 2: ~[time] minutes
- ...
- **Total estimated time**: ~[total time]

---

**Ready to proceed?** I'll begin by deploying parallel agents for Phase 1.
```

### Present Plan to User

Show the plan and wait for approval (unless in automated mode):

```
I've created a research execution plan for [company] ([ticker]).

**Key highlights**:
- [number] phases, deploying ~[total] research agents in parallel
- Priority focus on: [list priority phases]
- Expected output: [number] files in standardized directory structure
- Estimated time: [time range]

Would you like me to proceed? Or would you like to adjust the plan?
```

**If user wants adjustments**: Modify plan accordingly
**If user approves**: Begin execution
**If no response (automated mode)**: Proceed after brief pause

---

## Step 3: Deploy Multi-Agent Research

### Critical Rule: ALWAYS Launch Agents in Parallel

**❌ WRONG (Sequential)**:
```
Launching Agent 1A...
[Wait for completion]
Launching Agent 1B...
[Wait for completion]
```

**✅ RIGHT (Parallel)**:
```
Launching 4 agents in parallel for Phase 1...

[Agent 1A] Research business foundation - products
[Agent 1B] Research business foundation - revenue
[Agent 1C] Research business foundation - customers
[Agent 1D] Research business foundation - strategy

[All agents now running concurrently]
```

### How to Launch Parallel Agents

Use the **Task tool with multiple invocations in a single message**:

```python
# Pseudocode example (actual implementation uses Task tool)

response = [
    Task(agent_1a_task),
    Task(agent_1b_task),
    Task(agent_1c_task),
    Task(agent_1d_task)
]

# All 4 agents start immediately and run in parallel
# Wait for all to complete, then collect results
```

### Specialized Subagent Dispatch Templates

Subagents are deployed using specialized templates depending on whether their research mandate is qualitative/strategic or quantitative/financial:

#### Template A: Qualitative, Strategic & Narrative Agents (Phases 1, 2, 6)
```markdown
You are a senior equity research specialist focusing on [Phase Name: Business Model / Industry Structure / Market Sentiment] for [Target: ticker, symbol, slug].

**GROUND TRUTH ANCHOR**:
- Ticker: [ticker], Symbol: [symbol], Slug: [slug]
- Calendar Date: [temporal_anchor], Latest Filed Quarter: [latest_filed_quarter]

**MANDATORY PRIMARY MCP TOOLS**:
1. `mcp__tijori-finance__get_supply_chain`: Extract relational products, inputs used, industries catered to, and vendor/customer disclosures.
2. `mcp__tijori-finance__get_company_strategic_profile`: Extract executive business summary, core products, and market footprint.
3. `mcp__tijori-finance__get_company_timeline`: Extract chronological corporate milestones, board actions, and "What to watch" analyst guidance notes.
4. `mcp__tijori-finance__get_stock_news`: Fetch real-time publisher headlines and Google News RSS items.
5. `mcp__tijori-finance__get_price_movement_catalysts`: For every price movement >5% over the past 3 years, extract verified causal explanations and primary source URLs.
6. `mcp__tijori-finance__get_brokerage_reports`: Extract institutional research notes with outlook (bullish/neutral/bearish), summary, and target prices.

**STRICT QUALITY RULES**:
- Causal Price Swings: Never speculate on reasons for 5–15% daily stock movements. Must cite the causal catalyst from `get_price_movement_catalysts`.
- Concall Transcript Quotes: Executive quotes must cite diarized concall paragraphs with speaker name and chapter timestamp (`[MM:SS]`) from `get_earnings_intelligence` or official IR decks. Single-speaker calls must be attributed to `"Management (Verified Transcript)"` without inventing unverified corporate titles. Zero external audio URLs required.
```

#### Template B: Quantitative, Financial & Valuation Agents (Phases 3, 4, 5, 7)
```markdown
You are a senior forensic equity analyst focusing on [Phase Name: Unit Economics / Financial Quality / Governance / Valuation] for [Target: ticker, symbol, slug].

**GROUND TRUTH ANCHOR**:
- Ticker: [ticker], Symbol: [symbol], Slug: [slug]
- Calendar Date: [temporal_anchor], Latest Filed Quarter: [latest_filed_quarter]
- Currency Standard: Preserve each source's currency and units; unknown values remain null.

**JURISDICTIONAL ROUTER**:
- **For Indian Equities (NSE/BSE)**:
  1. `mcp__tijori-finance__get_operational_metrics`: Extract time series of sector-specific unit KPIs (capacity, volumes, realizations, ARPOB, MTPA).
  2. `mcp__tijori-finance__get_raw_materials`: Extract benchmark commodity price series, spreads, and margin sensitivity.
  3. `mcp__tijori-finance__get_factors_and_benchmarking`: Extract 0–10 Moat Radar benchmarks across the authentic 5 axes (`Valuation`, `Growth`, `Profitability`, `Financial Health`, `Price Momentum`) and 57 audited formula explanations.
  4. `mcp__tijori-finance__get_shareholding` (`detailed: true`): Extract 10-quarter institutional holding shifts (line-item domestic mutual funds, LIC, retail tiers) and promoter pledge %.
  5. `mcp__tijori-finance__get_fund_flow`: Extract multi-year cumulative cash sources vs. uses across 1, 3, 5, 7, 10-year periods. (NOTE: Period parameter represents multi-year cumulative totals, not single-year annual flows).
  6. `mcp__tijori-finance__get_valuation_bands`: Extract statistical 1Y, 3Y, 5Y, 10Y daily P/E percentile valuation bands (min, p25, median, p75, max).
  7. `mcp__tijori-finance__get_scenario_projections`: Verify company-matched scenarios; record provider assumptions and provenance.
  8. `mcp__tijori-finance__get_earnings_intelligence`: Extract multi-quarter consensus revenue/EPS surprise track record.
  9. `stock-research_screener`: Extract statutory 10-year balance sheet, P&L, cash flows, and last 5 quarters.
- **For US / Global Equities (NASDAQ/NYSE/HKEX)**:
  Bypass Indian-only Tijori tools. Ingest Perplexity (`get_company_strategic_profile`, `get_price_movement_catalysts`) + Yahoo Finance (`yfinance_get_financials`, `yfinance_get_analyst_estimates`, `yfinance_get_price_history`) + SEC EDGAR via `mcp__web_reader__webReader`.

**STRICT QUALITY RULES**:
- Valuation Bands: DCF fair values and terminal multiples must be bounded within statistical 1Y–10Y P/E valuation bands from `get_valuation_bands`.
- Scenario Provenance: Verify target company, observation date, reporting basis, currency, units, and source. Report provider-supplied weights only as assumptions; never synthesize odds or expected returns when source projections are absent.
- TTM EPS Reconciliation: Reconcile trailing quarterly EPS sum ($\text{TTM EPS} = \sum_{q=1}^4 \text{Quarterly EPS}$) against annual audited FY figures.
- Dual-Unit Denomination: Explicitly declare both raw INR (1 INR) and ₹ Crores ($10^7$ INR) in headers.
```

### Collecting Agent Results

After agents complete:

**1. Compile All Findings**:
```
Phase [X] Agent Results Summary:

**Agent XA**: [2-sentence summary of key findings]
**Agent XB**: [2-sentence summary of key findings]
**Agent XC**: [2-sentence summary of key findings]
**Agent XD**: [2-sentence summary of key findings]
```

**2. Identify Overlaps and Redundancies**:
```
**Consensus Findings** (mentioned by 2+ agents):
- [Finding 1]
- [Finding 2]

**Unique Findings** (from single agent):
- [Finding from Agent XB only]
- [Finding from Agent XC only]
```

**3. Resolve Contradictions**:
```
**Contradictions Identified**:
- Issue: [Agent XA says Y, Agent XB says Z]
- Resolution: [Examine sources, determine which is more credible,
  or present both perspectives]
```

**4. Create Coherent Narrative**:
```
**Synthesis**: Combine findings into logical flow:
- Start with most important/consensus findings
- Address unique insights
- Acknowledge contradictions and explain them
- Highlight uncertainties and gaps
```

---

## Step 4: Algebraic & Mathematical Verification Gate

Before aggregating research findings into phase reports, all quantitative financial data must pass the **7 Mathematical Invariants**:

1. **Operating Profit Invariant**:
   $$\text{Revenue from Operations} - \text{Total Operating Expenses} = \text{Operating Profit (EBITDA)}$$
2. **PBT Balancing Invariant**:
   $$\text{EBITDA} - \text{Depreciation \& Amortization} - \text{Finance Costs} + \text{Other Income} \pm \text{Exceptional Items} = \text{PBT}$$
3. **Net Profit (PAT) Invariant**:
   $$\text{PBT} - \text{Total Tax Expense} = \text{Reported PAT}$$
4. **Normalized Core PAT Invariant**:
   $$\text{Reported PAT} \mp \text{Net Exceptional Items} \times (1 - \text{Effective Tax Rate}) = \text{Normalized Operational PAT}$$
5. **Segment Sum Invariant**:
   $$\sum_{i=1}^{n} \text{Segment Revenue}_i + \text{Unallocated Corporate} - \text{Inter-segment Eliminations} = \text{Consolidated Revenue}$$
6. **Shareholding Sum Invariant**:
   $$\text{Promoter} + \text{FII} + \text{DII} + \text{Public} + \text{Others} = 100.00\% \quad (\pm 0.05\% \text{ rounding threshold})$$
7. **Valuation Capitalization Invariant**:
   $$\text{Market Capitalization} = \text{CMP} \times \text{Diluted Shares Outstanding}$$
   $$\text{Enterprise Value} = \text{Market Cap} + \text{Total Debt} + \text{Minority Interest} - \text{Cash \& Cash Equivalents}$$
8. **Scenario Provenance Check**:
   Verify scenario identity, date, reporting basis, currency, units, source methodology, and stated assumptions. Mathematical consistency does not establish probability calibration or prediction accuracy.

---

## Step 5: Generate Standardized Phase Reports

For each completed phase, generate the dedicated markdown file in `RESEARCH/STOCK_[ticker]_[company]/`:
- `01_Business_Foundation.md`
- `02_Industry_Analysis.md`
- `03_Business_Breakdown.md`
- `04_Financial_Quality.md`
- `05_Governance_Analysis.md`
- `06_Market_Sentiment.md`
- `07_Valuation_Moat.md`

Each report must strictly adhere to the standardized sections:
1. Executive Summary (2–3 paragraphs)
2. Ground Truth Anchor (Calendar date, latest filed quarter, reporting boundary `[CONSOLIDATED]`)
3. Detailed Findings with inline citations
4. Standardized Data Tables (all rows mathematically balanced)
5. Source Quality Assessment (A–E breakdown)
6. Contradictions & Gaps
7. Key Takeaways

---

## Step 6: Financial Quality Assurance & Mathematical Audit (FQA - 15-Point Gate)

Before the Lead Agent compiles `00_Executive_Summary.md`, execute the mandatory 15-Point FQA Gate:

1. **G1: Temporal Freshness Gate**:
   - [ ] Does the report cite the exact latest officially filed quarterly results approved by the Board?
   - [ ] Are any 1-2 year old historical quarters cited as current results? (Must abort and re-fetch via MCP if true).

2. **G2: Reporting Boundary Audit**:
   - [ ] Is every financial table explicitly labeled `[CONSOLIDATED]` or `[STANDALONE]`?
   - [ ] Are operating subsidiaries with $\ge 5\%$ share fully consolidated?

3. **G3: Actuals vs. Estimates Segregation**:
   - [ ] Are historical filings strictly tagged `[REPORTED / FILED]`?
   - [ ] Are run-rates, broker projections, and DCF models strictly tagged `[PROJECTED / ESTIMATE]`?

4. **G4: Currency & Denomination Audit**:
   - [ ] Every table header explicitly states currency and denomination (`₹ in Crores` or `$ in Millions`).
   - [ ] Both raw INR integers (1 INR) and ₹ Crores ($10^7$ INR) standardized with zero scale confusion.

5. **G5: Algebraic Invariant Audit**:
   - [ ] Check all 9 mathematical invariants and document any discrepancies.

6. **G6: Cross-Document Synchronization**:
   - [ ] Figures in `00_Executive_Summary.md` match `04_Financial_Quality.md` and `07_Valuation_Moat.md` verbatim.
   - [ ] CMP, Market Cap, Shares, Net Debt remain identical across all files.

7. **G7: Peer Multiples & CAPM Synchronization**:
   - [ ] Peer multiples fetched on the exact same market trading session.
   - [ ] CAPM parameters ($R_f$ 10Y bond, $\beta$, ERP, WACC) documented with primary sources.
   - [ ] Terminal growth $g \le \text{Long-Term Sovereign GDP}$.

8. **G8: Cash Flow & Working Capital Stress Test**:
   - [ ] Compare $\text{Operating Cash Flow} / \text{Net Income}$ across multiple years; explain working-capital and sector context without a universal pass threshold.
   - [ ] Cash Conversion Cycle ($\text{Debtor Days} + \text{Inventory Days} - \text{Creditor Days}$) trend analyzed.

9. **G9: Countering the "Backlog Fallacy"**:
   - [ ] Tier backlog into Tier 1 (Escrow / Multilateral: World Bank, ADB, PSUs), Tier 2 (Commercial / Bank-guaranteed), Tier 3 (State line departments without dedicated escrow).
   - [ ] Prohibited from claiming backlog "guarantees" revenue without checking milestone billing speed.

10. **G10: Statutory Promoter Pledge & Float Audit**:
    - [ ] `Pledged Shares as % of Promoter Shares` extracted from latest exchange filing (`get_shareholding_pattern`).
    - [ ] Track FII/DII float migration: flag "Institutional Supply Overhang" if FII stake fell >500 bps and retail float >40%.

11. **G11: Concession SPV vs. Core Debt Disaggregation**:
    - [ ] Disaggregate Total Debt into Core Operating Debt vs. Ring-Fenced Non-Recourse SPV Debt.
    - [ ] Model upfront capex/equity drain during concession installation phase before annuity phase begins.

12. **G12: Downside Floor Methodological Rigor**:
    - [ ] Downside price floors cannot be heuristic moving averages or arbitrary support levels.
    - [ ] Must be strictly grounded in Tangible Book Value per Share (BVPS), replacement asset liquidation value, or stressed bear-case DCF.

13. **G13: Scenario Provenance**:
    - [ ] Verify company, date, reporting basis, currency, units, and source methodology for every scenario.
    - [ ] Report provider weights only as source assumptions. Never synthesize odds or treat them as calibrated probabilities.

14. **G14: Concall Transcript & Primary Consensus Verification**:
    - [ ] Historical consensus revenue and EPS surprise % cited directly from `get_earnings_intelligence`.
    - [ ] Executive quotes cite diarized concall paragraphs with speaker name and chapter timestamp (`[MM:SS]`) from `get_earnings_intelligence` or official IR decks. Single-speaker calls attributed to `"Management (Verified Transcript)"` without inventing unverified corporate titles. Zero external audio URLs required.

15. **G15: Forecast Claim Calibration**:
    - [ ] Do not state directional predictions, expected returns, or scenario odds as calibrated without out-of-sample validation evidence.
    - [ ] Label model outputs as estimates and disclose inputs, assumptions, date, currency, and limitations.
    - [ ] Use `INSUFFICIENT_DATA` when entity, source, freshness, or coverage checks fail.

---

## Scenario and Directional Analysis

Present conditional bear/base/bull cases only when inputs are company-matched and sourced. State assumptions and sensitivity; provider weights are assumptions, not calibrated probabilities. Do not calculate probability-weighted returns without validated probabilities.

Summarize observed evidence, counter-evidence, catalysts, and unresolved questions. A directional score may be shown only as a clearly labeled heuristic, never as a price prediction. If evidence is stale, mismatched, or insufficient, report `INSUFFICIENT_DATA`.

---

## Step 7: Generate Final Synthesis Report

### Executive Summary Structure

```markdown
# Executive Summary

## Analyst View (Optional)

**View**: [Attractive / Mixed / Unattractive / INSUFFICIENT_DATA]

**Rationale**: [Evidence, counter-evidence, assumptions, and what would change this view. This is not a calibrated price prediction.]

## Investment Thesis

**One-Liner**: [Single sentence capturing the essence]

**Detailed Thesis**: [2-3 paragraph narrative explaining:
- Why this company is (or isn't) attractive
- Key competitive advantages (or lack thereof)
- Primary risks and concerns
- What would make the thesis change]

## Key Metrics Summary

| Metric | Value | Context |
|--------|-------|---------|
| Market Cap | [amount] | [context: large/mid/small cap] |
| TTM Revenue | [amount] | [growth rate vs. prior year] |
| TTM Net Income | [amount] | [margin %] |
| P/E (TTM) | [value] | [percentile vs. 5-year history] |
| P/B | [value] | [percentile vs. 5-year history] |
| ROE | [value] | [above/below peer average] |
| Dividend Yield | [value] | [if applicable] |

## Top 3 Reasons to Consider

1. **[Reason 1]**: [2-3 sentences with evidence]
2. **[Reason 2]**: [2-3 sentences with evidence]
3. **[Reason 3]**: [2-3 sentences with evidence]

## Top 3 Reasons to Avoid

1. **[Risk 1]**: [2-3 sentences with evidence]
2. **[Risk 2]**: [2-3 sentences with evidence]
3. **[Risk 3]**: [2-3 sentences with evidence]

## Financial Health Evidence

**Assessment**: [Summarize verified evidence and limitations; do not invent a numeric score.]

**Evidence**:
- Profitability: [reported metric, date, and source]
- Cash Flow Quality: [reported metric, date, and source]
- Balance Sheet Strength: [reported metric, date, and source]
- Growth Sustainability: [reported metric, date, and source]

## Valuation Assessment

**Relative Valuation**: [Undervalued/Fairly Valued/Overvalued]
- Trading at [percentile]th percentile of [X]-year historical [PE/PB]
- [Premium/Discount] to peers of [X]%

**Absolute Valuation**:
- DCF intrinsic value: [price/value per share]
- Margin of safety: [X]% (if undervalued)
- Implied growth: [X]% (from reverse DCF)

## Moat Evidence

Summarize source-reported factor axes and supporting facts. Do not invent an overall score or mix scoring scales.

## Monitoring Checklist

**Thesis Strengthening Conditions**:
- [ ] [Event/indicator that would make the bull case stronger]
- [ ] [Event/indicator that would make the bull case stronger]

**Thesis Review Triggers**:
- [ ] [Dated or measurable evidence that would require reassessment]
- [ ] [Dated or measurable evidence that would require reassessment]

## Key Risks

1. **[Risk Category]**: [description]
   - Likelihood assessment: [Qualitative, with rationale; not a calibrated probability]
   - Potential impact: [Range or qualitative description with assumptions]
   - Monitoring: [what to watch]

2. **[Risk Category]**: [description]
   - ...

## Conclusion

[2-3 sentence conclusion summarizing the investment case]

---

**Report Generated**: [Date]
**Research Phases Completed**: 8/8
**Sources Analyzed**: [number]
**Confidence Level**: [High/Medium/Low]

**Disclaimer**: This research is for educational and informational purposes only and does not constitute investment advice. All investments involve risk. Past performance does not guarantee future results. Always conduct your own due diligence and consult with qualified financial advisors.
```

---

## Step 8: Citation Verification & Source Quality Rating (A–E Scale)

After generating the final report, execute a rigorous citation audit:

### 1. Source Hierarchy & Rating Rules
- **Grade A (Statutory Disclosures & Regulatory Filings)**:
  - 10-K, 10-Q, 20-F, SEBI LODR Clause 41 quarterly filings, official MCA/SEBI documents.
  - **Mandatory for**: All historical financial tables, debt figures, and shareholding patterns.
- **Grade B (Official Investor Relations & Institutional Research)**:
  - Earnings call transcripts, company investor presentations, rating agency rationales (Crisil, ICRA, S&P).
  - **Mandatory for**: Segment breakdowns, capex guidance, and management forward commentary.
- **Grade C (Reputable Financial Media)**:
  - Reuters, Bloomberg, WSJ, Financial Times, Mint, Economic Times.
  - **Used for**: External market context, executive changes, and industry news.
- **Grade D (Secondary Publications & Trade Blogs)**:
  - Must be corroborated with primary regulatory sources before inclusion.
- **Grade E (Speculative Commentary & Unverified Leaks)**:
  - Strictly prohibited unless explicitly tagged `[UNVERIFIED - GRADE E]`.

### 2. Citation Completeness Checklist
- [ ] Every factual claim has an inline citation: `[Organization, Document Title, Date, URL, Page #]`.
- [ ] Every financial figure in tables traces back to an official statutory filing or earnings release.
- [ ] No unattributed phrases like "industry analysts expect" or "sources claim".
- [ ] `sources/bibliography.md` documents all sources with their respective A–E grade rating.

---

## Special Scenarios

### Scenario 1: Distressed Company (e.g., bankruptcy risk)

**Adjustments**:
- Emphasize Phases 4 (solvency) and 7 (liquidation value)
- Add: "Going Concern vs. Liquidation" analysis
- Valuation: Focus on recovery scenarios, explicit assumptions, and sensitivity; do not assign unsupported probabilities
- Risk analysis: Emphasize binary outcomes and timing risks

### Scenario 2: High-Growth Company (unprofitable)

**Adjustments**:
- Phase 4: Focus on cash burn rate, runway, path to profitability
- Valuation: Use user value models, TAM penetration, growth-over-earnings
- Skip: Traditional P/E, DCF (if no current cash flow)
- Add: Growth sustainability assessment, competitive moat durability

### Scenario 3: Newly Public (IPO)

**Adjustments**:
- Phase 1: Emphasize IPO prospectus analysis
- Phase 4: Limited historical data (use prospectus financials)
- Phase 5: Check for lock-up expirations, insider selling plans
- Valuation: Difficult (no trading history), focus on prospectus guidance

### Scenario 4: Foreign Company (e.g., Chinese A-share)

**Adjustments**:
- Data sources: Emphasize local language sources (Chinese for A-shares)
- Translation: Provide bilingual or clarify if using English sources
- Regulatory: Include country-specific regulatory risks
- Accounting: Note if using IFRS, GAAP, or local standards (CAS for China)

---

## Best Practices

### 1. Maintain Objectivity

**DO**:
- Present balanced facts
- Acknowledge uncertainties
- Include bear case alongside bull case

**DON'T**:
- Use hype language ("incredible opportunity", "must-buy")
- Use fear language ("disaster waiting to happen")
- Cherry-pick data to support a narrative

### 2. Prioritize Primary Sources

**Source Hierarchy**:
1. Company filings (annual reports, regulatory submissions)
2. Regulatory documents
3. Direct company communications
4. Reputable third-party research (with skepticism)
5. News and secondary analysis (verify claims)

### 3. Be Transparent About Limitations

When you can't find information:
```markdown
**Limitation**: [What couldn't be determined]
- [Why it couldn't be determined (e.g., not disclosed, conflicting sources)]
- [What this means for the analysis]
- [What additional research would be needed]
```

### 4. Use TodoWrite for Progress Tracking

Track your research progress:

```python
TodoWrite([
    {"content": "Phase 1: Business Foundation", "status": "completed"},
    {"content": "Phase 2: Industry Analysis", "status": "in_progress"},
    {"content": "Phase 3-7: Pending", "status": "pending"}
])
```

This helps user see progress and allows resumption if interrupted.

---

## Troubleshooting

### Issue: Agents Return Contradictory Findings

**Solution**:
1. Examine sources for each contradictory claim
2. Assess source quality (A-E scale)
3. Check publication dates (older info may be outdated)
4. Present both perspectives with source attribution
5. Explain likely reasons for contradiction

### Issue: Cannot Find Information

**Solution**:
1. Try alternative search queries
2. Search in different languages (if foreign company)
3. Look in regulatory filings instead of news
4. Acknowledge limitation explicitly in report
5. Flag for user to investigate further

### Issue: WebSearch Returns Poor Results

**Solution**:
1. Use more specific, targeted queries
2. Add site: filters (e.g., "site:sec.gov", "site:cninfo.com.cn")
3. Use file type filters (e.g., "filetype:pdf annual report")
4. Try alternative search terms
5. Check if company has changed names or tickers

### Issue: Information Overload (Too Many Sources)

**Solution**:
1. Prioritize authoritative sources (annual reports, regulatory filings)
2. Limit analysis to most recent 3-5 years unless historical context needed
3. Focus on material information (ignore trivial details)
4. Synthesize across sources rather than listing all

---

For detailed phase-by-phase instructions, see [phases.md](phases.md).
For execution examples, see [examples.md](examples.md).
