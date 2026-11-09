export function parseProfile(quoteRaw, descriptionRaw, ticker) {
  const fullProfile = typeof descriptionRaw === 'string'
    ? descriptionRaw
    : (typeof descriptionRaw === 'object' && descriptionRaw !== null && 'value' in descriptionRaw
        ? String(descriptionRaw.value || '')
        : '');

  const rawMcap = typeof quoteRaw?.marketCap === 'number' ? quoteRaw.marketCap : null;
  const currency = typeof quoteRaw?.currency === 'string' ? quoteRaw.currency.toUpperCase() : null;
  const mcapCrores = currency === 'INR' && rawMcap !== null ? Number((rawMcap / 1e7).toFixed(2)) : null;
  const quoteDate = typeof quoteRaw?.timestamp === 'number'
    ? new Date(quoteRaw.timestamp * 1000)
    : null;
  const quoteTimestamp = quoteDate && Number.isFinite(quoteDate.getTime()) ? quoteDate.toISOString() : null;

  return {
    ticker,
    company_name: quoteRaw?.name || null,
    exchange: quoteRaw?.exchange || null,
    price: typeof quoteRaw?.price === 'number' ? quoteRaw.price : null,
    market_cap: rawMcap,
    market_cap_crores: mcapCrores,
    pe_ratio: typeof quoteRaw?.pe === 'number' ? quoteRaw.pe : null,
    '52_week_high': typeof quoteRaw?.yearHigh === 'number' ? quoteRaw.yearHigh : null,
    '52_week_low': typeof quoteRaw?.yearLow === 'number' ? quoteRaw.yearLow : null,
    currency,
    denomination_scale: currency === 'INR'
      ? 'Raw INR units; market_cap_crores normalized to 1 Cr = 10,000,000 INR'
      : `${currency || 'Unknown currency'} raw units; INR crore conversion not performed`,
    quote_timestamp: quoteTimestamp,
    data_freshness: {
      fetched_at: quoteRaw?._cache_meta?.fetched_at ?? null,
      is_stale: quoteRaw?._cache_meta?.is_stale ?? null,
      is_cached: quoteRaw?._cache_meta?.is_cached ?? null,
    },
    strategic_summary: {
      full_profile: fullProfile
    }
  };
}
