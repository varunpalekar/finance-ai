import fs from 'node:fs';
import path from 'node:path';
import * as cheerio from 'cheerio';
import { get, set, clear, TTL, initDb } from '../cache.js';

const BASE_URL = 'https://www.tijorifinance.com';
const DEFAULT_LIMIT = 50;
const FIELD_RESULT_CAP = 60;

const METRIC_MAP = {
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

function buildQuery(filters) {
  const parts = [];
  for (const [key, condition] of Object.entries(filters)) {
    const metricName = METRIC_MAP[key.toLowerCase()] ?? key;
    if (condition.min !== undefined) parts.push(`( ${metricName} > ${condition.min} )`);
    if (condition.max !== undefined) parts.push(`( ${metricName} < ${condition.max} )`);
  }
  if (parts.length === 0) throw new Error('No valid filter conditions provided');
  return parts.join(' and ');
}

function safeDecode(s) {
  try { return decodeURIComponent(s); }
  catch { return s.replace(/\+/g, ' '); }
}

function parseRunHref(href) {
  const qs = href.split('?')[1] ?? '';
  const params = {};
  for (const pair of qs.split('&')) {
    const i = pair.indexOf('=');
    if (i === -1) continue;
    params[safeDecode(pair.slice(0, i)).trim()] = safeDecode(pair.slice(i + 1)).replace(/\s+/g, ' ').trim();
  }
  return params;
}

function stripSpans(results) {
  return results.map(company => {
    const clean = {};
    for (const [k, v] of Object.entries(company)) {
      clean[k.replace(/<[^>]*>/g, '')] = v;
    }
    return clean;
  });
}

function paginate({ total_results, results }, offset, limit) {
  const page = results.slice(offset, offset + limit);
  const shownThrough = offset + page.length;
  return {
    total_results,
    returned: page.length,
    ...(offset > 0 ? { offset } : {}),
    ...(shownThrough < total_results
      ? { note: `Showing rows ${offset + 1}–${shownThrough} of ${total_results}. Pass offset: ${shownThrough} for the next batch.` }
      : {}),
    results: page,
  };
}

export class TijoriClient {
  constructor({
    sessionPath = path.resolve(process.cwd(), 'output', 'session.json'),
    fetchFn = globalThis.fetch,
    cacheDbPath,
    cacheEnabled = true,
  } = {}) {
    this.sessionPath = sessionPath;
    this.fetchFn = fetchFn;
    this.cacheEnabled = cacheEnabled;
    this.baseUrl = BASE_URL;

    if (cacheDbPath) {
      initDb(cacheDbPath);
    }

    this._session = this._loadSession();
  }

  _loadSession() {
    try {
      if (fs.existsSync(this.sessionPath)) {
        const raw = fs.readFileSync(this.sessionPath, 'utf8');
        const data = JSON.parse(raw);
        const cookies = Array.isArray(data) ? data : data.cookies || [];
        const cookieHeader = cookies.map(c => `${c.name}=${c.value}`).join('; ');
        const csrfCookie = cookies.find(c => c.name === 'csrftoken');
        const csrfToken = csrfCookie?.value || '';
        return { cookieHeader, csrfToken };
      }
    } catch (_) {}
    return { cookieHeader: '', csrfToken: '' };
  }

  async _fetch(urlOrPath, options = {}) {
    const fullUrl = urlOrPath.startsWith('http') ? urlOrPath : `${this.baseUrl}${urlOrPath}`;
    const { fresh = false, cacheKey = null, headers = {}, ...restOpts } = options;

    if (this.cacheEnabled && cacheKey && !fresh) {
      const cached = get(cacheKey, { allowStale: false });
      if (cached) {
        return {
          isCached: true,
          data: cached,
        };
      }
    }

    const defaultHeaders = {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
      'Accept': 'application/json, text/html, */*',
      'Referer': `${this.baseUrl}/`,
      'Origin': this.baseUrl,
    };

    if (this._session.cookieHeader) {
      defaultHeaders['Cookie'] = this._session.cookieHeader;
    }
    if (this._session.csrfToken) {
      defaultHeaders['X-CSRFToken'] = this._session.csrfToken;
    }

    const fetchOpts = {
      ...restOpts,
      headers: { ...defaultHeaders, ...headers },
    };

    let res;
    try {
      res = await this.fetchFn(fullUrl, fetchOpts);
      if (res.status === 429) {
        await new Promise(r => setTimeout(r, 500));
        res = await this.fetchFn(fullUrl, fetchOpts);
        if (res.status === 429) {
          const err = new Error('Tijori API rate limit exceeded (HTTP 429).');
          err.code = 'RATE_LIMITED';
          err.status = 429;
          throw err;
        }
      }
    } catch (err) {
      if (err.code === 'RATE_LIMITED') throw err;
      if (this.cacheEnabled && cacheKey) {
        const stale = get(cacheKey, { allowStale: true });
        if (stale) {
          return {
            isCached: true,
            data: stale,
          };
        }
      }
      throw err;
    }

    const resUrl = res.url || '';
    if (resUrl.includes('/signin') || res.status === 401 || res.status === 403) {
      const err = new Error('Tijori session has expired. Run "npm run auth" to log in again.');
      err.code = 'SESSION_EXPIRED';
      err.status = res.status;
      throw err;
    }

    if (res.status >= 400) {
      const err = new Error(`HTTP error ${res.status} from ${fullUrl}`);
      err.status = res.status;
      throw err;
    }

    return {
      isCached: false,
      response: res,
    };
  }

  async searchCompany(query, { fresh = false } = {}) {
    const trimmed = query.toLowerCase().trim();
    const cacheKey = `search:company:${trimmed}`;

    const fetched = await this._fetch(`/api/v1/ind/company_search/?q=${encodeURIComponent(trimmed)}`, {
      cacheKey,
      fresh,
    });

    if (fetched.isCached) {
      return fetched.data;
    }

    const raw = await fetched.response.json();
    const results = (Array.isArray(raw) ? raw : [])
      .filter(item => item.type === 'companies' && item.slug && (item.name || item.company))
      .map(item => ({ name: item.name || item.company, slug: item.slug }));

    if (this.cacheEnabled) {
      set(cacheKey, results, TTL.OVERVIEW, 'json');
    }

    return results;
  }

  async resolveCompanyIds(slug, { fresh = false } = {}) {
    const cacheKey = `resolve:${slug}`;

    const fetched = await this._fetch(`/company/${slug}/`, {
      cacheKey,
      fresh,
    });

    if (fetched.isCached) {
      return fetched.data;
    }

    const html = await fetched.response.text();
    const companyIdMatch = html.match(/"company_id"\s*:\s*(\d+)/);
    const companyId = companyIdMatch ? parseInt(companyIdMatch[1], 10) : null;

    const metaMatch = html.match(/"company"\s*:\s*"([^"]+)"\s*,\s*"company_id"\s*:\s*\d+\s*,\s*"symbol"\s*:\s*"([^"]+)"/);
    const name = metaMatch ? metaMatch[1] : null;
    const symbol = metaMatch ? metaMatch[2] : null;

    const final = { slug, company_id: companyId, name, symbol };

    if (this.cacheEnabled) {
      set(cacheKey, final, TTL.PERMANENT, 'json', slug);
    }

    return final;
  }

  async getFundFlow(companyId, years, { fresh = false } = {}) {
    const validYears = [1, 3, 5, 7, 10];
    const numYears = Number(years);
    if (!validYears.includes(numYears)) {
      throw new Error(`Invalid years "${years}". Must be one of: ${validYears.join(', ')}`);
    }

    const cacheKey = `fund_flow:${companyId}:${numYears}`;

    const fetched = await this._fetch(`/api/v1/ind/fund_flow_analysis_data/${companyId}/`, {
      cacheKey,
      fresh,
    });

    if (fetched.isCached) {
      return fetched.data;
    }

    const raw = await fetched.response.json();
    const yearKey = `${numYears}yr`;
    let result;
    if (Array.isArray(raw?.data)) {
      result = {
        company_id: companyId,
        years: numYears,
        sources: raw.data.find(d => d.name === 'sources')?.data?.[yearKey] ?? [],
        uses: raw.data.find(d => d.name === 'uses')?.data?.[yearKey] ?? [],
      };
    } else {
      result = { company_id: companyId, years: numYears, raw };
    }

    if (this.cacheEnabled) {
      set(cacheKey, result, TTL.METRICS, 'json');
    }

    return result;
  }

  async getConglomerateConstituents(tjiid, { fresh = false } = {}) {
    const cacheKey = `conglomerate_constituents:${tjiid}`;

    const fetched = await this._fetch(`/api/v1/groups/price/${tjiid}/`, {
      cacheKey,
      fresh,
    });

    if (fetched.isCached) {
      return fetched.data;
    }

    const raw = await fetched.response.json();
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

    const result = { tjiid, total: companies.length, companies };

    if (this.cacheEnabled) {
      set(cacheKey, result, TTL.MARKETS, 'json');
    }

    return result;
  }

  async getNicheConstituents(tjiid, { fresh = false } = {}) {
    const cacheKey = `niche_constituents:${tjiid}`;

    const fetched = await this._fetch(`/api/v1/niche/price/${tjiid}/`, {
      cacheKey,
      fresh,
    });

    if (fetched.isCached) {
      return fetched.data;
    }

    const raw = await fetched.response.json();
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

    const result = { tjiid, total: companies.length, companies };

    if (this.cacheEnabled) {
      set(cacheKey, result, TTL.MARKETS, 'json');
    }

    return result;
  }

  async searchScreenerFields({ query, type, fresh = false } = {}) {
    if (!query?.trim()) throw new Error('query is required, e.g. "roce", "promoter holding", "npa"');

    const cacheKey = 'screener_field_catalog';
    let data;

    if (this.cacheEnabled && !fresh) {
      data = get(cacheKey, { allowStale: false });
    }

    if (!data) {
      const fetched = await this._fetch('/api/filter_queries/filter_field_search/?q=&query_type=financials', {
        cacheKey,
        fresh,
      });

      if (fetched.isCached) {
        data = fetched.data;
      } else {
        const raw = await fetched.response.json();
        data = raw?.data ?? [];
        if (data.length === 0) throw new Error('Field catalog came back empty — API may have changed');
        if (this.cacheEnabled) {
          set(cacheKey, data, TTL.FINANCIALS, 'json');
        }
      }
    }

    const wanted = type?.toLowerCase();
    const terms = query.toLowerCase().trim().split(/\s+/);
    const matches = data
      .filter(f => (!wanted || f.type.toLowerCase() === wanted) &&
                   terms.every(t => f.value.toLowerCase().includes(t)))
      .map(f => ({ name: f.value, type: f.type, ...(f.unit ? { unit: f.unit } : {}) }));

    return {
      total_matches: matches.length,
      ...(matches.length > FIELD_RESULT_CAP ? { note: `Showing first ${FIELD_RESULT_CAP} of ${matches.length}. Refine the query.` } : {}),
      fields: matches.slice(0, FIELD_RESULT_CAP),
    };
  }

  async listPopularScreens({ fresh = false } = {}) {
    const cacheKey = 'popular_screens';

    const fetched = await this._fetch('/filter/popular-queries/', {
      cacheKey,
      fresh,
    });

    if (fetched.isCached) {
      return fetched.data;
    }

    const html = await fetched.response.text();
    const $ = cheerio.load(html);
    const found = [];
    let category = null;

    $('.popular_query_title, .query_card').each((_, el) => {
      const $el = $(el);
      if ($el.hasClass('popular_query_title')) {
        category = $el.text().trim();
        return;
      }
      const name = $el.find('.query_title').text().trim();
      const description = $el.find('.query_desc').text().replace(/\s+/g, ' ').trim();
      const href = $el.find('a[href*="query_id"]').attr('href');
      if (name && href) found.push({ category, name, description, href });
    });

    const screens = found.map(({ category, name, description, href }) => {
      const p = parseRunHref(href);
      return {
        category,
        name,
        description,
        query_id: p.query_id ?? null,
        query: p.fq || null,
        alternate_query: p.aq || null,
        whales: p.whales === 'true',
      };
    });

    if (screens.length === 0) throw new Error('No popular screens found — page structure may have changed');

    if (this.cacheEnabled) {
      set(cacheKey, screens, TTL.FINANCIALS, 'json');
    }

    return screens;
  }

  async _runScreenerApi(endpoint, params) {
    const search = new URLSearchParams({
      financial: '',
      alternate: '',
      aq: '',
      is_checked: 'False',
      whales: 'False',
      is_sme: 'False',
      columns: '',
      query_id: 'null',
      ...params,
    });

    const fetched = await this._fetch(`${endpoint}?${search.toString()}`);
    let raw;
    try {
      raw = await fetched.response.json();
    } catch {
      throw new Error(`Screener API returned an error page. Query may be malformed: ${search.get('financial') || search.get('alternate')}`);
    }

    if (raw?.error) throw new Error(`Screener API error: ${raw.error}`);

    const results = stripSpans(Array.isArray(raw) ? raw : raw?.data ?? []);
    return { total_results: raw?.total_results ?? results.length, results };
  }

  async screenCompanies({
    filters,
    alternate,
    preset,
    latest_results_only = false,
    superstar_investors = false,
    sme = false,
    offset = 0,
    limit = DEFAULT_LIMIT,
    fresh = false,
  } = {}) {
    if (preset) {
      const screens = await this.listPopularScreens({ fresh });
      const needle = preset.toLowerCase().trim();
      const screen =
        screens.find(s => s.name.toLowerCase() === needle) ??
        screens.find(s => s.name.toLowerCase().includes(needle));
      if (!screen) {
        throw new Error(`No popular screen matching "${preset}". Available: ${screens.map(s => s.name).join(', ')}`);
      }

      const cacheKey = `screener:preset:${screen.name}`;
      let full;
      if (this.cacheEnabled && !fresh) {
        full = get(cacheKey, { allowStale: false });
      }

      if (!full) {
        full = await this._runScreenerApi('/api/filter_queries/popular-query/results/', {
          financial: screen.query ?? '',
          alternate: screen.alternate_query ?? '',
          whales: screen.whales ? 'True' : 'False',
          source: 'Popular',
          query_id: screen.query_id ?? 'null',
        });
        if (this.cacheEnabled) {
          set(cacheKey, full, TTL.METRICS, 'json');
        }
      }

      return { screen: screen.name, query: screen.query ?? screen.alternate_query, ...paginate(full, offset, limit) };
    }

    if (!filters && !alternate?.trim() && !superstar_investors && !sme) {
      throw new Error("Pass 'filters' (a query string like '( ROE > 15 ) and ( Market Capitalization > 500 )' or an object like { roe: { min: 15 } }), 'alternate' (a business-data query like 'market share > 50' or 'revenue from Defence > 50'), or 'preset' (a popular screen name from list_popular_screens).");
    }

    let query = '';
    if (filters !== undefined) {
      if (typeof filters === 'string') {
        query = filters.trim();
        if (!query && !alternate?.trim()) throw new Error('filters query string must not be empty');
      } else if (typeof filters === 'object') {
        query = buildQuery(filters);
      } else {
        throw new Error('filters must be a query string or object');
      }
    }
    const altQuery = alternate?.trim() ?? '';

    const cacheKey = `screener:${query}|${altQuery}|${latest_results_only}|${superstar_investors}|${sme}`;
    let full;
    if (this.cacheEnabled && !fresh) {
      full = get(cacheKey, { allowStale: false });
    }

    if (!full) {
      full = await this._runScreenerApi('/api/filter_queries/advanced_search/', {
        financial: query,
        alternate: altQuery,
        is_checked: latest_results_only ? 'True' : 'False',
        whales: superstar_investors ? 'True' : 'False',
        is_sme: sme ? 'True' : 'False',
        source: 'Basic',
      });
      if (this.cacheEnabled) {
        set(cacheKey, full, TTL.METRICS, 'json');
      }
    }

    const result = paginate(full, offset, limit);
    if (query) result.query = query;
    if (altQuery) result.alternate_query = altQuery;
    return result;
  }

  clearCache(slug = null) {
    clear(slug);
  }
}
