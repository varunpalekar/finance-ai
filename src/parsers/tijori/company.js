export function parseResolveCompanyIdsHtml(html, { slug = '' } = {}) {
  const companyIdMatch = html.match(/"company_id"\s*:\s*(\d+)/);
  const companyId = companyIdMatch ? parseInt(companyIdMatch[1], 10) : null;

  let name = null;
  let symbol = null;
  const metaMatch = html.match(/"company"\s*:\s*"([^"]+)"\s*,\s*"company_id"\s*:\s*\d+\s*,\s*"symbol"\s*:\s*"([^"]+)"/);
  if (metaMatch) {
    name = metaMatch[1];
    symbol = metaMatch[2];
  } else {
    const nameMatch = html.match(/"company"\s*:\s*"([^"]+)"/);
    const symbolMatch = html.match(/"symbol"\s*:\s*"([^"]+)"/);
    name = nameMatch ? nameMatch[1] : null;
    symbol = symbolMatch ? symbolMatch[1] : null;
  }

  return { slug, company_id: companyId, name, symbol };
}

export function parseFundFlowJson(raw, companyId, numYears) {
  const yearKey = `${numYears}yr`;
  if (Array.isArray(raw?.data)) {
    return {
      company_id: companyId,
      years: numYears,
      currency: 'INR',
      denomination: 'Crores (1 Cr = 10,000,000 INR)',
      sources: raw.data.find(d => d.name === 'sources')?.data?.[yearKey] ?? [],
      uses: raw.data.find(d => d.name === 'uses')?.data?.[yearKey] ?? [],
    };
  }
  return {
    company_id: companyId,
    years: numYears,
    currency: 'INR',
    denomination: 'Crores (1 Cr = 10,000,000 INR)',
    raw,
  };
}

export function parseConglomerateConstituentsJson(raw, tjiid) {
  const list = raw?.data ?? raw;
  if (!Array.isArray(list)) {
    throw new Error(`Unexpected response from Tijori for tjiid=${tjiid}`);
  }

  const companies = list.map(item => ({
    name: item.name,
    slug: item.slug,
    returns: {
      '1D': item.data?.[0] ?? null,
      '1W': item.data?.[1] ?? null,
      '1M': item.data?.[2] ?? null,
      '3M': item.data?.[3] ?? null,
      '6M': item.data?.[4] ?? null,
      '1Y': item.data?.[5] ?? null,
      '2Y': item.data?.[6] ?? null,
      '3Y': item.data?.[7] ?? null,
      '5Y': item.data?.[8] ?? null,
      '10Y': item.data?.[9] ?? null,
    },
  }));

  return { tjiid, total: companies.length, companies };
}

export function parseNicheConstituentsJson(raw, tjiid) {
  const list = raw?.data ?? raw;
  if (!Array.isArray(list)) {
    throw new Error(`Unexpected response from Tijori for tjiid=${tjiid}`);
  }

  const companies = list.map(item => ({
    name: item.name,
    slug: item.slug,
    weight_pct: item.weight ?? null,
    eq_weight_pct: item.eq_weight ?? null,
    returns: {
      '1D': item.data?.[0] ?? null,
      '1W': item.data?.[1] ?? null,
      '1M': item.data?.[2] ?? null,
      '3M': item.data?.[3] ?? null,
      '6M': item.data?.[4] ?? null,
      '1Y': item.data?.[5] ?? null,
      '2Y': item.data?.[6] ?? null,
      '3Y': item.data?.[7] ?? null,
      '5Y': item.data?.[8] ?? null,
      '10Y': item.data?.[9] ?? null,
    },
  }));

  return { tjiid, total: companies.length, companies };
}
