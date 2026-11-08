---
id: "002"
title: "Perplexity Finance BSE Symbology & Numeric Scrip Cross-Resolution"
status: "Accepted"
date: 2026-11-08
supersedes: N/A
---

## Context
Perplexity Finance endpoints fail with HTTP 404 (`Quote not found`) when queried with numeric BSE 6-digit scrip codes (e.g. `500182.BO`, `532525.BO`), while symbol-based BSE tickers (`HEROMOTOCO.BO`) succeed with full quote data. In Indian equity research, users and screening pipelines frequently provide BSE 6-digit scrip codes.

## Learning / Decision
1. In `resolveTicker`, test for pure numeric input (`/^\d+$/`).
2. Query Tijori's `searchCompany(code)` which natively indexes 6-digit BSE scrip codes, returning the company record and slug.
3. Query `resolveCompanyIds(slug)` to extract the canonical NSE/BSE stock symbol (e.g. `HEROMOTOCO`).
4. Pass the resolved symbol to `PerplexityClient.normalizeTicker(symbol)` (`HEROMOTOCO.NS`), ensuring 100% resolution accuracy for BSE scrip codes without failing with 404.

## Rejected Alternatives
* Hardcoding static BSE scrip mappings in code: Rejected as unmaintainable for 5,000+ listed Indian equities.
* Rejecting numeric codes with user error: Rejected because it breaks research subagents operating with BSE codes.
