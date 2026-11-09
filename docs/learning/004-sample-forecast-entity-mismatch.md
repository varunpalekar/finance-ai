---
id: "004"
title: "Verify entity ownership before using embedded scenario reports"
status: "Accepted"
date: 2026-11-09
supersedes: N/A
---

## Context
An offline regression fixture for a Bank of Maharashtra shareholding page contains an embedded scenario report labeled for IndiaMART. The scenario parser previously trusted the page route and could return the unrelated company's forecasts. The fixture reproduces the mismatch in `test/scenarios.test.js`; this establishes the parser behavior but does not verify how often the live provider serves such data.

## Learning / Decision
Treat embedded report labels as untrusted until they match the requested company. Reject mismatched or sample reports and return no projections; never infer or reuse a different company's forecasts.

## Rejected Alternatives
* Keep the embedded numbers and add a disclaimer: rejected because downstream tools can still use the wrong values as target-company data.
* Infer ownership from the URL alone: rejected because the fixture demonstrates that page route and embedded report identity can disagree.
