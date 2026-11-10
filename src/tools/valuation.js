import { z } from 'zod';
import { wrap } from './helpers.js';

export function registerValuationTools(server, { client }) {
  // 22. get_factors_and_benchmarking
  server.registerTool(
    'get_factors_and_benchmarking',
    {
      description: 'Get quantitative moat factors, radar benchmarking scores (0-10 vs peer medians), and 57 qualitative formula explanations.',
      inputSchema: { slug: z.string() },
    },
    wrap(({ slug }) => client.getFactorsAndBenchmarking(slug))
  );

  // 23. get_valuation_bands
  server.registerTool(
    'get_valuation_bands',
    {
      description: 'Get statistical valuation bands (1Y, 3Y, 5Y, 10Y P/E percentiles: min, p25, median, p75, max) and peer multiples matrix.',
      inputSchema: { slug: z.string() },
    },
    wrap(({ slug }) => client.getValuationBands(slug))
  );

  // 24. get_scenario_projections
  server.registerTool(
    'get_scenario_projections',
    {
      description: 'Get forward-looking Base, Bear, and Bull probabilistic scenarios with odds, triggers, and 5-year financial forecast models.',
      inputSchema: { slug: z.string() },
    },
    wrap(({ slug }) => client.getScenarioProjections(slug))
  );
}
