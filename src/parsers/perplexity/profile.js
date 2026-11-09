export function parseProfile(quoteRaw, descriptionRaw, ticker) {
  const fullProfile = typeof descriptionRaw === 'string'
    ? descriptionRaw
    : (typeof descriptionRaw === 'object' && descriptionRaw !== null && 'value' in descriptionRaw
        ? String(descriptionRaw.value || '')
        : '');

  const rawMcap = typeof quoteRaw?.marketCap === 'number' ? quoteRaw.marketCap : null;
  const mcapCrores = rawMcap !== null ? Number((rawMcap / 1e7).toFixed(2)) : null;

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
    currency: quoteRaw?.currency || 'INR',
    denomination_scale: 'Raw currency units (market_cap_crores normalized to 1 Cr = 1e7 INR)',
    strategic_summary: {
      full_profile: fullProfile
    }
  };
}
