# Future Enhancement Roadmap: Stock Research Executor & Tijori MCP Integration

**Date**: 2026-11-08  
**Status**: Completed & Verified in FEAT-031 (2026-11-09)  
**Reference Document**: `docs/superpowers/specs/2026-11-09-stock-research-executor-quad-mcp-design.md`  
**Target Skill**: `.agents/skills/stock-research-executor/SKILL.md`

---

## 1. Executive Summary

This document captures the strategic enhancements identified during the November 2026 Tijori MCP expansion brainstorm. Once the 8 new MCP research tools (`get_factors_and_benchmarking`, `get_valuation_bands`, `get_scenario_projections`, `get_company_timeline`, `get_stock_news`, `get_corporate_actions`, `get_supply_chain`, and enhanced `get_shareholding`) are implemented, tested, and merged into `main`, this roadmap will be executed to upgrade `.agents/skills/stock-research-executor/SKILL.md`.

These enhancements transform the research executor from a retrospective fundamental auditor into an institutional-grade **predictive fundamental forecasting engine**.

---

## 2. Phase-by-Phase Skill Enhancement Matrix

| Phase in `stock-research-executor` | Current Limitation | Proposed Upgrade | Primary MCP Tool |
| :--- | :--- | :--- | :--- |
| **Phase 1: Business Foundation** | Relies on generic narrative text for supplier and value-chain positioning. | **Systematic Value Chain Mapping**: Automatically map input products (`uses`), customer end-markets (`caters to`), and supplier addition trends. | `get_supply_chain(slug)` |
| **Phase 2: Industry & Moat Analysis** | Subjective 0–5 moat rating based on qualitative heuristics. | **Quantitative Moat Radar**: Benchmark company across 57 objective mathematical formulas against sector peer medians (Pricing Power, Value Migration, Switching Costs, Repeat Revenue). | `get_factors_and_benchmarking(slug)` |
| **Phase 3: Business Breakdown** | Does not link input raw material commodities to gross margin sensitivity. | **Raw Material Spread Sensitivity**: Correlate segment product lines with benchmark commodity price trends (e.g. Brent crude, polypropylene, steel rebar). | `get_raw_materials(tab)`, `get_supply_chain(slug)` |
| **Phase 5: Governance & Capital Allocation** | Limited to top-level Promoter/FII/DII % and 0% pledge check; no fund-level audit. | **Institutional Flow & Reinvestment Forensics**: Track line-item mutual funds (SBI MF, Kotak, LIC) accumulating or dumping over 10 quarters; audit 10-year cumulative cash sources vs uses (CapEx vs debt vs dividends). | `get_shareholding(slug, { detailed: true })`, `get_fund_flow(company_id)`, `get_corporate_actions(slug)` |
| **Phase 6: Market Sentiment & Catalyst Timeline** | Scrapes general web search snippets for recent news; misses regulatory filings. | **Verified 3-Year Catalyst Timeline**: Combine human-curated corporate milestone log (`key_events`), management operational monitorables (`what_to_watch`), and real-time financial news headlines. | `get_company_timeline(slug)`, `get_stock_news(query)` |
| **Phase 7: Valuation & Intrinsic Value** | Relies on standalone DCFs with ungrounded discount rates and arbitrary target multiples. | **Probabilistic Multi-Scenario Valuation**: Ingest Base (55–60%), Bear (25–30%), and Bull (15–20%) models with explicit catalyst triggers and FY26E–FY30E forecast lines; bound fair values within 1Y/3Y/5Y/10Y statistical P/E percentiles. | `get_scenario_projections(slug)`, `get_valuation_bands(slug)` |
| **Phase 8: Final Synthesis** | Single-point valuation target. | **Probability-Weighted Expected Value ($EV_{\text{target}}$)**: Calculate expected return across scenario probability distribution: $$EV = (P_{\text{Bull}} \times V_{\text{Bull}}) + (P_{\text{Base}} \times V_{\text{Base}}) + (P_{\text{Bear}} \times V_{\text{Bear}})$$ | Lead Agent Synthesis |

---

## 3. Concrete Implementation Steps for Future Task

When picking up this task to update `.agents/skills/stock-research-executor/SKILL.md`:

1. **Step 0 Dual-MCP Grounding Extension**:
   - Add `get_factors_and_benchmarking` and `get_valuation_bands` to the pre-execution parameter locking step.
   - Record 5-year median P/E and current P/E percentile into `Financial_Data/ground_truth.json`.
2. **Subagent Prompt Template Enhancements**:
   - **Template A (Qualitative Subagents)**: Inject `get_company_timeline` and `get_supply_chain` as mandatory tools.
   - **Template B (Quantitative Subagents)**: Inject `get_scenario_projections`, `get_valuation_bands`, and `get_shareholding({ detailed: true })`.
3. **New Mathematical Audit Gate (G13)**:
   - Add **Gate 13: Scenario Probability Normalization**: Verify that Base Case + Bear Case + Bull Case probabilities sum to 100% ($\pm 1.0\%$) and that forecast CAGR matches FY26E–FY30E geometric revenue/PAT expansion.
4. **Output Dossier Template Updates**:
   - Add `Valuation/scenario_probability_model.md` and `Valuation/factor_radar_scores.md` to `RESEARCH/STOCK_[ticker]/` output folder.

---

## 4. Prerequisite Checklist & Implementation Status

- [x] Complete implementation of 8 expanded tools in `src/client/TijoriClient.js` and `src/index.js`.
- [x] Pass full test suite (`npm test` and `npm run test:live`).
- [x] Merge expanded research tools into active codebase.
- [x] Update `docs/features.md` (`FEAT-031`) and ADR records.
- [x] Complete upgrade of `.agents/skills/stock-research-executor/` across `SKILL.md`, `instructions.md`, `phases.md`, and `examples.md` with Quad-MCP tooling, universal scale normalization, 15 QA gates, and the 4-Vector Dynamic Coverage Directional Prediction Engine.
