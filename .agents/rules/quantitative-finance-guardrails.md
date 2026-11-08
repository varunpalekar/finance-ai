# Quantitative Finance & Trading Research Guardrails

## 1. Information Leakage & Temporal Integrity (Zero Tolerance)
- NEVER index or shift time series features into the future (e.g., `df['close'].shift(-1)`).
- When computing rolling indicators (moving averages, volatilities, z-scores), explicitly set `min_periods` and ensure operations only aggregate historical timestamps $(-\infty, t]$.
- Train/test/validation splits MUST be strictly chronological (walk-forward or time-series splits). Never use random shuffling or standard k-fold cross-validation.
- When merging macro or alternate data (e.g., earnings releases, corporate filings, Fed rates), merge using point-in-time publication timestamps rather than effective calendar dates to prevent lookahead bias.

## 2. Market Execution & Transaction Realism
- Do not assume fills at exact closing or bid/ask midpoint prices without modeling slippage, market impact, and transaction fees (taker/maker or brokerage commissions).
- Ensure trade execution lags signal generation by at least one bar: a signal calculated at close of bar $t$ executes at open of bar $t+1$.
- Handle survivorship bias: verify that ticker universes account for delisted, merged, or acquired equities.

## 3. Numerical Precision & Code Hygiene
- Use explicit data types for financial series. Do not rely on loose Python float comparisons for currency amounts; account for floating-point inaccuracies.
- Avoid iterating rows in Pandas (`iterrows`, `itertuples`). Use vectorized NumPy/Pandas operations or Polars.
- All date/time indices must be explicitly timezone-aware (prefer UTC throughout backtests, converting to exchange-local only for market open/close checks).
- Before completing any task, run `ruff check` and type-checking via `mypy` or `pyright`. Fix any type coercion warnings.

## 4. Harness Self-Correction Protocol
- If a calculation or model implementation fails, write a minimal unit test using synthetic deterministic data (e.g., 5 rows of known prices) before running it against live or large historical datasets.
- Record any recurring model failure mode in `AGENT_LOG.md` along with its invariant constraint.

