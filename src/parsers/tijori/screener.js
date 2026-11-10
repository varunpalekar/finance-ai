import * as cheerio from 'cheerio';

export const METRIC_MAP = {
  roe:                    'ROE',
  roce:                   'ROCE',
  debt_to_equity:         'Debt to Equity Ratio',
  'debt to equity':       'Debt to Equity Ratio',
  operating_margin:       'Operating Profit Margin',
  'operating margin':     'Operating Profit Margin',
  opm:                    'Operating Profit Margin',
  revenue_growth:         '3yr Growth Net Sales',
  sales_growth:           '3yr Growth Net Sales',
  dividend_yield:         'Dividend Yield',
  pe:                     'PE Ratio',
  pb:                     'PB Ratio',
  market_cap:             'Market Capitalization',
  'market cap':           'Market Capitalization',
  pat:                    'PAT',
  eps:                    'EPS',
  net_sales:              'Net Sales',
  revenue:                'Net Sales',
  nim:                    'Net Interest Margin',
  'net interest margin':  'Net Interest Margin',
  casa:                   'CASA Ratio',
  gross_npa:              'Gross NPA',
  net_npa:                'Net NPA',
  crar:                   'Capital Adequacy Ratio',
  npm:                    'Net Profit Margin',
  'net profit margin':    'Net Profit Margin',
  roa:                    'Return on Assets',
  roce_3yr:               '3yr Avg ROCE',
  ev_ebitda:              'EV/EBITDA',
  'price to book':        'PB Ratio',
  pat_growth:             '3yr Growth PAT',
  'pat growth':           '3yr Growth PAT',
  earnings_growth:        '3yr Growth PAT',
  current_ratio:          'Current Ratio',
  interest_coverage:      'Interest Coverage Ratio',
  fcf:                    'Free Cash Flow',
  'free cash flow':       'Free Cash Flow',
  cfo:                    'Cash from Operating Activity',
};

export const POPULAR_SECTORS = [
  'Automobiles',
  'Banking',
  'Capital Goods',
  'Chemicals',
  'Consumer Durables',
  'FMCG',
  'Healthcare',
  'IT - Software',
  'Metals & Mining',
  'Oil & Gas',
  'Pharmaceuticals',
  'Power',
  'Real Estate',
  'Telecom',
];

/**
 * Strips HTML tags (e.g. <span>) from object keys recursively.
 */
export function stripSpans(data) {
  if (Array.isArray(data)) {
    return data.map(item => stripSpans(item));
  }
  if (data !== null && typeof data === 'object') {
    const clean = {};
    for (const [k, v] of Object.entries(data)) {
      const cleanKey = k.replace(/<[^>]*>/g, '');
      clean[cleanKey] = stripSpans(v);
    }
    return clean;
  }
  return data;
}

export function safeDecode(s) {
  try {
    return decodeURIComponent(s);
  } catch {
    return String(s || '').replace(/\+/g, ' ');
  }
}

export function parseRunHref(href) {
  const qs = String(href || '').split('?')[1] ?? '';
  const params = {};
  for (const pair of qs.split('&')) {
    const i = pair.indexOf('=');
    if (i === -1) continue;
    params[safeDecode(pair.slice(0, i)).trim()] = safeDecode(pair.slice(i + 1)).replace(/\s+/g, ' ').trim();
  }
  return params;
}

export function buildQuery(filters) {
  if (typeof filters === 'string') return filters;
  if (!filters || typeof filters !== 'object') return '';

  const parts = [];
  for (const [key, condition] of Object.entries(filters)) {
    if (condition === null || condition === undefined) continue;
    const lowerKey = key.toLowerCase();
    const metricName = METRIC_MAP[lowerKey] ?? key;

    if (typeof condition === 'object') {
      if (condition.min !== undefined && Number.isFinite(Number(condition.min))) {
        parts.push(`( ${metricName} > ${condition.min} )`);
      }
      if (condition.max !== undefined && Number.isFinite(Number(condition.max))) {
        parts.push(`( ${metricName} < ${condition.max} )`);
      }
    } else if (Number.isFinite(Number(condition))) {
      // Shorthand support: { roe: 15, pe: 25 }
      // If key is a valuation multiple (pe, pb, debt_to_equity), treat scalar as max; otherwise min
      const isMaxByDefault = ['pe', 'pb', 'debt_to_equity', 'gross_npa', 'net_npa'].includes(lowerKey);
      const op = isMaxByDefault ? '<' : '>';
      parts.push(`${metricName} ${op} ${condition}`);
    }
  }
  return parts.join(' AND ');
}

export function buildScreenerQueryParams({
  filters,
  alternate,
  isChecked = false,
  whales = false,
  isSme = false,
  columns = [],
  source = 'Basic',
  queryId = null,
} = {}) {
  let financialQuery = '';
  if (typeof filters === 'string') {
    financialQuery = filters;
  } else if (filters && typeof filters === 'object') {
    financialQuery = buildQuery(filters);
  }

  return {
    financial: financialQuery,
    alternate: alternate ? alternate.trim() : '',
    aq: alternate ? alternate.trim() : '',
    is_checked: isChecked ? 'True' : 'False',
    whales: whales ? 'True' : 'False',
    is_sme: isSme ? 'True' : 'False',
    columns: Array.isArray(columns) ? columns.join(',') : (columns || ''),
    source,
    query_id: queryId ? String(queryId) : 'null',
  };
}

export function parseFilterFields(fields, { query, type } = {}) {
  if (!Array.isArray(fields)) return [];
  const wanted = type ? type.toLowerCase().trim() : null;
  const terms = query ? query.toLowerCase().trim().split(/\s+/) : [];

  return fields
    .filter(f => {
      const matchType = !wanted || (f.type && f.type.toLowerCase() === wanted);
      const val = (f.value || f.name || f.display_name || '').toLowerCase();
      const matchTerms = terms.length === 0 || terms.every(t => val.includes(t));
      return matchType && matchTerms;
    })
    .map(f => ({
      name: f.value || f.name,
      type: f.type,
      ...(f.unit ? { unit: f.unit } : {}),
      ...(f.display_name ? { display_name: f.display_name } : {}),
    }));
}

export function parsePopularScreensHtml(html) {
  const $ = cheerio.load(html);
  const found = [];
  let category = null;

  $('.popular_query_title, .query_card').each((_, el) => {
    const $el = $(el);
    if ($el.hasClass('popular_query_title')) {
      category = $el.text().trim();
      return;
    }
    const name = $el.find('.query_title, .query_name').first().text().trim();
    const description = $el.find('.query_desc').first().text().replace(/\s+/g, ' ').trim();
    const href = $el.find('a[href*="query_id"], a[href*="advanced_search"]').first().attr('href');
    if (name) {
      found.push({ category: category || 'General', name, description, href });
    }
  });

  return found.map(({ category, name, description, href }) => {
    const p = href ? parseRunHref(href) : {};
    return {
      category,
      name,
      description,
      query_id: p.query_id ?? null,
      query: p.financial || p.fq || null,
      alternate_query: p.alternate || p.aq || null,
      whales: p.whales === 'true' || p.whales === 'True',
    };
  });
}
