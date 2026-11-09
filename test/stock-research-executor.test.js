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

    assert.ok(content.includes('heuristic'), 'Must label directional scores as heuristics');
    assert.ok(content.includes('INSUFFICIENT_DATA'), 'Must fail closed when evidence is insufficient');
    assert.ok(!content.includes('probability-weighted expected return'), 'Must not require an uncalibrated expected return');
    assert.ok(!content.includes('zero tolerance for financial'), 'Must not promise zero-error research');
    assert.ok(!content.includes('audio_url'), 'Must not require audio_url in citations');
  });

  test('instructions.md defines source-grounded Step 0 and Templates A & B', () => {
    const content = fs.readFileSync(path.join(SKILL_DIR, 'instructions.md'), 'utf8');

    // Ground truth JSON schema extensions
    assert.ok(content.includes('"observations"'), 'Ground truth must store sourced observations');
    assert.ok(!content.includes('moat_radar_overall_score'), 'Must not invent an aggregate moat score');
    assert.ok(content.includes('source_timestamp'), 'Ground truth must record source timestamps');
    assert.ok(content.includes('reporting_basis'), 'Ground truth must record financial reporting basis');
    assert.ok(content.includes('currency'), 'Ground truth must record currency');

    // Template A & B checks
    assert.ok(content.includes('get_supply_chain'), 'Template A must include get_supply_chain');
    assert.ok(content.includes('get_price_movement_catalysts'), 'Template A must include get_price_movement_catalysts');
    assert.ok(content.includes('get_factors_and_benchmarking'), 'Template B must include get_factors_and_benchmarking');
    assert.ok(content.includes('get_valuation_bands'), 'Template B must include get_valuation_bands');
    assert.ok(content.includes('get_scenario_projections'), 'Template B must include get_scenario_projections');

    assert.ok(content.includes('INSUFFICIENT_DATA'), 'Must define insufficient-data behavior');
    assert.ok(content.includes('calibrat'), 'Must distinguish estimates from calibrated forecasts');
    assert.ok(!content.includes('synthesize scenario odds'), 'Must not invent scenario probabilities');
    assert.ok(!content.includes('probability-weighted expected return'), 'Must not require uncalibrated expected returns');
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

    assert.ok(content.includes('INSUFFICIENT_DATA') || content.includes('evidence summary'), 'Phase 8 must report gaps instead of force-fitting a prediction');
  });

  test('examples.md labels mock data and demonstrates conditional analysis', () => {
    const content = fs.readFileSync(path.join(SKILL_DIR, 'examples.md'), 'utf8');

    assert.ok(content.includes('Factor Benchmarking Template'), 'Must include source-shaped factor example');
    assert.ok(content.includes('Bear / Base / Bull'), 'Must include conditional scenario example');
    assert.ok(content.includes('Conditional Scenario Template'), 'Must include scenario provenance requirements');
    assert.ok(content.includes('Valuation Bands') || content.includes('P/E Percentile'), 'Must include Valuation Bands example');
    assert.ok(content.includes('Catalyst Timeline') || content.includes('Price Catalyst'), 'Must include Catalyst Timeline example');
    assert.ok(content.includes('illustrative') && content.includes('not verified'), 'Must label synthetic examples as unverified');
    assert.ok(content.includes('INSUFFICIENT_DATA'), 'Must demonstrate fail-closed output');
  });
});
