export function parseProfile(quoteRaw, descriptionRaw, ticker) {
  const fullProfile = typeof descriptionRaw === 'string'
    ? descriptionRaw
    : (typeof descriptionRaw === 'object' && descriptionRaw !== null && 'value' in descriptionRaw
        ? String(descriptionRaw.value || '')
        : '');

  return {
    ticker,
    company_name: quoteRaw?.name || null,
    exchange: quoteRaw?.exchange || null,
    price: typeof quoteRaw?.price === 'number' ? quoteRaw.price : null,
    market_cap: typeof quoteRaw?.marketCap === 'number' ? quoteRaw.marketCap : null,
    pe_ratio: typeof quoteRaw?.pe === 'number' ? quoteRaw.pe : null,
    '52_week_high': typeof quoteRaw?.yearHigh === 'number' ? quoteRaw.yearHigh : null,
    '52_week_low': typeof quoteRaw?.yearLow === 'number' ? quoteRaw.yearLow : null,
    currency: quoteRaw?.currency || null,
    strategic_summary: {
      full_profile: fullProfile
    }
  };
}
