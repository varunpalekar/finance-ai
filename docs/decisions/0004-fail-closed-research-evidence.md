# 0004. Fail Closed on Unverified Research Evidence

Date: 2026-11-09
Status: Accepted

## Context

Research consumers combine Tijori company data, Perplexity market data, and analyst models. Sample reports, missing accounting bases, implicit currency assumptions, stale observations, and unsupported probabilities can produce plausible but wrong conclusions. A mathematically consistent output does not establish that its source belongs to the target company or predicts future returns.

## Decision

1. Validate company identity and requested accounting basis before returning company-specific data. Reject mismatches and unavailable statements rather than substituting other data.
2. Preserve source currency, denomination, observation date, and cache freshness. Keep unknown values null and convert only when units are known.
3. Use current observations for current valuation fields. Missing factor scores and unstructured broker targets remain null.
4. Treat provider scenario weights as assumptions, not calibrated probabilities. Do not synthesize scenario odds or probability-weighted returns without validated calibration evidence.
5. Label any uncalibrated directional score as a heuristic. Report `INSUFFICIENT_DATA` when evidence is stale, mismatched, or inadequate.
6. Maintain offline regression fixtures for these trust boundaries. Live provider behavior is not considered verified by fixture tests.

## Alternatives Considered

- Keep plausible fallbacks and add disclaimers: rejected because false values would continue entering downstream calculations.
- Remove all scenario and directional interfaces: rejected because verified source scenarios can still support explicitly conditional analysis.
- Claim prediction accuracy from mathematical consistency or in-sample fit: rejected because neither demonstrates out-of-sample predictive performance.

## Consequences

- Reports may contain more nulls and `INSUFFICIENT_DATA` results when providers omit provenance or company-specific evidence.
- Existing default financial retrieval remains consolidated, while callers can request standalone data explicitly.
- No stock prediction accuracy percentage is promised.

## Verification

Offline regression coverage is maintained in `test/scenarios.test.js`, `test/client-scrape.test.js`, `test/perplexity-parsers.test.js`, `test/perplexity-tools.test.js`, `test/valuation-bands.test.js`, `test/factors.test.js`, and `test/stock-research-executor.test.js`.
