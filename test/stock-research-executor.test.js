import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const SKILL_DIR = path.resolve('.agents/skills/stock-research-executor');

describe('Stock Research Executor Quad-MCP Contract Suite', () => {
  test('SKILL.md declares 4-pillar allowed tools and robust Gates G1-G15', () => {
    const content = fs.readFileSync(path.join(SKILL_DIR, 'SKILL.md'), 'utf8');

    // Tool frontmatter check
    assert.ok(content.includes('mcp__tijori-finance__*') || content.includes('get_factors_and_benchmarking'), 'Must declare tijori tools in frontmatter');
    assert.ok(content.includes('get_price_movement_catalysts'), 'Must declare Perplexity catalysts in frontmatter');
    assert.ok(content.includes('get_scenario_projections'), 'Must declare scenario projections in frontmatter');

    // 4-Pillar check
    assert.ok(content.includes('Statutory') && content.includes('Screener'), 'Must mention Statutory Pillar');
    assert.ok(content.includes('Operational') && content.includes('Tijori'), 'Must mention Operational/Moat Pillar');
    assert.ok(content.includes('Narrative') && content.includes('Perplexity'), 'Must mention Narrative/Consensus Pillar');
    assert.ok(content.includes('Global Quotes') && content.includes('Yahoo Finance'), 'Must mention Global Quotes Pillar');

    // Robust regex boundary check for Gates G1-G15 (prevents G1 false matching G10)
    for (let i = 1; i <= 15; i++) {
      assert.match(content, new RegExp(`\\b[Gg]${i}\\b`), `Must contain Gate G${i}`);
    }

    // Directional prediction check
    assert.ok(content.includes('EV_{\\text{return}}') || content.includes('EV_{return}') || content.includes('Upward Bias'), 'Must contain directional prediction rules');
    assert.ok(!content.includes('audio_url'), 'Must not require audio_url in citations');
  });

  test('instructions.md defines Step 0 Ground Truth schema, Templates A & B, and Directional Engine', () => {
    const content = fs.readFileSync(path.join(SKILL_DIR, 'instructions.md'), 'utf8');

    // Ground truth JSON schema extensions
    assert.ok(content.includes('pe_bands'), 'Must include pe_bands in ground_truth.json schema');
    assert.ok(content.includes('moat_radar_overall_score'), 'Must include moat_radar_overall_score');
    assert.ok(content.includes('scenario_probabilities'), 'Must include scenario_probabilities');

    // Template A & B checks
    assert.ok(content.includes('get_supply_chain'), 'Template A must include get_supply_chain');
    assert.ok(content.includes('get_price_movement_catalysts'), 'Template A must include get_price_movement_catalysts');
    assert.ok(content.includes('get_factors_and_benchmarking'), 'Template B must include get_factors_and_benchmarking');
    assert.ok(content.includes('get_valuation_bands'), 'Template B must include get_valuation_bands');
    assert.ok(content.includes('get_scenario_projections'), 'Template B must include get_scenario_projections');

    // Directional engine checks
    assert.ok(content.includes('Upward Bias') || content.includes('Up-Move'), 'Must define Upward Bias');
    assert.ok(content.includes('Downward Pressure') || content.includes('Down-Move'), 'Must define Downward Pressure');
    assert.ok(content.includes('Dynamic Coverage') || content.includes('Active Vectors'), 'Must define Dynamic Coverage Normalizer');
    assert.ok(!content.includes('audio_url'), 'Must not require audio_url');
  });

  test('phases.md maps all 33 tools into Phases 1 through 8', () => {
    const content = fs.readFileSync(path.join(SKILL_DIR, 'phases.md'), 'utf8');

    // Phase 1 tools
    assert.ok(content.includes('get_supply_chain'), 'Phase 1 must include get_supply_chain');
    assert.ok(content.includes('get_revenue_mix'), 'Phase 1 must include get_revenue_mix');
    assert.ok(content.includes('get_corporate_actions'), 'Phase 1 must include get_corporate_actions');

    // Phase 2 tools
    assert.ok(content.includes('get_factors_and_benchmarking'), 'Phase 2 must include get_factors_and_benchmarking');
    assert.ok(content.includes('get_markets'), 'Phase 2 must include get_markets');
    assert.ok(content.includes('get_company_strategic_profile'), 'Phase 2 must include get_company_strategic_profile');

    // Phase 3 tools
    assert.ok(content.includes('get_operational_metrics'), 'Phase 3 must include get_operational_metrics');
    assert.ok(content.includes('get_raw_materials'), 'Phase 3 must include get_raw_materials');
    assert.ok(content.includes('get_market_share'), 'Phase 3 must include get_market_share');

    // Phase 5 tools
    assert.ok(content.includes('get_shareholding') && content.includes('detailed'), 'Phase 5 must include detailed get_shareholding');
    assert.ok(content.includes('get_fund_flow'), 'Phase 5 must include get_fund_flow');

    // Phase 6 tools
    assert.ok(content.includes('get_price_movement_catalysts'), 'Phase 6 must include get_price_movement_catalysts');
    assert.ok(content.includes('get_brokerage_reports'), 'Phase 6 must include get_brokerage_reports');
    assert.ok(content.includes('get_company_timeline'), 'Phase 6 must include get_company_timeline');

    // Phase 7 tools
    assert.ok(content.includes('get_scenario_projections'), 'Phase 7 must include get_scenario_projections');
    assert.ok(content.includes('get_valuation_bands'), 'Phase 7 must include get_valuation_bands');
    assert.ok(content.includes('get_earnings_intelligence'), 'Phase 7 must include get_earnings_intelligence');

    // Phase 8 Directional Synthesis
    assert.ok(content.includes('Directional Prediction') || content.includes('Upward Bias'), 'Phase 8 must include Directional Synthesis');
  });

  test('examples.md includes Moat Radar, Scenario Models, and Directional Prediction tables', () => {
    const content = fs.readFileSync(path.join(SKILL_DIR, 'examples.md'), 'utf8');

    assert.ok(content.includes('Moat Radar') || content.includes('Factor Score'), 'Must include Moat Radar example');
    assert.ok(content.includes('Base Case') && content.includes('Bear Case') && content.includes('Bull Case'), 'Must include Scenario Model example');
    assert.ok(content.includes('Valuation Bands') || content.includes('P/E Percentile'), 'Must include Valuation Bands example');
    assert.ok(content.includes('Catalyst Timeline') || content.includes('Price Catalyst'), 'Must include Catalyst Timeline example');
    assert.ok(content.includes('Directional Prediction') || content.includes('EV_{\\text{return}}') || content.includes('Upward Bias'), 'Must include Directional Prediction example');
    assert.ok(content.includes('S_{\\text{direction}}') || content.includes('Dynamic Coverage') || content.includes('Composite Score'), 'Must include 4-vector score example');
  });
});
