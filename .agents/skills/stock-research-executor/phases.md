# Stock Research Executor - Phase-by-Phase Instructions

This document provides detailed instructions for each of the 8 phases of investment due diligence, including specific research objectives, agent deployment strategies, and output templates.

## Phase 1: Business Foundation (公司事实底座)

### Objective

Establish a factual understanding of what the company does, how it makes money, and its position in the industry value chain.

### Research Goals

1. Understand the core business model and product/service offerings
2. Identify revenue and profit sources by segment
3. Analyze customer base and use cases
4. Determine position in industry value chain
5. Track recent strategic changes (3-5 years)

### Multi-Agent Deployment Strategy

Deploy **4 agents in parallel**:

**Primary MCP Tools for Phase 1**:
- `mcp__tijori-finance__get_supply_chain`: Extract relational products, inputs used, industries catered to, and key customers.
- `mcp__tijori-finance__get_revenue_mix`: Extract multi-year percentage breakdowns across product segments and domestic vs export geographies.
- `mcp__tijori-finance__get_corporate_actions`: Extract dividend payouts, bonus history, stock splits, and rights issues.
- `mcp__tijori-finance__get_company_strategic_profile`: Extract executive company summary, listing details, and market footprint.

#### Agent 1A: Core Business, Products & Segment Mix

**Objective**: Map the company's business model, product portfolio, and multi-year segment mix using `get_revenue_mix` and `get_company_strategic_profile`.

**Key Questions**:
- What products/services does the company offer?
- What are the main business segments and their historical revenue % contribution (`get_revenue_mix`)?
- How does each segment make money?
- What is the geographical split (India Domestic vs. Direct Exports)?

**Data to Find**:
- Product/service descriptions
- Business segment breakdown from `get_revenue_mix` (with multi-year percentages)
- Main revenue drivers for each segment
- Product/service life cycle (growth, mature, declining)

**Sources to Prioritize**:
- `mcp__tijori-finance__get_revenue_mix` and `get_company_strategic_profile`
- Annual reports (business overview section)
- Company website and investor presentations
- Segment reporting in financial statements

**Output Structure**:
```markdown
## Core Business and Products

**Business Model**: [1-2 sentence description]

**Product & Segment Revenue Mix (from `get_revenue_mix`)**:
| Segment | Description | FY22 (%) | FY23 (%) | FY24 (%) | FY25 (%) | Growth Trend |
|---------|-------------|:---:|:---:|:---:|:---:|:---:|
| [Segment 1] | [description] | [%] | [%] | [%] | [%] | [trend] |
| [Segment 2] | [description] | [%] | [%] | [%] | [%] | [trend] |

**Geographic Revenue Mix**:
- Domestic (India): [X]%
- Export Markets: [Y]% (Key markets: US, Europe, Middle East, Asia)

**Key Insights**:
- [Insight 1]
- [Insight 2]
```

---

#### Agent 1B: Revenue and Profit Composition

**Objective**: Understand how the company generates revenue and profit

**Key Questions**:
- What are the main revenue streams?
- Which segments/products are most profitable?
- How has revenue mix changed over time?
- Are there any high-revenue but low-profit segments?

**Data to Find**:
- Revenue breakdown by segment/product/geography
- Gross margin by segment
- Operating profit by segment
- 3-5 year trend analysis

**Sources to Prioritize**:
- Annual reports (segment reporting)
- Financial statement notes
- Management commentary (earnings calls)

**Output Structure**:
```markdown
## Revenue and Profit Composition

**Revenue Mix** (Most Recent Year):
| Source | Revenue | % of Total | YoY Growth |
|--------|---------|------------|------------|
| [Source 1] | [amount] | [%] | [%] |
| [Source 2] | [amount] | [%] | [%] |

**Profit Contribution**:
| Segment | Gross Margin | Operating Margin | Profit % |
|---------|--------------|------------------|----------|
| [Segment 1] | [%] | [%] | [%] |
| [Segment 2] | [%] | [%] | [%] |

**Key Insights**:
- Most profitable segment: [name] with [margin]%
- [Any mismatches: high revenue but low profit, or vice versa]
```

---

#### Agent 1C: Customers, Supply Chain & Value Chain Position

**Objective**: Map supply chain relations, inputs used, industries catered to, and value chain position using `get_supply_chain`.

**Key Questions**:
- What raw materials and intermediate components does the company consume (`uses`)?
- What downstream industries and client segments does it supply (`caters to`)?
- Who are the top customers and what is the concentration risk?
- What's the company's position in the value chain (upstream, midstream, downstream)?

**Data to Find**:
- Supply chain map from `get_supply_chain` (`uses` vs `caters to`)
- Customer segments (B2B vs B2C, industries, geographies)
- Top customers and vendor concentration
- Distribution channels (direct, indirect, online, offline)

**Sources to Prioritize**:
- `mcp__tijori-finance__get_supply_chain`
- Annual reports (customer and market sections)
- Company investor presentations

**Output Structure**:
```markdown
## Customers, Supply Chain & Value Chain Position

**Supply Chain Relational Map (from `get_supply_chain`)**:
- **Raw Materials & Inputs Used**: [List of commodities/components from `uses`]
- **Downstream Sectors Caters To**: [List of client industries from `caters to`]

**Customer Concentration**:
- Top 5/10 customers: [X]% of revenue (if disclosed)
- Concentration risk: [High/Medium/Low]

**Order Book Quality & Counterparty Escrow Tiering (Countering the Backlog Fallacy)**:
*An order book is a right to execute work, not cash revenue. Backlog without escrow payment security is a working capital liability.*
| Tier | Counterparty Classification | Backlog Value (₹/$) | % of Total | Payment Security Mechanism (Escrow / LC / State Budget) | Risk Profile |
|:---:|:---|:---|:---:|:---|:---:|
| **Tier 1** | Sovereign Multilateral / Central PSUs | [amount] | [%] | Direct Escrow (World Bank, ADB, Central Escrow) | Lowest Risk (30-45d settlement) |
| **Tier 2** | Commercial / Private Industrial | [amount] | [%] | Letter of Credit / Bank Guarantee / Corporate Parent | Moderate Risk |
| **Tier 3** | State Govt Line Departments | [amount] | [%] | State PWD / Irrigation budgets (Un-escrowed) | **High Working Capital Delay Risk** |

**Value Chain Position**:
- Position: [upstream/midstream/downstream/integrated]
- Bargaining power: [strong/moderate/weak]
- Reason: [explanation]
```

---

#### Agent 1D: Strategic Changes & Corporate Actions History

**Objective**: Track significant strategic shifts, M&A, and corporate actions history using `get_corporate_actions`.

**Key Questions**:
- What major strategic initiatives has the company undertaken?
- What is the historical dividend, bonus, and stock split track record (`get_corporate_actions`)?
- Have there been business model changes, M&A, or restructurings?
- Technology investments or digital transformation?

**Data to Find**:
- Historical corporate actions from `get_corporate_actions`
- Major acquisitions or divestitures
- New product launches or discontinuations
- Strategic partnerships or JVs

**Sources to Prioritize**:
- `mcp__tijori-finance__get_corporate_actions`
- Annual reports (MD&A section, past 3-5 years)
- Press releases and exchange announcements

**Output Structure**:
```markdown
## Recent Strategic Changes & Corporate Actions

**Corporate Actions History (from `get_corporate_actions`)**:
| Action Type | Ex-Date | Details / Ratio / Amount | Impact on Equity Base |
| :--- | :---: | :--- | :--- |
| **Dividend** | [Ex-Date] | [₹ Amount per share] | Cash outflow [₹ Cr] |
| **Bonus / Split** | [Ex-Date] | [Ratio e.g. 1:1, 10:2] | Shares expanded from [A] to [B] Cr |

**Timeline of Major Strategic Events**:
| Year | Event | Impact | Status |
|------|-------|--------|--------|
| [Year] | [event] | [impact] | [ongoing/completed/failed] |

**Sources to Prioritize**:
- Annual reports (MD&A section, past 3-5 years)
- Press releases and announcements
- News archives for major events

**Output Structure**:
```markdown
## Recent Strategic Changes (Past 3-5 Years)

**Timeline of Major Events**:
| Year | Event | Impact | Status |
|------|-------|--------|--------|
| [Year] | [event] | [impact] | [ongoing/completed/failed] |
| [Year] | [event] | [impact] | [status] |

**Strategic Initiatives**:
1. **[Initiative 1]**: [description]
   - Launched: [year]
   - Investment: [amount if known]
   - Results to date: [description]

2. **[Initiative 2]**: [description]
   - ...

**Overall Assessment**:
- Strategy is [consistent/evolving/unclear]
- Success rate: [high/mixed/low]
```

---

### Phase 1 Synthesis and Report Generation

After all 4 agents complete:

1. **Compile findings** into coherent narrative
2. **Create summary table** of key business facts
3. **Identify any contradictions** between sources
4. **Generate Phase 1 report**: `01_Business_Foundation.md`

**Report Template**:
```markdown
# Phase 1: Business Foundation

## Executive Summary
[2-3 paragraph overview]

## 1.1 Core Business and Products
[Content from Agent 1A]

## 1.2 Revenue and Profit Composition
[Content from Agent 1B]

## 1.3 Customers and Value Chain Position
[Content from Agent 1C]

## 1.4 Recent Strategic Changes
[Content from Agent 1D]

## Key Takeaways
- [Takeaway 1]
- [Takeaway 2]
- [Takeaway 3]

## Red Flags Identified
- [Any concerning findings]
- [Areas requiring further investigation]

## Sources
[List all sources with A-E ratings]
```

---

## Phase 2: Industry Analysis (行业周期分析)

### Objective

Assess industry dynamics, competitive landscape, macro cycle position, and quantitative competitive moat durability.

### Research Goals

1. Determine industry cycle stage (recovery/expansion/recession/contraction)
2. Analyze supply-demand dynamics and capacity additions
3. Benchmark competitive landscape and thematic constituents using `get_markets` and `get_sector_constituents`
4. Quantify competitive moat durability using `get_factors_and_benchmarking` (0–10 Radar across 5 axes and 57 formulas)
5. Ingest strategic company profile using `get_company_strategic_profile`

### Multi-Agent Deployment Strategy

Deploy **4 agents in parallel**:

**Primary MCP Tools for Phase 2**:
- `mcp__tijori-finance__get_factors_and_benchmarking`: 0–10 Moat Radar scores across the authentic 5 axes (`Valuation`, `Growth`, `Profitability`, `Financial Health`, `Price Momentum`) and 57 formulas vs peer medians.
- `mcp__tijori-finance__get_markets`: Benchmark performance of headline indices, niche sector indices, and conglomerate groups.
- `mcp__tijori-finance__get_sector_constituents`: Thematic constituent peer list with market-cap weights and returns.
- `mcp__tijori-finance__get_company_strategic_profile`: Strategic business description, sector positioning, and valuation profile from Perplexity Finance.

#### Agent 2A: Industry Cycle Stage & Quantitative Moat Radar

**Objective**: Determine where the industry is in the business cycle and embed the quantitative 0–10 Moat Radar benchmarks from `get_factors_and_benchmarking`.

**Key Questions**:
- Is the industry in recovery, expansion, recession, or contraction?
- What are the company's scores across the authentic 5 Moat Radar axes (`Valuation`, `Growth`, `Profitability`, `Financial Health`, `Price Momentum`)?
- How do these scores compare against industry peer medians?
- What do the underlying 57 formula audit rows reveal about moat durability?

**Data to Find**:
- Industry production/output trends
- Capacity utilization rates
- Authentic 5 Moat Radar axis scores from `get_factors_and_benchmarking`
- Underlying factor formulas (e.g. ROE Dupont quality, pricing power, debt service)

**Sources to Prioritize**:
- `mcp__tijori-finance__get_factors_and_benchmarking`
- `mcp__tijori-finance__get_company_strategic_profile`
- Industry association reports
- Government statistics

**Output Structure**:
```markdown
## Industry Cycle Stage & Quantitative Moat Radar

**Current Stage**: [Recovery/Expansion/Recession/Contraction]

**Quantitative Moat Radar Benchmarking (from `get_factors_and_benchmarking`)**:
| Moat Dimension / Radar Axis | Score (0–10) | Peer Median | Status vs. Peers | Underlying Formula Insights |
| :--- | :---: | :---: | :---: | :--- |
| **Valuation** | [Score] | [Median] | [Premium / Discount] | [Historic percentile position] |
| **Growth** | [Score] | [Median] | [Above / Below] | [Sales and profit CAGR consistency] |
| **Profitability** | [Score] | [Median] | [Strong / Weak] | [DuPont margin vs leverage drivers] |
| **Financial Health** | [Score] | [Median] | [Robust / Stressed] | [Debt service, supplier solvency] |
| **Price Momentum** | [Score] | [Median] | [Leading / Lagging] | [Trend vs sector benchmark] |
| **Overall Moat Score** | **[Overall]** | **[Peer Med]** | **[Moat Verdict]** | **[57 Formula Audit Summary]** |
```

**Evidence**:
| Indicator | Current Level | Trend | Implication |
|-----------|--------------|-------|-------------|
| Capacity Utilization | [%] | [rising/stable/falling] | [implication] |
| Inventory Levels | [high/normal/low] | [trend] | [implication] |
| Pricing | [inflation/stable/deflation] | [trend] | [implication] |
| CapEx | [expansion/maintenance] | [trend] | [implication] |

**Cycle Duration**:
- Current phase started: [year/quarter]
- Typical cycle length: [X] years
- Time until next inflection: [estimate if possible]

**Leading Indicators** (1-2 year forward-looking):
1. [Indicator 1]: [what it signals]
2. [Indicator 2]: [what it signals]

**Lagging Indicators** (confirms what already happened):
1. [Indicator 1]: [what it confirms]
2. [Indicator 2]: [what it confirms]
```

---

#### Agent 2B: Supply-Demand Dynamics

**Objective**: Analyze supply and demand fundamentals

**Key Questions**:
- What's driving demand? (secular trends, cyclical factors, policy)
- What's the supply situation? (capacity, new entrants, constraints)
- Is the market in balance, oversupply, or shortage?
- What's the medium-term outlook (1-3 years)?

**Data to Find**:
- Demand drivers and trends
- Supply capacity and utilization
- Import/export dynamics
- New capacity announcements
- Order backlogs or delivery times

**Sources to Prioritize**:
- Industry reports
- Company disclosures (if industry participant)
- Trade publications
- Government trade data

**Output Structure**:
```markdown
## Supply-Demand Analysis

**Demand Drivers**:
| Driver | Type | Strength | Trend |
|--------|------|----------|-------|
| [Driver 1] | [secular/cyclical/policy] | [strong/moderate/weak] | [growing/stable/declining] |
| [Driver 2] | [type] | [strength] | [trend] |

**Supply Situation**:
- Current capacity: [amount]
- Capacity utilization: [%]
- New capacity coming online: [amount] by [year]
- Supply constraints: [any limitations]

**Market Balance**:
- Current: [surplus/balance/shortage]
- Gap: [amount if quantified]
- 12-24 month outlook: [improving/deteriorating/stable]

**Key Risks to Supply-Demand Balance**:
- Risk 1: [description]
- Risk 2: [description]
```

---

#### Agent 2C: Competitive Landscape, Niche Sectors & Thematic Constituents

**Objective**: Map the competitive environment, niche industry indices, and peer constituent baskets using `get_markets` and `get_sector_constituents`.

**Key Questions**:
- Who are the main competitors and peers in this thematic niche?
- What are the constituents and relative returns of the niche sector index (`get_markets` + `get_sector_constituents`)?
- What's the market structure (fragmented, oligopoly, monopoly)?
- What are the market shares (CR5, HHI if available)?
- How intense is competition? (price wars, innovation, differentiation)
- What are the barriers to entry/exit?

**Data to Find**:
- Niche sector performance from `get_markets(tab: "niche")`
- Sector constituents and market-cap weightings from `get_sector_constituents`
- Major competitors and market shares
- Industry concentration (CR5, CR10)

**Sources to Prioritize**:
- `mcp__tijori-finance__get_markets` and `get_sector_constituents`
- `mcp__tijori-finance__get_company_strategic_profile`
- Industry reports
- Company annual reports (competitive landscape sections)

**Output Structure**:
```markdown
## Competitive Landscape & Thematic Constituents

**Niche Sector Index & Peers (from `get_markets` & `get_sector_constituents`)**:
| Company | Market Cap Weight (%) | 1M Return | 1Y Return | 3Y Return | P/E Multiple |
| :--- | :---: | :---: | :---: | :---: | :---: |
| **[Target Company]** | [%] | [%] | [%] | [%] | [P/E] |
| [Peer 1] | [%] | [%] | [%] | [%] | [P/E] |
| [Peer 2] | [%] | [%] | [%] | [%] | [P/E] |

**Industry Concentration**:
- CR5 (top 5 share): [X]%
- Concentration level: [high/medium/low]
- Trend: [consolidating/stable/fragmenting]

**Competitive Dynamics**:
- Primary basis of competition: [price/quality/innovation/service/brand]
- Intensity: [fierce/moderate/limited]
- Recent M&A: [description of consolidation trends]

**Barriers to Entry**:
| Barrier Type | Level | Description |
|--------------|-------|-------------|
| Capital | [high/medium/low] | [description] |
| Regulatory | [high/medium/low] | [description] |
| Technology | [high/medium/low] | [description] |
| Brand/Network | [high/medium/low] | [description] |

**Barriers to Exit**:
- Sunk costs: [high/medium/low]
- Regulatory constraints: [yes/no]
- Union/employment issues: [yes/no]
```

---

#### Agent 2D: Policy and External Variables

**Objective**: Identify key external factors affecting the industry

**Key Questions**:
- What government policies impact this industry? (subsidies, taxes, regulations)
- What macroeconomic factors matter? (interest rates, exchange rates, inflation)
- What technological disruptions are looming?
- What social or demographic trends are relevant?
- What geopolitical risks exist?

**Data to Find**:
- Relevant regulations and policy changes
- Government support or restrictions
- Macro sensitivity (interest rate, currency, commodity exposure)
- Technology disruptions
- ESG and social trends

**Sources to Prioritize**:
- Government websites and policy documents
- Regulatory filings
- Industry association policy comments
- News for recent policy changes

**Output Structure**:
```markdown
## Policy and External Variables

**Government Policies**:
| Policy | Impact | Direction | Timeline |
|--------|--------|----------|----------|
| [Policy 1] | [positive/negative/neutral] | [tightening/loosing/stable] | [immediate/gradual] |
| [Policy 2] | [impact] | [direction] | [timeline] |

**Macroeconomic Sensitivities**:
| Factor | Sensitivity | Current Trend | Impact |
|--------|-------------|---------------|--------|
| Interest Rates | [high/medium/low] | [rising/stable/falling] | [impact description] |
| Exchange Rates | [high/medium/low] | [trend] | [impact] |
| Inflation | [high/medium/low] | [trend] | [impact] |
| [Commodity] | [high/medium/low] | [trend] | [impact] |

**Technological Disruptions**:
- Disruption 1: [description] - [timing] - [impact level]
- Disruption 2: [description] - [timing] - [impact level]

**ESG/Social Trends**:
- Trend 1: [description] - [impact]
- Trend 2: [description] - [impact]

**Geopolitical Risks**:
- Risk 1: [description] - [probability] - [potential impact]
- Risk 2: [description] - [probability] - [potential impact]

**Structural vs. Cyclical Factors**:
- Structural (long-term): [factors]
- Cyclical (short-term): [factors]
```

---

### Phase 2 Synthesis

**Report Template**: `02_Industry_Analysis.md`

Include:
- Industry cycle stage with evidence
- Supply-demand outlook
- Competitive positioning map
- External risk assessment
- Investment implications based on industry cycle

---

## Phase 3: Business Breakdown (业务拆解)

### Objective

Deconstruct unit economics, operating leverage, sector-specific unit KPIs, commodity input cost sensitivities, and micro-segment market shares.

### Multi-Agent Deployment Strategy

Deploy **4 agents in parallel**:

**Primary MCP Tools for Phase 3**:
- `mcp__tijori-finance__get_operational_metrics`: Ingest complete time series of 6,000+ sector-specific unit KPIs (capacity, volumes, realizations, utilization %, ARPOB, MTPA).
- `mcp__tijori-finance__get_raw_materials`: Ingest benchmark commodity price spreads (chemicals, spreads, metals) and evaluate input margin sensitivities.
- `mcp__tijori-finance__get_market_share`: Ingest granular micro-segment market share percentages and historical as-of dates.

#### Agent 3A: Business Segment Deep Dive & Micro-Market Share

**Objective**: Detailed financial analysis of each business segment and micro-segment market share tracking using `get_market_share`.

**Key Questions**:
- What's the revenue and profit contribution of each segment?
- What are the company's estimated market share percentages across specific product micro-segments (`get_market_share`)?
- Which segments have the best margins?
- Are there cross-subsidies (profitable segments funding unprofitable ones)?

**Data to Find**:
- Segment revenue, margins, growth (5-year history)
- Micro-segment market shares and as-of dates from `get_market_share`
- Segment capital allocation (capex by segment)
- Segment ROIC

**Sources to Prioritize**:
- `mcp__tijori-finance__get_market_share`
- Annual reports (segment reporting)
- Financial statement notes

**Output Structure**:
```markdown
## Business Segment & Market Share Analysis

**Micro-Segment Market Share (from `get_market_share`)**:
| Product / Category Segment | Market Share (%) | As-of Period | Competitor Concentration / Niche Position |
| :--- | :---: | :---: | :--- |
| [Micro-Segment 1] | [%] | [As-of Date] | [Market leader / Runner-up] |
| [Micro-Segment 2] | [%] | [As-of Date] | [Consolidated / Fragmented niche] |

**Segment Financials** (Most Recent Year):
| Segment | Revenue | Growth | Gross Margin | Op Margin | ROIC |
|---------|---------|--------|--------------|-----------|------|
| [Seg 1] | [amount] | [%] | [%] | [%] | [%] |
| [Seg 2] | [amount] | [%] | [%] | [%] | [%] |
```

---

#### Agent 3B: Unit Operational KPIs & Capacity Utilization

**Objective**: Extract sector-specific unit operational KPIs, capacity additions, production volumes, and realizations using `get_operational_metrics`.

**Key Questions**:
- What are the key volume metrics (e.g. engines produced, vehicles dispatched, MTPA produced, beds occupied)?
- What is the capacity utilization % and plant efficiency trend over the last 3–5 years?
- What is the average realization per unit (e.g. ₹ per engine, ₹ per tonne, ARPOB)?
- How much operating leverage remains before new CapEx is required?

**Data to Find**:
- Unit operational KPIs time series from `get_operational_metrics`
- Unit realizations and pricing trends
- Capacity utilization rate %

**Sources to Prioritize**:
- `mcp__tijori-finance__get_operational_metrics`
- Earnings call transcripts & presentations

**Output Structure**:
```markdown
## Unit Operational KPIs & Capacity Economics (from `get_operational_metrics`)

| Operational KPI Metric | Unit | Latest Value | Latest Period | 3-Year Trajectory / Utilization Trend |
| :--- | :---: | :---: | :---: | :--- |
| **Installed Capacity** | [e.g. Units / MTPA / Beds] | [Value] | [Period] | [Expanding / Stable] |
| **Production / Sales Volume** | [Units / MT] | [Value] | [Period] | [Growth rate] |
| **Capacity Utilization** | % | [%] | [Period] | [Peak / Mid-cycle / Trough] |
| **Average Realization Per Unit** | [₹ / Unit] | [Value] | [Period] | [Pricing trend] |
```

---

#### Agent 3C: Input Commodities & Margin Sensitivities

**Objective**: Model input cost sensitivity, raw material spreads, and contractual pass-through using `get_raw_materials`.

**Key Questions**:
- What key raw materials drive the cost of goods sold (COGS)?
- How are benchmark commodity prices trending (`get_raw_materials` tabs: `chemicals`, `spreads`, `metals`)?
- What is the contractual lag for passing input cost inflation to buyers (spot vs. quarterly lag)?
- What happens to gross margin if primary raw material surges by 10%?

**Data to Find**:
- Benchmark commodity prices from `get_raw_materials`
- Gross margin historical correlation to input commodity spreads
- Raw material % of total sales

**Sources to Prioritize**:
- `mcp__tijori-finance__get_raw_materials`
- Annual report raw material consumption disclosures

**Output Structure**:
```markdown
## Raw Material Sensitivities & Commodity Spreads (from `get_raw_materials`)

| Benchmark Commodity / Spread | Current Level | 1M Trend | 1Y Trend | Gross Margin Impact & Pass-Through Mechanism |
| :--- | :---: | :---: | :---: | :--- |
| [Commodity 1 e.g. Polymer / Steel] | [Index] | [%] | [%] | [Pass-through lag: 30-90 days] |
| [Spread e.g. Rebar-Scrap / Polypropylene] | [Spread] | [%] | [%] | [100 bps spread expansion = +X bps OPM] |
```
- Does the company have pricing power?
- How are prices determined? (market-driven, cost-plus, value-based)

**Data to Find**:
- Customer retention/churn rates
- Customer acquisition vs. retention cost
- Historical pricing changes
- Customer concentration (top 5/10 customers)
- Contract structure (recurring vs. one-off)

**Output Structure**:
```markdown
## Customer and Pricing Analysis

**Customer Base**:
- Total customers: [number if disclosed]
- Customer segments: [B2B/B2C mix]
- Customer concentration: Top 5 = [X]%, Top 10 = [X]%
- Churn rate: [X]% (if disclosed)

**Customer Stickiness**:
| Factor | Level | Evidence |
|--------|-------|----------|
| Switching Costs | [high/medium/low] | [evidence] |
| Contract Length | [long/medium/short] | [evidence] |
| Renewal Rate | [%] | [source] |
| Customer Satisfaction | [high/medium/low] | [evidence] |

**Pricing Power Assessment**:
- Historical price changes: [list significant price increases/decreases]
- Price vs. competitors: [premium/parity/discount]
- Margin stability: [stable/volatile - indicates pricing power]
- Customer pushback: [high/medium/low resistance to price hikes]

**Pricing Strategy**:
- Approach: [market-driven/cost-plus/value-based/dynamic]
- Flexibility: [high/medium/low]
- Price competition intensity: [fierce/moderate/limited]
```

---

#### Agent 3D: Subsidiaries and Non-Core Items

**Objective**: Analyze non-core businesses, investments, and one-time items

**Key Questions**:
- What subsidiaries or investments does the company have?
- What's the contribution from non-operating items? (investment income, asset sales, government subsidies)
- Are there hidden assets or liabilities?
- What non-core activities could be divested?

**Data to Find**:
- List of major subsidiaries and associates
- Investment income and gains
- Asset sales and one-time gains
- Government subsidies and grants
- Non-operating items in P&L

**Output Structure**:
```markdown
## Subsidiaries and Non-Core Items

**Major Subsidiaries/Associates**:
| Entity | Business | Ownership | Contribution | Strategy |
|--------|----------|-----------|--------------|----------|
| [Sub 1] | [description] | [%] | [profit/loss] | [core/strategic/non-core] |
| [Sub 2] | [description] | [%] | [profit/loss] | [core/strategic/non-core] |

**Non-Operating Income** (Recent Year):
| Source | Amount | % of Net Income | Sustainability |
|--------|--------|-----------------|----------------|
| Investment Income | [amount] | [%] | [recurring/one-time] |
| Asset Sales | [amount] | [%] | [recurring/one-time] |
| Government Subsidies | [amount] | [%] | [recurring/declining/one-time] |
| [Other] | [amount] | [%] | [sustainability] |

**Hidden Assets**:
- Asset 1: [description] - [estimated value if available]
- Asset 2: [description] - [estimated value if available]

**Hidden Liabilities/Risks**:
- Risk 1: [description]
- Risk 2: [description]

**Core vs. Non-Core Assessment**:
- True core business profits: [amount] (excluding non-core)
- Non-core contribution to net income: [X]%
- Assessment: [core business strong/weak/non-core is critical/distraction]
```

---

### Phase 3 Synthesis

**Report Template**: `03_Business_Breakdown.md`

Include:
- One-sentence business essence
- Segment profitability matrix
- Customer economics summary
- Assessment of sustainable vs. non-sustainable profits

---

## Phase 4: Financial Quality (财务质量)

### Objective

Assess the quality of earnings, financial health, and sustainability of the business model.

### Multi-Agent Deployment Strategy

Deploy **4 agents in parallel**:

#### Agent 4A: Key Metrics and Trend Analysis

**Objective**: Calculate and analyze key financial metrics over 5-10 years

**Key Questions**:
- What are the growth rates (revenue, net income, CAGR)?
- What's the profitability (margins, ROE, ROIC)?
- How have metrics trended over time?
- Are there any inflection points or concerning trends?

**Data to Find**:
- Exact statutory quarterly income statement for the last 5 quarters [REPORTED / FILED]
- 5-10 year history of: revenue, net income, operating income, gross margin, net margin, ROE, ROIC
- Calculate CAGR (3-year, 5-year, 10-year if available)
- Volatility of metrics

**Tools to Use**:
- Primary (Indian Equities): `mcp__tijori-finance__get_financials` (10-year P&L, balance sheet, cash flows, and quarterly statements), `stock-research_screener` / `screener-mcp` (`get_quarterly_results`, `get_financials`, `search_company`, `get_peer_comparison`, `get_shareholding_pattern`)
- Cross-Validation (Global & Market Data): `stock-research_yfinance` / `yfinance-mcp` (`yfinance_get_ticker_info`, `yfinance_get_price_history`, `yfinance_get_financials`, `yfinance_get_analyst_estimates`)
- STRICTLY PROHIBITED: Citing 1-2 year old quarters as recent results, or using generic web snippets for financial tables. Always verify the latest official board meeting / filing date.
- TTM EPS Reconciliation Protocol: Subagents must compute trailing twelve months EPS as the sum of the last 4 reported quarters ($\text{TTM EPS} = \sum_{q=1}^4 \text{Quarterly EPS}$) and reconcile it with the audited annual FY statement EPS and CMP to prevent multiple distortions.

**Output Structure**:
```markdown
## Key Financial Metrics (5-10 Year History)

**TTM EPS Reconciliation**:
- Q1 EPS: [Val] | Q2 EPS: [Val] | Q3 EPS: [Val] | Q4 EPS: [Val]
- Reconciled TTM EPS: [Sum] (vs. Latest Audited Annual EPS: [FY EPS])
- TTM P/E Multiple: $\frac{\text{CMP}}{\text{TTM EPS}} = [\text{Multiple}]\text{x}$

**Growth Metrics**:
| Metric | 3Y CAGR | 5Y CAGR | 10Y CAGR | Trend |
|--------|---------|---------|----------|-------|
| Revenue | [%] | [%] | [%] | [accelerating/stable/decelerating] |
| Net Income | [%] | [%] | [%] | [trend] |
| Operating Income | [%] | [%] | [%] | [trend] |

**Profitability Metrics**:
| Metric | Latest | 5Y Avg | 10Y Avg | Trend |
|--------|--------|--------|---------|-------|
| Gross Margin | [%] | [%] | [%] | [improving/stable/declining] |
| Operating Margin | [%] | [%] | [%] | [trend] |
| Net Margin | [%] | [%] | [%] | [trend] |
| ROE | [%] | [%] | [%] | [trend] |
| ROIC | [%] | [%] | [%] | [trend] |

**DuPont Analysis (ROE Decomposition)**:
- ROE = Net Margin × Asset Turnover × Financial Leverage
- Net Margin: [%] - [trend]
- Asset Turnover: [X] - [trend]
- Financial Leverage: [X] - [trend]
- Driver of ROE changes: [which component]

**Key Inflection Points**:
- [Year]: [event/trend change] - [impact]
```

---

#### Agent 4B: Cash Flow Quality & Working Capital Forensics

**Objective**: Assess earnings quality through statutory cash flow analysis and forensic balance sheet audit

**Key Questions**:
- Do accounting earnings convert into actual cash? (OCF/NI, FCF/NI across 5-10 years)
- Has OCF turned negative in any recent fiscal year? If so, why?
- Is there a severe working capital blockage? Are trade receivables, unbilled contract assets, or retention monies growing significantly faster than revenue?
- How is the cash deficit funded? Is Cash from Financing positive solely to bridge operating cash burn?
- Are capital expenditures going into core equipment or long-gestation concession SPVs?

**Mandatory Requirements & Data to Find**:
- Extract Cash from Operations (OCF), Cash used in Investing (Capex), and Cash from Financing directly from the official statutory Cash Flow Statement (not secondary P&L summaries).
- Audit the Balance Sheet line "Other Assets" (encompassing Trade Receivables, Contract Assets, and Unbilled Revenue). If Other Assets expand significantly (e.g. >20% YoY or >50% of revenue), execute a mandatory counterparty payment delay audit.
- Compute OCF/Net Income ratio for each individual year. **Flag immediately if any single year OCF/NI < 0.8x or is negative**.
- Free Cash Flow (FCF = OCF - Capex) and FCF conversion history.
- Concession SPV capex tracking: Disaggregate capital deployed into concession SPVs (e.g. Smart Meters, HAM roads) during the installation phase before annuity onset.

**Output Structure**:
```markdown
## Cash Flow Quality Analysis

**Statutory Cash Flow Statement vs. Earnings (5-10 Year History)**:
| Year | Net Income (PAT) | OCF (Statutory) | OCF / PAT | Capex | FCF | Financing Cash Flow | Other Assets (Receivables+WIP) |
|------|------------------|-----------------|-----------|-------|-----|---------------------|--------------------------------|
| [Year] | [amount] | [amount] | [ratio] | [amount] | [amount] | [amount] | [amount] |
| [Year] | [amount] | [amount] | [ratio] | [amount] | [amount] | [amount] | [amount] |

**Forensic Cash Flow Assessment**:
- 5-Year Cumulative OCF vs. Cumulative PAT: [Cumulative OCF] vs [Cumulative PAT] ([Ratio]x)
- Single-Year Trough Check: [Did OCF turn negative in any year? Detail root cause if yes]
- Working Capital Asset Expansion: [YoY change in receivables and contract assets vs revenue growth]
- Financing Reliance: [Did gross borrowings spike to fund negative OCF or concession capex?]

**Red Flags Checklist**:
- [ ] Any year with Negative Operating Cash Flow (severe liquidity drag)
- [ ] Persistent OCF < Net Income (low quality accrual earnings)
- [ ] Working Capital Asset surge > Revenue growth (trapped unbilled receivables)
- [ ] Concession SPV capex drain before annuity operationalization
- [ ] Cash from Financing positive primarily to fund operating cash deficits
```

**Free Cash Flow Uses** (5-Year Total):
| Use | Amount | % of FCF |
|-----|--------|----------|
| Capex (maintenance) | [amount] | [%] |
| Capex (growth) | [amount] | [%] |
| Dividends | [amount] | [%] |
| Buybacks | [amount] | [%] |
| M&A | [amount] | [%] |
| Debt Repayment | [amount] | [%] |

**FCF Generation Capacity**:
- [Strong/Adequate/Weak]
- Sustainable dividend/buyback capacity: [yes/no/partially]
```

---

#### Agent 4C: Anomaly Screening (Red Flags)

**Objective**: Identify financial irregularities or accounting concerns

**Key Questions**:
- Are there any unusual items in the financials?
- Are receivables or inventory growing faster than sales?
- Are there frequent one-time items or accounting changes?
- Any related party transactions or off-balance sheet items?
- Any audit concerns or going doubt issues?

**Data to Find**:
- Receivables growth vs. revenue growth
- Inventory growth vs. revenue growth
- Non-recurring items (frequency, magnitude)
- Accounting changes or restatements
- Related party transactions
- Audit opinion (unqualified, qualified, going concern)
- Off-balance sheet items

**Output Structure**:
```markdown
## Financial Anomaly Screening

**Working Capital Trends**:
| Item | Growth (3Y) | Revenue Growth (3Y) | Delta | Assessment |
|------|------------|---------------------|-------|------------|
| Receivables | [%] | [%] | [%] | [OK/concerning] |
| Inventory | [%] | [%] | [%] | [OK/concerning] |
| Payables | [%] | [%] | [%] | [OK/concerning] |

**Red Flag Indicators**:
| Indicator | Status | Evidence | Concern Level |
|-----------|--------|----------|---------------|
| Receivables growing faster than sales | [yes/no] | [data] | [high/medium/low/n/a] |
| Inventory buildup | [yes/no] | [data] | [level] |
| Rising days sales outstanding (DSO) | [yes/no] | [data] | [level] |
| Frequent one-time items | [yes/no] | [list] | [level] |
| Accounting changes | [yes/no] | [description] | [level] |
| Related party transactions | [yes/no] | [description] | [level] |
| Audit concerns | [yes/no] | [description] | [level] |

**Accruals Analysis** (Balance Sheet Accruals):
- Accruals = (ΔCurrent Assets - ΔCash) - (ΔCurrent Liabilities - ΔShort-term Debt)
- High accruals may indicate low earnings quality

**Non-Recurring Items** (Past 3-5 Years):
| Year | Item | Amount | Impact on NI | Type |
|------|------|--------|--------------|------|
| [Year] | [item] | [amount] | [%] | [gain/charge/restructuring] |

**Overall Assessment**:
- Financial quality: [Excellent/Good/Fair/Poor]
- Red flags: [number] significant, [number] minor
- Key concern: [biggest red flag if any]
```

---

#### Agent 4D: Peer Comparison

**Objective**: Benchmark financial metrics against competitors

**Key Questions**:
- How does the company compare to peers on key metrics?
- Is it above or below average?
- Are there any significant outliers?
- What explains the differences?

**Data to Find**:
- Peer list (3-5 main competitors)
- Key metrics comparison: growth, margins, ROE, valuation multiples
- Differences in business models that explain metric differences

**Output Structure**:
```markdown
## Peer Comparison

**Peer Group**:
[Company] vs. [Peer 1], [Peer 2], [Peer 3]

**Metric Comparison** (Most Recent Year):
| Metric | [Company] | Peer Avg | Best Peer | Worst Peer | Rank |
|--------|-----------|----------|-----------|------------|------|
| Revenue Growth | [%] | [%] | [%] | [%] | [X/5] |
| Gross Margin | [%] | [%] | [%] | [%] | [X/5] |
| Operating Margin | [%] | [%] | [%] | [%] | [X/5] |
| Net Margin | [%] | [%] | [%] | [%] | [X/5] |
| ROE | [%] | [%] | [%] | [%] | [X/5] |
| ROIC | [%] | [%] | [%] | [%] | [X/5] |

**Outliers** (Significant deviations):
- [Metric]: [Company] is [better/worse] than peers by [X]pp
  - Explanation: [business model, strategy, or other factor]
- [Metric]: [Company] is [better/worse] than peers by [X]pp
  - Explanation: [reason]

**Competitive Positioning**:
- Overall financial quality: [above/at/below] peer average
- Strengths vs. peers: [list]
- Weaknesses vs. peers: [list]
```

---

### Phase 4 Synthesis

**Report Template**: `04_Financial_Quality.md`

Include:
- Financial health score (Excellent/Good/Fair/Poor)
- Cash flow quality assessment
- Red flag summary
- Peer ranking table

---

## Phase 5: Governance Analysis (股权与治理)

### Objective

Evaluate the integrity, competence, shareholder alignment, and capital allocation track record of corporate management and controlling promoters.

### Multi-Agent Deployment Strategy

Deploy **4 agents in parallel**:

#### Agent 5A: Ownership Structure & Shareholding Dynamics

**Objective**: Analyze ownership distribution, promoter pledge, and institutional flow trends for the latest filed quarter.

**Key Questions**:
- Who are the controlling shareholders and what is their effective equity stake?
- What are the latest quarterly shifts among Foreign Institutional Investors (FII) and Domestic Institutional Investors (DII)?
- Is there any promoter share pledge / encumbrance, and how has it trended over the past 8 quarters?
- Is there any government, sovereign wealth, or private equity holding?

**Data to Find**:
- Latest quarter shareholding breakdown: Promoter %, FII %, DII % (Mutual Funds, Insurance), Public %, Others %
- Historical 8-quarter shareholding trend table
- Promoter pledge: Total shares pledged and percentage of promoter holding pledged
- Top 10 non-promoter institutional shareholders and recent stake changes

**Tools to Use**:
- Primary (Indian Equities): `mcp__tijori-finance__get_shareholding` (`detailed: true`) for 10-quarter institutional trends, line-item mutual funds, LIC, retail tiers, and pledge data; `stock-research_screener` / `screener-mcp` (`get_shareholding_pattern`, `search_company`)
- Cross-Validation (Global): `stock-research_yfinance` / `yfinance-mcp` (`yfinance_get_holders`)
- Statutory Disclosures: BSE/NSE Shareholding Pattern filings under Regulation 31 of SEBI LODR / SEC Schedule 13D/G

**Mandatory Invariant**:
- $\text{Promoter} + \text{FII} + \text{DII} + \text{Public} + \text{Others} = 100.00\% \quad (\pm 0.05\% \text{ rounding threshold})$

**Output Structure**:
```markdown
## Ownership Structure & Shareholding Dynamics

**Latest Shareholding Pattern ([Latest Quarter]):**
| Category | Holding (%) | QoQ Change | 1-Year Change | Key Notable Holders |
| :--- | :---: | :---: | :---: | :--- |
| **Promoter & Promoter Group** | [%] | [%] | [%] | [Key promoters / family trusts] |
| **FII / FPI** | [%] | [%] | [%] | [Top sovereign / global funds] |
| **DII (Mutual Funds & Insurance)** | [%] | [%] | [%] | [Top domestic asset managers] |
| **Public & Retail** | [%] | [%] | [%] | [Retail investor base] |
| **Total** | **100.00%** | — | — | — |

**Promoter Pledge & Encumbrance Track Record (Statutory Exchange Audit):**
*PROHIBITED from assuming 0.00% pledge from investor decks or narrative text; must cite exact statutory percentage filed with stock exchange.*
- Current Pledged Shares: [Shares count] ([%] of promoter holding / [%] of total equity)
- Historical Peak Pledge: [%] in [Quarter/Year]
- Encumbrance Risk Level: [None (0.00%) / Low (<10%) / Moderate (10-30%) / High (>30%)]
- Trigger: If pledge > 10.0%, mandatory governance discount applied to valuation multiples.

**Institutional Float Migration & Supply Shock Radar:**
*Tracks institutional capitulation where foreign funds dump large equity blocks onto retail investors.*
- FII 2-Year Stake Trajectory: [Peak FII %] -> [Current FII %] (Net Shift: [+/- X] bps)
- Domestic Mutual Fund Absorption: [DII % shift over same period]
- Public / Retail Float Expansion: [Current Public %] (High risk if >40%-50%)
- Institutional Supply Overhang Assessment: [Severe / Moderate / Stable / Accumulation Phase]
- Impact: Flags whether low valuation multiple is driven by institutional supply liquidation rather than business insolvency.
```

---

#### Agent 5B: Management Pedigree, Market Reputation & Work Culture Engine

**Objective**: Assess executive competence, promoter vision, management reputation, organizational work culture, R&D talent attraction, and labor stability.

**Key Questions**:
- **Promoter Pedigree & Vision:** Who founded the company, what is the family/promoter background, and how has management navigated historical existential crises (e.g. JV divorces, regulatory shocks, technological pivots)?
- **Promoter vs. Professional Balance:** Is the business run as a personal promoter fiefdom, or is there an institutional promoter-professional synergy (e.g. Chairman providing strategic vision and alliances, while an empowered professional CEO drives operational execution)?
- **Market Standing & Ecosystem Goodwill:** How is the management perceived by distributors, dealers, and suppliers? Is there multi-generational channel loyalty?
- **Regulatory & Integrity Audit:** Are there any past or active inquiries by tax/regulatory agencies (IT, ED, SEBI, SEC, DOJ), and what were the outcomes/court stays?
- **Work Culture & Employee Sentiment:** What do employees say on Glassdoor, AmbitionBox, or Indeed? Is the company certified as a Great Place to Work? What are the work-life balance and job security ratings?
- **R&D & Human Capital Magnet:** Does the company possess world-class R&D infrastructure (test tracks, labs, tech centers)? Can it attract top global engineering leadership from international peers?
- **Labor Relations & Shop-Floor Harmony:** What is the industrial relations track record? Have there been strikes, lockouts, or union disputes across core manufacturing facilities?
- **Executive Remuneration & Governance:** Is executive compensation reasonable and aligned with net profit growth?

**Data to Find**:
- Key executive profiles (Chairman, CEO, CFO, CTO) and tenure
- Executive remuneration breakdown and % of Net Profit
- Employee sentiment metrics: Overall rating, Work-Life Balance, Job Security (Glassdoor/AmbitionBox)
- R&D facility scale, patent generation, and senior technical hires from global automotive/tech peers
- Strike/dispute history across manufacturing plants over the past 10 years
- Material Related-Party Transactions (RPTs) and auditor independence notes

**Tools to Use**:
- Latest Annual Report (Corporate Governance Report, Remuneration Committee Report, Business Responsibility & Sustainability Report - BRSR)
- Regulatory filings and proxy statements (SEBI LODR / SEC Form 10-K / DEF 14A)
- Glassdoor, AmbitionBox, Indeed employee sentiment databases
- Industry news archives (reputable financial media: Mint, Business Standard, Reuters, Bloomberg)

**Output Structure**:
```markdown
## Management Pedigree, Market Reputation & Work Culture Engine

**1. Promoter Heritage & Visionary Track Record:**
- Founding History & Background: [Founding lineage, entrepreneurial roots, or PSU lineage]
- Crisis Navigation Track Record: [How management survived past industry crises / technology shifts]
- Leadership Structure: [Promoter Chairman vs. Professional CEO role division and empowerment]
- Ecosystem & Dealer Loyalty: [Channel partner trust, dealer retention, vendor longevity]
- Regulatory Scrutiny Audit: [Tax/regulatory inquiry history, legal stays, and integrity assessment]

**2. Key Executive Leadership & Alignment:**
| Name | Designation | Tenure | Operational Background | Total Remuneration | % of Net Profit |
| :--- | :--- | :--- | :--- | :--- | :---: |
| [Name] | Executive Chairman | [X yrs] | [Promoter lineage / Global strategy] | [Amount] | [%] |
| [Name] | Managing Director / CEO | [X yrs] | [Corporate pedigree / Past MNC background] | [Amount] | [%] |
| [Name] | Chief Financial Officer | [X yrs] | [Financial stewardship background] | [Amount] | [%] |
| [Name] | Chief Technology Officer | [X yrs] | [R&D pedigree / Past international OEMs] | [Amount] | [%] |

**3. Corporate Work Culture & Human Capital Engine:**
| Culture Parameter | Metric / Assessment | Evidence & Verification Source |
| :--- | :---: | :--- |
| Overall Employee Rating | [X.X / 5.0 Stars] | AmbitionBox / Glassdoor (Sample size: N reviews) |
| Work-Life Balance Rating | [X.X / 5.0 Stars] | Employee feedback on workload & shifts |
| Job Security & Stability | [X.X / 5.0 Stars] | Employee retention and corporate security |
| Workplace Certification | [Certified / Not certified] | Great Place to Work Institute accreditation |
| R&D Infrastructure & Scale | [Description] | R&D campus acreage, test tracks, tech centers |
| Global Talent Attraction | [Key hires] | Influx of technical talent from global peers |
| Industrial & Union Relations | [Peaceful / Contentious] | Strike history and shop-floor dispute track record |

**4. Governance Checks:**
- Board Independence: [%] independent directors; Chairman role [separate / combined with CEO]
- Related-Party Transactions: [Clear / Requires monitoring / Material flags]
- Auditor Independence & Audit Fees: [Statutory auditor name, tenure, non-audit fee ratio]
```

---

#### Agent 5C: Capital Allocation Track Record (ROIC vs. WACC)

**Objective**: Evaluate how management has historically deployed operating cash flows and shareholder capital.

**Key Questions**:
- Does the business consistently generate Return on Invested Capital (ROIC) above its Weighted Average Cost of Capital (WACC)?
- What is management's reinvestment rate vs. cash returned to shareholders?
- What is the historical track record of mergers, acquisitions (M&A), and large greenfield capex projects?
- Have historical capital expenditures yielded anticipated returns or suffered from asset impairments?

**Data to Find**:
- 5-to-10 year trend of ROIC, ROCE, and ROE
- Cumulative 5-year Capital Allocation Waterfall:
  $$\text{Operating Cash Flow} = \text{Capex} + \text{Dividends} + \text{Share Buybacks} + \text{M\&A} + \text{Debt Reduction} \pm \Delta \text{Cash}$$
- Reinvestment Rate ($\text{Net Capex} + \Delta \text{Working Capital} / \text{NOPAT}$)
- Incremental ROIC (ROIIC) over 3-year and 5-year rolling windows

**Tools to Use**:
- Primary (Indian Equities): `mcp__tijori-finance__get_fund_flow` (cumulative sources and uses of cash across 1, 3, 5, 7, 10-year periods — NOTE: parameter represents multi-year cumulative totals, not single-year flows), `mcp__tijori-finance__get_corporate_actions` (dividends, bonus issues, buybacks), `stock-research_screener` / `screener-mcp` (`get_financials`, `get_quarterly_results`)
- Cross-Validation (Global): `stock-research_yfinance` / `yfinance-mcp` (`yfinance_get_financials`)

**Output Structure**:
```markdown
## Capital Allocation Track Record & Cumulative Fund Flows (from `get_fund_flow`)

**Multi-Year Cumulative Sources & Uses of Funds (1Y, 3Y, 5Y, 10Y):**
| Cash Flow Component | 1-Year (₹ Cr) | 3-Year (₹ Cr) | 5-Year (₹ Cr) | 10-Year (₹ Cr) | % of Total Sources |
| :--- | :---: | :---: | :---: | :---: | :---: |
| **Operating Cash Flow (Sources)** | [Val] | [Val] | [Val] | [Val] | **100.0%** |
| (-) CapEx Reinvestment (Uses) | [Val] | [Val] | [Val] | [Val] | [%] |
| (-) Dividend Payouts (Uses) | [Val] | [Val] | [Val] | [Val] | [%] |
| (-) Net Debt Reduction / (Borrowing) | [Val] | [Val] | [Val] | [Val] | [%] |
| (-) Investments / Other (Uses) | [Val] | [Val] | [Val] | [Val] | [%] |
| (=) Net Change in Cash & Equivalents | [Amount] | [%] | [Cash balance build/burn] |

**Economic Return Spread:**
- 5-Year Average ROIC: [%] vs. Estimated WACC: [%] → Economic Value Spread: [+/- bps]
```

---

#### Agent 5D: Shareholder Returns, Dilution & Overhang Risks

**Objective**: Assess dividend sustainability, historical equity dilution, and potential share overhang from unlisted shares, warrants, or large investor exits.

**Key Questions**:
- How consistent is the dividend policy and what is the current dividend yield?
- Has management diluted shareholders through excessive stock options (ESOPs), QIPs, or preferential allotments?
- Are there upcoming lock-up expirations, PE fund exit horizons, or convertible instruments?
- What is the total diluted share count history over the past 5 years?

**Data to Find**:
- 5-year share count progression (CAGR of share dilution)
- Dividend history: Dividend per share (DPS), Dividend Payout Ratio (% of PAT), Dividend Yield
- Outstanding convertible instruments, employee stock option pool (% of equity), and warrants
- Major lock-in expiration dates or stated institutional exit plans

**Tools to Use**:
- Regulatory announcements of board meetings for dividend declarations
- Share capital notes in statutory balance sheets
- `stock-research_screener` (`get_financials`) and `stock-research_yfinance` (`yfinance_get_ticker_info`)

**Output Structure**:
```markdown
## Shareholder Returns & Dilution Risk

**5-Year Equity Dilution History:**
| Year | Shares Outstanding | YoY Change (%) | Event / Dilution Vehicle |
| :---: | :---: | :---: | :--- |
| FYxx | [Count] | [%] | [ESOP allotment / QIP / Bonus] |
| FYxx | [Count] | [%] | [Base year] |

**Shareholder Return Policy:**
- Dividend Payout Policy: [Statutory % target] | Current Payout: [% of PAT]
- Current Dividend Yield: [%] at CMP
- Overhang Assessment: [No immediate overhang / Lock-in expiry on Date / PE exit anticipated]
```

---

### Phase 5 Synthesis

**Report Template**: `05_Governance_Analysis.md`

Compile findings into `05_Governance_Analysis.md` ensuring:
1. Shareholding percentages balance to 100.00%.
2. Promoter pledge status is verified from the latest filed quarterly pattern.
3. ROIC vs. WACC economic spread is quantitatively computed.
4. Overall Governance Score assigned: `[Tier-1 / Strong / Moderate / High Risk]`.

---

## Phase 6: Market Sentiment & Disagreements (市场分歧)

### Objective

Map the institutional debate, deconstruct the bull and bear cases, integrate institutional brokerage research consensus from `get_brokerage_reports`, map all historical 5%+ price swings to causal narrative catalysts via `get_price_movement_catalysts`, and establish chronological milestones from `get_company_timeline`.

### Multi-Agent Deployment Strategy

Deploy **4 agents in parallel**:

**Primary MCP Tools for Phase 6**:
- `mcp__tijori-finance__get_price_movement_catalysts`: Extract verified causal explanations and source URLs for all major daily price swings (>5%).
- `mcp__tijori-finance__get_brokerage_reports`: Extract institutional broker research notes with outlook (bullish/neutral/bearish), summary thesis, and price targets.
- `mcp__tijori-finance__get_company_timeline`: Extract chronological company milestones, management changes, and "What to watch" analyst guidance notes.
- `mcp__tijori-finance__get_stock_news`: Fetch recent real-time financial publisher headlines from Google News RSS.

#### Agent 6A: Institutional Consensus, Brokerage Research & Bull Case

**Objective**: Articulate the institutional consensus skew, broker price targets from `get_brokerage_reports`, and upside re-rating triggers.

**Key Questions**:
- What is the institutional consensus skew (% Bullish vs % Neutral vs % Bearish) among tier-1 brokerages (`get_brokerage_reports`)?
- What are the mean and median analyst price targets, and what implied upside do they offer?
- What operational triggers could cause revenue or EBITDA to beat consensus forecasts?
- Which emerging business segments or product lines are undervalued by the market?

**Sources to Prioritize**:
- `mcp__tijori-finance__get_brokerage_reports`
- Institutional equity research notes & concall transcripts

**Output Structure**:
```markdown
## Institutional Consensus & Brokerage Intelligence (from `get_brokerage_reports`)

**Institutional Brokerage Coverage & Target Price Matrix**:
| Broker / Research House | Date | Stance / Outlook | Target Price (₹) | Implied Upside vs. CMP | 2-Sentence Core Rationale |
| :--- | :---: | :---: | :---: | :---: | :--- |
| [Brokerage 1] | [Date] | [Bullish / Buy] | [Target] | [+X%] | [Summary from Perplexity] |
| [Brokerage 2] | [Date] | [Neutral / Hold] | [Target] | [+/- X%] | [Summary from Perplexity] |
| [Brokerage 3] | [Date] | [Bearish / Sell] | [Target] | [-X%] | [Summary from Perplexity] |
| **Consensus Mean** | — | **[Sentiment Skew]** | **[Mean Target]** | **[Mean Upside %]** | **[Consensus Summary]** |
```

---

#### Agent 6B: Forensic Bear Case & Downside Failure Modes

**Objective**: Formulate the strongest structural and cyclical counter-theses, downside risks, and failure modes.

**Key Questions**:
- What could cause the business model to fail or structurally decelerate?
- What raw material price surges, technological disruptions, or competitive threats exist?
- What are the financial leverage, working capital trap, or liquidity vulnerabilities?
- What would a severe recessionary stress test look like?

**Data to Find**:
- 3 to 5 distinct failure scenarios with estimated probability and financial impact
- Sensitivity of EBITDA to raw material inflation or tariff adjustments
- Debt refinancing risks under rising interest rates
- Downside valuation floor (tangible book value, trough multiple, replacement cost)

---

#### Agent 6C: Key Market Debate Points & Empirical Resolution

**Objective**: Identify the core points of contention where bulls and bears disagree, and define the exact forward metrics that will settle the debate.

**Key Questions**:
- What are the top 3 specific disagreements dividing market participants?
- What false assumptions might the market currently be pricing in?
- Which quarterly filing metrics will prove the bull case or bear case over the next 2–4 quarters?

**Output Structure**:
```markdown
## Key Market Debate Matrix

| Debate Point | Bull Perspective | Bear Perspective | Resolving Metric / Catalyst | Timeline |
| :--- | :--- | :--- | :--- | :--- |
| **1. [Topic 1]** | [Bull argument] | [Bear argument] | [Exact quarterly line-item / metric] | [Qx FYxx] |
| **2. [Topic 2]** | [Bull argument] | [Bear argument] | [Order inflow / Margin threshold] | [Qx FYxx] |
| **3. [Topic 3]** | [Bull argument] | [Bear argument] | [Capex milestone / Regulatory rule] | [Qx FYxx] |
```

---

#### Agent 6D: Causal Catalyst Timeline (3-Year) & Company Milestones

**Objective**: Construct an exhaustive chronological timeline of material price movement catalysts using `get_price_movement_catalysts`, company milestones from `get_company_timeline`, and real-time news from `get_stock_news`.

**Key Questions**:
- What caused every historical daily price movement >5% over the past 3 years (`get_price_movement_catalysts`)?
- What verified corporate events and milestones are recorded in `get_company_timeline`?
- What are the upcoming analyst guidance milestones ("What to watch")?

**Sources to Prioritize**:
- `mcp__tijori-finance__get_price_movement_catalysts`
- `mcp__tijori-finance__get_company_timeline`
- `mcp__tijori-finance__get_stock_news`

**Output Structure**:
```markdown
## 3-Year Causal Price Catalyst Log (from `get_price_movement_catalysts`)

| Date | Share Price (₹) | Movement (%) | Causal Catalyst Narrative | Primary Source Citation |
| :---: | :---: | :---: | :--- | :--- |
| [Date] | [Price] | [+X.X%] | [Verified causal driver: e.g. Q2 revenue beat, new plant announcement] | [Source URL] |
| [Date] | [Price] | [-X.X%] | [Verified causal driver: e.g. raw material spike, export ban] | [Source URL] |

**Analyst Watchlist Milestones (from `get_company_timeline`)**:
- [Milestone 1]: [Window / Timeline] — [Description of trigger]
- [Milestone 2]: [Window / Timeline] — [Description of trigger]
```

---

### Phase 6 Synthesis

**Report Template**: `06_Market_Sentiment.md` and `sources/news_timeline_2023_2026.md`.

---

## Phase 7: Valuation & Moat (估值与护城河)

### Objective

Quantify the durability of the company's competitive advantage (economic moat), benchmark statistical P/E valuation percentile bands using `get_valuation_bands`, ingest probabilistic Base/Bear/Bull forward scenario models from `get_scenario_projections`, analyze multi-quarter consensus revenue/EPS surprises via `get_earnings_intelligence`, and compute intrinsic value and margin of safety.

### Multi-Agent Deployment Strategy

Deploy **4 agents in parallel**:

**Primary MCP Tools for Phase 7**:
- `mcp__tijori-finance__get_valuation_bands`: Extract 1Y, 3Y, 5Y, 10Y daily statistical P/E percentile valuation bands (min, p25, median, p75, max) and peer multiples.
- `mcp__tijori-finance__get_scenario_projections`: Extract forward-looking Base, Bear, Bull probabilistic scenario models with odds, key drivers, and 5-year financial forecast lines.
- `mcp__tijori-finance__get_earnings_intelligence`: Extract consensus revenue/EPS surprises and diarized concall transcripts.
- `stock-research_yfinance` / `yfinance-mcp` (`yfinance_get_ticker_info`, `yfinance_get_price_history`).

#### Agent 7A: Competitive Moat Assessment (0 to 5 Rating)

**Objective**: Forensic evaluation of competitive advantages across Morningstar's five economic moat sources.

**Moat Evaluation Framework**:
1. **Intangible Assets** (Patents, regulatory licenses, brand pricing power)
2. **Switching Costs** (Embedded software, high integration costs, customer stickiness)
3. **Network Effects** (Value increases as user base scales)
4. **Cost Advantage** (Scale economies, proprietary processes, access to low-cost inputs)
5. **Efficient Scale** (Natural monopoly/oligopoly serving a limited market size)

**Moat Strength Scoring (0–5 Scale)**:
- **0 - No Moat**: Commodity producer, zero pricing power, ROIC $\le$ WACC.
- **1 - Weak Moat**: Minimal differentiation, vulnerable to competitive entry.
- **2 - Moderate Moat**: Recognizable brand or geographic advantage, transient excess returns.
- **3 - Solid Narrow Moat**: Defensible advantage likely to protect excess ROIC for 5–10 years.
- **4 - Wide Moat**: Deep structural barriers, strong pricing power, ROIC $>$ WACC for 10–20 years.
- **5 - Exceptional Wide Moat**: Irreplaceable infrastructure or monopoly asset with pricing autonomy.

---

#### Agent 7B: Relative Valuation, Synchronized Peers & Statistical Valuation Bands

**Objective**: Benchmark valuation multiples against historical percentile bands from `get_valuation_bands` and direct peers on an identical market trading date.

**Mandatory Ground Truth Tools**:
- `mcp__tijori-finance__get_valuation_bands`: Daily historical P/E percentiles (1Y, 3Y, 5Y, 10Y: min, p25, median, p75, max) and peer multiples.
- `stock-research_yfinance` / `yfinance-mcp` (`yfinance_get_ticker_info`, `yfinance_get_price_history`)
- `stock-research_screener` / `screener-mcp` (`get_peer_comparison`, `get_relative_valuation`)

**Output Structure**:
```markdown
## Relative Valuation, Peer Benchmarking & Historical Bands (from `get_valuation_bands`)

**Statistical Daily P/E Valuation Bands**:
| Time Horizon | Min P/E | 25th Percentile | Median P/E | 75th Percentile | Max P/E | Current CMP P/E | Percentile Rank |
| :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **1-Year Band** | [Min] | [p25] | [Median] | [p75] | [Max] | [P/E] | [%-tile] |
| **3-Year Band** | [Min] | [p25] | [Median] | [p75] | [Max] | [P/E] | [%-tile] |
| **5-Year Band** | [Min] | [p25] | [Median] | [p75] | [Max] | [P/E] | [%-tile] |
| **10-Year Band** | [Min] | [p25] | [Median] | [p75] | [Max] | [P/E] | [%-tile] |

*Loss-Making Days Filtered*: [Count] negative P/E days excluded.

**Synchronized Peer Comparison Matrix (As of [Trading Date]):**
| Company | CMP ([Cur]) | Market Cap ([Unit]) | TTM P/E | EV/EBITDA | P/B | ROE (%) | EBITDA Margin (%) |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **[Target Company]** | [CMP] | [MCAP] | [P/E] | [EV/EBITDA] | [P/B] | [%] | [%] |
| [Peer 1] | [CMP] | [MCAP] | [P/E] | [EV/EBITDA] | [P/B] | [%] | [%] |
| [Peer 2] | [CMP] | [MCAP] | [P/E] | [EV/EBITDA] | [P/B] | [%] | [%] |
| **Sector Median** | — | — | [Med P/E] | [Med EV/EBITDA] | [Med P/B] | [%] | [%] |
```

---

#### Agent 7C: Absolute Valuation, Reverse DCF & Consensus Surprise Record

**Objective**: Model intrinsic cash flow value, reverse-engineer market-implied growth, and track consensus surprises from `get_earnings_intelligence`.

**Data to Find**:
- Multi-quarter consensus revenue and EPS beat/miss history from `get_earnings_intelligence`
- Executive concall transcript statements
- CAPM WACC and 2-stage DCF intrinsic equity value
- Reverse DCF implied 5-year FCF growth rate

**Sources to Prioritize**:
- `mcp__tijori-finance__get_earnings_intelligence`
- Statutory cash flow statements

**Output Structure**:
```markdown
## Absolute Valuation & Consensus Surprise Track Record (from `get_earnings_intelligence`)

**Consensus Beat/Miss Track Record (Last 4 Quarters):**
| Quarter | Reported Revenue (₹ Cr) | Est Revenue (₹ Cr) | Revenue Beat (%) | Reported EPS (₹) | Est EPS (₹) | EPS Beat (%) |
| :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| [Qtr 1] | [Rev] | [Est Rev] | [+/- %] | [EPS] | [Est EPS] | [+/- %] |
| [Qtr 2] | [Rev] | [Est Rev] | [+/- %] | [EPS] | [Est EPS] | [+/- %] |
| [Qtr 3] | [Rev] | [Est Rev] | [+/- %] | [EPS] | [Est EPS] | [+/- %] |
| [Qtr 4] | [Rev] | [Est Rev] | [+/- %] | [EPS] | [Est EPS] | [+/- %] |

**DCF Value Bridge**:
- Base CAPM WACC: [X.X%] ($R_f$: [X]%, $\beta$: [X], ERP: [X]%)
- Explicit Terminal Growth ($g$): [X.X%] (capped at long-term GDP)
- Fair Value Per Share: ₹ [Value] vs. CMP: ₹ [CMP] (Margin of Safety: [+/- X%])
- Reverse DCF Implied Growth: [X.X%] required to justify CMP
```

---

#### Agent 7D: Scenario Modeling & Margin of Safety (from `get_scenario_projections`)

**Objective**: Construct probabilistic Base, Bear, and Bull scenario models using `get_scenario_projections` (or Reverse-DCF fallback when `has_projections: false`).

**Scenario Framework**:
- **Primary Source**: Ingest authentic Base, Bear, Bull probability odds and 5Y forward revenue/PAT forecast lines from `get_scenario_projections`.
- **Small-Cap Fallback (`has_projections: false`)**: When a company has no scenario model on Tijori, synthesize probabilities using Reverse-DCF implied growth and historical P/E bands from `get_valuation_bands`, labeled `[MODEL ESTIMATE - TIER B]`.
- **Normalization Rule**: Base Case Probability + Bear Case Probability + Bull Case Probability MUST equal $100.0\% \pm 1.0\%$.

**Output Structure**:
```markdown
## Probabilistic Scenario Valuation Model (from `get_scenario_projections`)

| Scenario | Probability (%) | Key Operational Drivers & Triggers | Implied Target Price (₹) | Upside / Downside vs. CMP |
| :--- | :---: | :--- | :---: | :---: |
| **Bear Case** | [Prob %] | [Negative drivers: volume degrowth, margin squeeze] | [Price] | [+/- %] |
| **Base Case** | [Prob %] | [Consensus operational expansion on schedule] | [Price] | [+/- %] |
| **Bull Case** | [Prob %] | [Accelerated realization, capacity ramp-up] | [Price] | [+/- %] |
| **Probability-Weighted EV** | **100.0%** | **Expected Value Target Price: ₹ [EV_target]** | — | **[EV_return %]** |

$$EV_{\text{target}} = (P_{\text{Bull}} \times V_{\text{Bull}}) + (P_{\text{Base}} \times V_{\text{Base}}) + (P_{\text{Bear}} \times V_{\text{Bear}})$$
$$EV_{\text{return}} = \frac{EV_{\text{target}} - \text{CMP}}{\text{CMP}} \times 100\%$$
```

---

### Phase 7 Synthesis

**Report Files Generated**:
- `07_Valuation_Moat.md`
- `Valuation/scenario_probability_model.md`
- `Valuation/dcf_analysis.md`
- `Valuation/historical_multiples.md`
- `Valuation/reverse_dcf_implied_growth.md`

---

## Phase 8: Final Synthesis & Directional Prediction Dossier

### Objective

The Lead Research Agent reconciles all findings across Phases 1 through 7, executes the **15-Point Financial Quality Assurance (FQA) Audit Gate**, generates the master executive summary (`00_Executive_Summary.md`), and executes the **Directional Forecasting Engine** (`Risk_Monitoring/directional_prediction_matrix.md`).

### Step-by-Step Lead Agent Execution

1. **Perform Line-by-Line Cross-Document Audit**:
   - Verify that CMP, Market Cap, Revenue, EBITDA, PAT, and Net Debt in `00_Executive_Summary.md` match `04_Financial_Quality.md` and `07_Valuation_Moat.md` verbatim.
2. **Execute the 15-Point FQA Audit Gate**:
   - Verify temporal freshness, reporting boundary (`[CONSOLIDATED]`), actuals vs. estimates tagging, currency units, algebraic balancing, scenario probability sum ($100\%$), concall transcript speaker/timestamp citations, and directional scoring rigor.
3. **Execute Directional Forecasting Engine**:
   - Compute Dynamic Coverage Directional Score ($S_{\text{direction}} \in [-1.0, +1.0]$):
     $$S_{\text{direction}} = \frac{\sum_{i \in \text{Active}} V_i}{|\text{Active Vectors}|}$$
   - Assign Expected Direction Verdict:
     - $S_{\text{direction}} > +0.25 \implies \text{🟢 Upward Bias}$ (Bullish Asymmetry)
     - $S_{\text{direction}} < -0.25 \implies \text{🔴 Downward Pressure}$ (Bearish Skew)
     - $-0.25 \le S_{\text{direction}} \le +0.25 \implies \text{🟡 Range-Bound}$ (Consolidation)
   - Assign Signal Light Rating:
     - `🟢🟢🟢 Buy / Attractive`: Substantial margin of safety ($\ge 20\%$), durable economic moat, clean governance, solid FCF conversion.
     - `🟡🟡🟡 Hold / Fair Value`: Fairly priced ($\pm 10\%$), balanced risk-reward, awaiting operational inflection or multiple pullback.
     - `🔴🔴 Avoid / Vulnerable`: Overvalued, declining moat, working capital stress, promoter pledge, or severe governance flags.
4. **Draft Master Documents**:
   - `00_Executive_Summary.md`: Master decision dashboard, directional stance, investment thesis.
   - `Risk_Monitoring/directional_prediction_matrix.md`: Directional score breakdown, $EV_{\text{return}}$, 3 causal up-drivers, 3 down-triggers, binary timeline milestones.
   - `README.md`: Index and navigation for the entire research directory.
   - `Risk_Monitoring/monitoring_checklist.md`: Specific quarterly checkpoints that would alter the investment thesis.

---

For execution examples demonstrating these phases, see [examples.md](examples.md).
