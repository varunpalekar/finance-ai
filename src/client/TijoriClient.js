import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import * as cheerio from 'cheerio';
import { get, set, clear, TTL, initDb } from '../cache.js';
import { computePercentiles } from '../helpers.js';

const require = createRequire(import.meta.url);
const pdfParse = require('pdf-parse');

const BASE_URL = 'https://www.tijorifinance.com';
const DEFAULT_LIMIT = 50;
const FIELD_RESULT_CAP = 60;
const DEFAULT_SESSION_PATH = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../output/session.json');

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
    if (!condition || typeof condition !== 'object') continue;
    const metricName = METRIC_MAP[key.toLowerCase()] ?? key;
    if (condition.min !== undefined && Number.isFinite(Number(condition.min))) {
      parts.push(`( ${metricName} > ${condition.min} )`);
    }
    if (condition.max !== undefined && Number.isFinite(Number(condition.max))) {
      parts.push(`( ${metricName} < ${condition.max} )`);
    }
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
    sessionPath = DEFAULT_SESSION_PATH,
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

    this._sessionMtime = 0;
    this._session = { cookieHeader: '', csrfToken: '' };
    this._loadSession();
  }

  _loadSession() {
    try {
      if (fs.existsSync(this.sessionPath)) {
        const stats = fs.statSync(this.sessionPath);
        if (this._sessionMtime === stats.mtimeMs && this._session?.cookieHeader) {
          return this._session;
        }
        const raw = fs.readFileSync(this.sessionPath, 'utf8');
        const data = JSON.parse(raw);
        const cookies = Array.isArray(data) ? data : data.cookies || [];
        const cookieHeader = cookies.map(c => `${c.name}=${c.value}`).join('; ');
        const csrfCookie = cookies.find(c => c.name === 'csrftoken');
        const csrfToken = csrfCookie?.value || '';
        this._sessionMtime = stats.mtimeMs;
        this._session = { cookieHeader, csrfToken };
        return this._session;
      } else if (this._sessionMtime > 0) {
        this._sessionMtime = 0;
        this._session = { cookieHeader: '', csrfToken: '' };
        return this._session;
      }
    } catch (_) {}
    if (!this._session) {
      this._session = { cookieHeader: '', csrfToken: '' };
    }
    return this._session;
  }

  getHeaders() {
    this._loadSession();
    if (!fs.existsSync(this.sessionPath)) {
      throw new Error(`Session file not found at ${this.sessionPath}. Run "npm run auth" to log in.`);
    }
    const headers = {};
    if (this._session.cookieHeader) {
      headers['Cookie'] = this._session.cookieHeader;
    }
    if (this._session.csrfToken) {
      headers['X-CSRFToken'] = this._session.csrfToken;
    }
    return headers;
  }

  async validateSession({ probe = false } = {}) {
    if (!fs.existsSync(this.sessionPath)) {
      return {
        valid: false,
        reason: 'SESSION_MISSING',
        message: `Session file not found at ${this.sessionPath}. Run "npm run auth" to log in.`,
      };
    }

    this._loadSession();
    if (!this._session.cookieHeader || !this._session.cookieHeader.includes('sessionid=')) {
      return {
        valid: false,
        reason: 'SESSIONID_MISSING',
        message: 'No sessionid cookie found in session file. Run "npm run auth" to re-authenticate.',
      };
    }

    if (probe) {
      try {
        const res = await this.fetchFn(`${this.baseUrl}/alerts/`, {
          signal: AbortSignal.timeout(4000),
          redirect: 'manual',
          headers: {
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
            'Referer': `${this.baseUrl}/`,
            'Cookie': this._session.cookieHeader,
          },
        });
        const loc = res.headers?.get?.('location') || res.url || '';
        if ((res.status === 302 && loc.includes('/signin')) || res.status === 401 || res.status === 403) {
          return {
            valid: false,
            reason: 'NOT_AUTHENTICATED',
            message: 'Tijori session is unauthenticated / guest session. Run "npm run auth" to log in.',
          };
        }
      } catch (_) {
        return {
          valid: true,
          offline: true,
          message: 'Offline or sandboxed — operating without live probe.',
        };
      }
    }

    return { valid: true };
  }

  async getUserInfo({ fresh = false } = {}) {
    const cacheKey = 'user:profile_info';
    if (this.cacheEnabled && !fresh) {
      const cached = get(cacheKey, { allowStale: false });
      if (cached) return cached;
    }

    const fetched = await this._fetch('/account/subscription/', { cacheKey, fresh });
    if (fetched.isCached) return fetched.data;

    const html = await fetched.response.text();
    const isAuthMatch = html.match(/is_authenticated:\s*(true|false)/i);
    const isAuthenticated = isAuthMatch ? isAuthMatch[1].toLowerCase() === 'true' : false;

    const planTierMatch = html.match(/window\.clarity\("set",\s*"plan_tier",\s*"([^"]+)"\)/i);
    const planTier = planTierMatch ? planTierMatch[1] : (isAuthenticated ? 'free' : 'anonymous');

    const emailMatch = html.match(/["']?(?:email|user_email)["']?\s*[:=]\s*["']([^"'\s]+@[^"'\s]+)["']/i);
    const email = emailMatch ? emailMatch[1] : null;

    const usernameMatch = html.match(/["']?(?:username|user_name|client_id)["']?\s*[:=]\s*["']([^"'\s]{3,30})["']/i);
    const username = usernameMatch ? usernameMatch[1] : null;

    const result = {
      is_authenticated: isAuthenticated,
      plan_tier: planTier,
      session_type: isAuthenticated ? 'authenticated' : 'anonymous_guest',
      email: email,
      username: username,
    };

    if (this.cacheEnabled && isAuthenticated) {
      set(cacheKey, result, TTL.FINANCIALS, 'json');
    }

    return result;
  }

  async _fetch(urlOrPath, options = {}) {
    const fullUrl = urlOrPath.startsWith('http') ? urlOrPath : `${this.baseUrl}${urlOrPath}`;
    const { fresh = false, cacheKey = null, headers = {}, signal = options.signal ?? AbortSignal.timeout(15000), ...restOpts } = options;

    if (this.cacheEnabled && cacheKey && !fresh) {
      const cached = get(cacheKey, { allowStale: false });
      if (cached) {
        return {
          isCached: true,
          data: cached,
        };
      }
    }

    this._loadSession();

    const defaultHeaders = {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
      'Accept': 'application/json, text/html, */*',
    };

    const hostname = fullUrl.startsWith('http') ? new URL(fullUrl).hostname : '';
    const isTijoriHost = !fullUrl.startsWith('http') || hostname === 'tijorifinance.com' || hostname.endsWith('.tijorifinance.com');

    if (isTijoriHost) {
      defaultHeaders['Referer'] = `${this.baseUrl}/`;
      defaultHeaders['Origin'] = this.baseUrl;
      if (this._session.cookieHeader) {
        defaultHeaders['Cookie'] = this._session.cookieHeader;
      }
      if (this._session.csrfToken) {
        defaultHeaders['X-CSRFToken'] = this._session.csrfToken;
      }
    }

    const fetchOpts = {
      ...restOpts,
      signal,
      headers: { ...defaultHeaders, ...headers },
    };

    let res;
    try {
      res = await this.fetchFn(fullUrl, fetchOpts);
      if (res.status === 429) {
        await new Promise(r => setTimeout(r, 500));
        res = await this.fetchFn(fullUrl, fetchOpts);
        if (res.status === 429) {
          const err = new Error(isTijoriHost ? 'Tijori API rate limit exceeded (HTTP 429).' : `Upstream rate limit exceeded (HTTP 429) from ${fullUrl}`);
          err.code = 'RATE_LIMITED';
          err.status = 429;
          throw err;
        }
      }
      if (res.status >= 500) {
        const err = new Error(`HTTP error ${res.status} from ${fullUrl}`);
        err.status = res.status;
        throw err;
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
    if (isTijoriHost && (resUrl.includes('/signin') || res.status === 401 || res.status === 403)) {
      this._sessionMtime = 0;
      this._session = { cookieHeader: '', csrfToken: '' };
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

    const final = { slug, company_id: companyId, name, symbol };

    if (this.cacheEnabled && companyId !== null) {
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
        currency: 'INR',
        denomination: 'Crores (1 Cr = 10,000,000 INR)',
        sources: raw.data.find(d => d.name === 'sources')?.data?.[yearKey] ?? [],
        uses: raw.data.find(d => d.name === 'uses')?.data?.[yearKey] ?? [],
      };
    } else {
      result = {
        company_id: companyId,
        years: numYears,
        currency: 'INR',
        denomination: 'Crores (1 Cr = 10,000,000 INR)',
        raw
      };
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

  async getSectorConstituents(tjiid, opts) {
    return this.getNicheConstituents(tjiid, opts);
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

    if (this.cacheEnabled && !fresh) {
      const cached = get(cacheKey, { allowStale: false });
      if (cached) return cached;
    }

    // 1. Direct REST endpoint
    try {
      const fetched = await this._fetch('/api/filter_queries/popular-query/', { cacheKey, fresh });
      if (fetched.isCached) return fetched.data;
      const data = await fetched.response.json();
      if (data && typeof data === 'object' && Object.keys(data).length > 0) {
        const screens = [];
        for (const [category, items] of Object.entries(data)) {
          if (Array.isArray(items)) {
            for (const item of items) {
              screens.push({
                category: item.group || category,
                name: item.name,
                description: item.description ? item.description.replace(/\s+/g, ' ').trim() : '',
                query_id: item.id ?? null,
                query: item.financial_query ? item.financial_query.replace(/\r\n/g, ' ').replace(/\s+/g, ' ').trim() : null,
                alternate_query: item.alt_query ? item.alt_query.replace(/\r\n/g, ' ').replace(/\s+/g, ' ').trim() : null,
                whales: Boolean(item.whales),
              });
            }
          }
        }
        if (screens.length > 0) {
          if (this.cacheEnabled) {
            set(cacheKey, screens, TTL.FINANCIALS, 'json');
          }
          return screens;
        }
      }
    } catch (_) {}

    // 2. Fallback to HTML table/card scraping
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

  async _runScreenerApi(endpoint, params, { cacheKey } = {}) {
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

    const fetched = await this._fetch(`${endpoint}?${search.toString()}`, { cacheKey });
    if (fetched.isCached) {
      return fetched.data;
    }

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
        }, { cacheKey });
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
      }, { cacheKey });
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

  async getCompanyOverview(slug, { fresh = false } = {}) {
    const cacheKey = `overview:${slug}`;

    const fetched = await this._fetch(`/company/${slug}/`, {
      cacheKey,
      fresh,
    });

    if (fetched.isCached) {
      return fetched.data;
    }

    const html = await fetched.response.text();
    const $ = cheerio.load(html);
    const result = { slug };

    $('script:not([src])').each((_, s) => {
      const text = $(s).text().trim();
      if (text.includes('company_id') && text.startsWith('{')) {
        try {
          const parsed = JSON.parse(text);
          const { company, company_id, symbol, shortname, slug: sSlug, ind_code, is_banking, mcap, pe, mcap_raw } = parsed;
          const rawMcapVal = typeof mcap_raw === 'number'
            ? mcap_raw
            : (typeof mcap === 'number'
                ? mcap
                : (typeof mcap === 'string'
                    ? parseFloat(mcap.replace(/[^\d.]/g, '')) || null
                    : null));
          const mcapCrores = rawMcapVal !== null && !isNaN(rawMcapVal) ? rawMcapVal : null;
          const mcapInr = mcapCrores !== null ? Math.round(mcapCrores * 1e7) : null;

          Object.assign(result, {
            company,
            company_id,
            symbol,
            shortname,
            slug: sSlug || slug,
            ind_code,
            is_banking,
            mcap,
            mcap_raw: rawMcapVal,
            mcap_crores: mcapCrores,
            mcap_inr: mcapInr,
            currency: 'INR',
            denomination_scale: 'Crores (1 Cr = 10,000,000 INR)',
            pe
          });
          if (parsed.quick_look) result.quick_look = parsed.quick_look;
        } catch (_) {}
      }
    });

    if (!result.currency) {
      result.currency = 'INR';
      result.denomination_scale = 'Crores (1 Cr = 10,000,000 INR)';
    }

    const ratios = {};
    $('.custom_ratio').each((_, el) => {
      const label = $(el).find('.custom_ratio__field_name').text().trim();
      const value = $(el).find('.custom_ratio__field_value').text().trim().replace(/\s+/g, ' ');
      if (label && value) {
        ratios[label] = value;
      }
    });
    if (Object.keys(ratios).length > 0) result.ratios = ratios;

    const msCards = [];
    $('.market_share_card').each((_, card) => {
      const title = $(card).attr('data-title') || $(card).find('.name').text().trim();
      const value = $(card).find('.values > div:first-child').text().trim() || null;
      const asof = $(card).find('.asof').text().trim().replace(/[()]/g, '').trim() || null;
      if (title) {
        msCards.push({ metric: title, value, as_of: asof });
      }
    });
    if (msCards.length > 0) result.market_share = msCards;

    const pieCharts = [];
    $('.rmix_pie_chart[chart-data]').each((_, el) => {
      const title = $(el).closest('.charts_cont').find('h4').text().trim() || null;
      try {
        const segments = JSON.parse($(el).attr('chart-data') || '[]');
        const parsed = segments.map(([name, pct]) => ({ name, pct: Math.round(pct * 10) / 10 }));
        if (parsed.length > 0) {
          pieCharts.push({ title, segments: parsed });
        }
      } catch (_) {}
    });
    if (pieCharts.length > 0) result.revenue_mix = pieCharts;

    if (!result.company) {
      const title = $('title').text() || '';
      result.company = title.split('|')[0].trim();
    }

    if (this.cacheEnabled) {
      set(cacheKey, result, TTL.OVERVIEW, 'json', slug);
    }

    return result;
  }

  async getFinancials(slug, type = 'pl', { fresh = false, basis = 'consolidated' } = {}) {
    const TYPE_TO_SECTION = {
      pl: { section: 'profit_and_loss', label: 'P&L' },
      bs: { section: 'balance_sheet', label: 'balance sheet' },
      cf: { section: 'cash_flow', label: 'cash flow' },
      ratios: { section: 'ratios', label: 'ratios' },
      quarterly: { section: 'quarterly_results', label: 'quarterly results' },
    };
    const typeInfo = TYPE_TO_SECTION[type];
    if (!typeInfo) throw new Error(`Unsupported financial statement type: ${type}`);
    if (!['consolidated', 'standalone'].includes(basis)) {
      throw new Error(`Unsupported reporting basis: ${basis}`);
    }

    const sectionId = typeInfo.section;
    const cacheKey = `financials:v2:${slug}:${type}:${basis}`;
    const unavailable = () => {
      throw new Error(`Requested ${basis} ${typeInfo.label} statement is unavailable for ${slug}`);
    };

    const fetched = await this._fetch(`/company/${slug}/financials/`, {
      cacheKey,
      fresh,
    });

    if (fetched.isCached) {
      if (fetched.data.reporting_basis !== basis || fetched.data.type !== type) {
        return unavailable();
      }
      return fetched.data;
    }

    const html = await fetched.response.text();
    const $ = cheerio.load(html);

    // 1. Try extracting from embedded JSON script blob (Tijori SSR pattern)
    let embeddedData = null;
    $('script:not([src])').each((_, s) => {
      const text = $(s).text().trim();
      if (text.startsWith('{"bs_s_s"') || (text.includes('"report_dates"') && text.includes('"data"'))) {
        try {
          embeddedData = JSON.parse(text);
          return false;
        } catch (_) {}
      }
    });

    if (embeddedData) {
      let section = null;
      const basisKey = basis === 'consolidated' ? 'c' : 's';
      const keys = type === 'pl' || type === 'bs'
        ? [`${type}_${basisKey}_s`, `${type}_${basisKey}_d`]
        : [{
            cf: `cf_${basisKey}`,
            ratios: `fr_${basisKey}`,
            quarterly: `qt_${basisKey}`,
          }[type]];
      section = keys.map(key => embeddedData[key]).find(Boolean) || null;

      if (section && section.report_dates && Array.isArray(section.data)) {
        const periodHeaders = section.report_dates;
        const rows = [];
        const appendRows = (items, parentHierarchy = []) => {
          for (const item of items) {
            const hierarchy = [...parentHierarchy, item.name];
            const row = { metric: item.name, hierarchy };
            (Array.isArray(item.value) ? item.value : []).forEach((val, i) => {
              const h = periodHeaders[i];
              if (h) {
                row[h] = val === null || val === undefined ? null : String(val);
              }
            });
            rows.push(row);
            if (Array.isArray(item.sub_section)) {
              appendRows(item.sub_section, hierarchy);
            }
          }
        };
        appendRows(section.data);

        const result = {
          type,
          reporting_basis: basis,
          currency: 'INR',
          denomination: 'Crores (1 Cr = 10,000,000 INR)',
          notes: 'Amounts in ₹ Crores, ratios in %, EPS in INR per share.',
          headers: ['metric', ...periodHeaders],
          rows
        };
        if (this.cacheEnabled) {
          set(cacheKey, result, TTL.FINANCIALS, 'json', slug);
        }
        return result;
      }
    }

    const wrapper = $(`#${sectionId}_table_wrapper`).first().length
      ? $(`#${sectionId}_table_wrapper`).first()
      : $(`#company_table_innertab_${sectionId}_content .dt-container`).first();
    if (!wrapper.length) unavailable();

    const declaredBasis = wrapper.attr('data-reporting-basis');
    const activeBasis = ['consolidated', 'standalone'].find(value =>
      $(`[data-toggle="${value}"].active, [data-toggle="${value}"][aria-selected="true"]`).length > 0
    );
    if ((declaredBasis && declaredBasis !== basis) || (!declaredBasis && activeBasis !== basis)) {
      unavailable();
    }

    // Parse only the requested statement container; never substitute another table.
    const periodHeaders = [];
    wrapper.find('thead th.headerItem, thead th').each((_, th) => {
      const t = $(th).text().trim();
      if (t && !$(th).hasClass('firstcol') && !$(th).hasClass('compare_col')) {
        periodHeaders.push(t);
      }
    });

    const rows = [];
    wrapper.find('tbody tr').each((_, tr) => {
      const label = $(tr).attr('data-id') || $(tr).find('td.firstcol, th:first-child').text().trim();
      if (!label) return;

      const valueCells = $(tr).find('td.knowledge.numericvalue, td.numericvalue');
      const cells = valueCells.length ? valueCells : $(tr).find('td:not(.firstcol):not(.compare_col)');
      const values = [];

      cells.each((_, td) => {
        const raw = $(td).text().trim().replace(/\s+/g, ' ');
        values.push(raw === '—' || raw === '-' || raw === '' ? null : raw);
      });

      const row = { metric: label };
      values.forEach((val, i) => {
        const header = periodHeaders[i];
        if (header) row[header] = val;
      });
      rows.push(row);
    });

    if (periodHeaders.length === 0 || rows.length === 0) unavailable();

    const result = {
      type,
      reporting_basis: basis,
      currency: 'INR',
      denomination: 'Crores (1 Cr = 10,000,000 INR)',
      notes: `Amounts in ₹ Crores, ratios in %, EPS in INR per share. Reporting basis: ${basis}.`,
      headers: ['metric', ...periodHeaders],
      rows
    };

    if (this.cacheEnabled) {
      set(cacheKey, result, TTL.FINANCIALS, 'json', slug);
    }

    return result;
  }

  async getShareholding(slug, { detailed = false, fresh = false } = {}) {
    const isDetailed = Boolean(detailed);
    const cacheKey = isDetailed ? `shareholding_detailed:${slug}` : `shareholding:${slug}`;

    const fetched = await this._fetch(`/company/${slug}/shareholding/`, {
      cacheKey,
      fresh,
    });

    if (fetched.isCached) {
      return fetched.data;
    }

    const html = await fetched.response.text();
    const $ = cheerio.load(html);

    let bestTable = null;
    let bestColCount = 0;

    $('table').each((_, tbl) => {
      const text = $(tbl).text().toLowerCase();
      const hasSh = text.includes('promoter') && (text.includes('public') || text.includes('fii') || text.includes('foreign') || text.includes('institutions'));
      if (!hasSh) return;

      const colCount = $(tbl).find('tr:first-child th, tr:first-child td').length;
      if (colCount > bestColCount) {
        bestColCount = colCount;
        bestTable = $(tbl);
      }
    });

    if (!bestTable) {
      return { quarters: [], error: 'Shareholding table not found' };
    }

    const trs = bestTable.find('tr');
    if (trs.length < 2) {
      return { quarters: [], error: 'Table has too few rows' };
    }

    const headerCells = [];
    trs.first().find('th, td').each((_, td) => headerCells.push($(td).text().trim()));
    const quarterPeriods = headerCells.slice(1).filter(Boolean);

    if (!isDetailed) {
      const quarterMap = {};
      quarterPeriods.forEach(p => { quarterMap[p] = { period: p }; });

      trs.slice(1).each((_, tr) => {
        const cells = [];
        $(tr).find('td, th').each((_, td) => cells.push($(td).text().trim()));
        if (cells.length < 2) return;
        const category = cells[0];
        if (!category) return;

        cells.slice(1).forEach((val, idx) => {
          const period = quarterPeriods[idx];
          if (!period) return;
          const cleaned = val.replace('%', '').trim();
          if (cleaned === '—' || cleaned === '-' || cleaned === '' || cleaned === '–') {
            quarterMap[period][category] = null;
          } else {
            const num = parseFloat(cleaned.replace(/,/g, ''));
            quarterMap[period][category] = isNaN(num) ? val : num;
          }
        });
      });

      const quarters = Object.values(quarterMap).filter(q => Object.keys(q).length > 1);
      const result = { quarters };

      if (this.cacheEnabled) {
        set(cacheKey, result, TTL.SHAREHOLDING || TTL.FINANCIALS, 'json', slug);
      }

      return result;
    }

    const summaryRows = [];
    const institutions = [];
    const nonInstitutions = [];
    let currentSection = 'summary';

    trs.slice(1).each((_, tr) => {
      const cells = [];
      $(tr).find('td, th').each((_, td) => cells.push($(td).text().trim().replace(/\s+/g, ' ')));
      if (cells.length < 2) return;
      const name = cells[0];
      if (!name) return;

      const lowerName = name.toLowerCase();
      if (lowerName === 'institutions') {
        currentSection = 'institutions';
      } else if (lowerName === 'non-institutions') {
        currentSection = 'non_institutions';
      }

      const values = [];
      cells.slice(1).forEach((val, idx) => {
        if (idx >= quarterPeriods.length) return;
        const cleaned = val.replace('%', '').trim();
        if (cleaned === '—' || cleaned === '-' || cleaned === '' || cleaned === '–') {
          values.push(null);
        } else {
          const num = parseFloat(cleaned.replace(/,/g, ''));
          values.push(isNaN(num) ? val : num);
        }
      });

      const rowObj = {
        name,
        shares_pct: values,
      };

      if (currentSection === 'institutions' && lowerName !== 'institutions') {
        institutions.push(rowObj);
      } else if (currentSection === 'non_institutions' && lowerName !== 'non-institutions') {
        nonInstitutions.push(rowObj);
      } else {
        summaryRows.push(rowObj);
      }
    });

    const result = {
      slug,
      detailed: true,
      quarters: quarterPeriods,
      summary: summaryRows,
      institutions,
      non_institutions: nonInstitutions,
    };

    if (this.cacheEnabled) {
      set(cacheKey, result, TTL.SHAREHOLDING || TTL.FINANCIALS, 'json', slug);
    }

    return result;
  }

  _extractSectionTable(html, sectionId) {
    const $ = cheerio.load(html);
    const section = $(`#${sectionId}`);
    const container = section.length ? section : $('body');

    const headTable = container.find('.dt-scroll-head table, .dataTables_scrollHead table, thead');
    const allHeadCells = [];
    const targetHeads = headTable.length ? headTable.find('thead th, thead td') : container.find('thead th, thead td');
    targetHeads.each((_, th) => {
      const t = $(th).text().trim();
      if (t) allHeadCells.push(t);
    });

    const periodHeaders = allHeadCells.filter(h => h.length > 0 && h.toLowerCase() !== 'metric' && h.toLowerCase() !== 'name');

    const bodyTable = container.find('.dt-scroll-body table, .dataTables_scrollBody table, table');
    const rows = [];

    bodyTable.find('tbody tr').each((_, tr) => {
      const labelDiv = $(tr).find('.nameofmetriccol');
      const firstCol = $(tr).find('.firstcol, td:first-child');
      const label = labelDiv.text().trim() || firstCol.find('a').text().trim() || firstCol.text().trim();
      if (!label) return;

      const unit = labelDiv.attr('data-unit') || null;
      const parentAttr = $(tr).attr('parent');
      const depth = parentAttr !== undefined && parentAttr !== null ? parseInt(parentAttr, 10) : null;

      const dataCells = $(tr).find('td.numericvalue, td.knowledge.numericvalue');
      const cells = dataCells.length ? dataCells : $(tr).find('td').slice(1);
      const values = [];

      cells.each((_, td) => {
        const raw = $(td).text().trim().replace(/\s+/g, ' ');
        values.push(raw === '—' || raw === '-' || raw === '' ? null : raw);
      });

      const row = { metric: label };
      if (unit) row.unit = unit;
      if (depth !== null && !isNaN(depth)) row.depth = depth;

      values.forEach((val, i) => {
        const header = periodHeaders[i];
        if (header) row[header] = val;
      });

      rows.push(row);
    });

    return { headers: ['metric', ...periodHeaders], rows };
  }

  async getRawMaterials(tab, { fresh = false } = {}) {
    const valid = ['chemicals', 'spreads', 'metals'];
    if (!valid.includes(tab)) {
      throw new Error(`Invalid tab "${tab}". Must be: ${valid.join(', ')}`);
    }

    const cacheKey = `raw_materials:${tab}`;
    const fetched = await this._fetch('/in/raw-materials', {
      cacheKey,
      fresh,
    });

    if (fetched.isCached) {
      return fetched.data;
    }

    const html = await fetched.response.text();
    const result = this._extractSectionTable(html, tab);

    if (this.cacheEnabled) {
      set(cacheKey, result, TTL.COMMODITY, 'json');
    }

    return result;
  }

  async getMacroIndicators(tab, { fresh = false } = {}) {
    const valid = ['industry', 'demand', 'gdp'];
    if (!valid.includes(tab)) {
      throw new Error(`Invalid tab "${tab}". Must be: ${valid.join(', ')}`);
    }

    const cacheKey = `macro:${tab}`;
    const fetched = await this._fetch('/in/macro', {
      cacheKey,
      fresh,
    });

    if (fetched.isCached) {
      return fetched.data;
    }

    const html = await fetched.response.text();
    const result = this._extractSectionTable(html, tab);

    if (this.cacheEnabled) {
      set(cacheKey, result, TTL.COMMODITY, 'json');
    }

    return result;
  }

  async getMarkets(tab, { fresh = false } = {}) {
    const valid = ['headline', 'niche', 'conglomerates'];
    if (!valid.includes(tab)) {
      throw new Error(`Invalid tab "${tab}". Must be: ${valid.join(', ')}`);
    }

    const cacheKey = `markets:${tab}`;
    const fetched = await this._fetch('/in/markets', {
      cacheKey,
      fresh,
    });

    if (fetched.isCached) {
      return fetched.data;
    }

    const html = await fetched.response.text();
    const $ = cheerio.load(html);
    let result;

    if (tab === 'conglomerates') {
      let wrapper = $('#market__table__groups, #market__table__groups_wrapper');
      if (!wrapper.length) wrapper = $('#conglomerates');
      const rows = [];
      wrapper.find('tbody tr').each((_, tr) => {
        if ($(tr).attr('parent') !== '1') return;
        const nameDiv = $(tr).find('.nameofmetriccol');
        const rawLabel = nameDiv.length ? nameDiv.text() : $(tr).find('td:first-child').text();
        const label = rawLabel.replace(/\s*\+\s*$/, '').trim().split('\n')[0].trim();
        if (label) {
          rows.push({
            conglomerate: label,
            tjiid: $(tr).attr('tjiid') ?? null,
            myid: $(tr).attr('myid') ?? null,
          });
        }
      });
      result = { headers: ['conglomerate', 'tjiid', 'myid'], rows };
    } else if (tab === 'niche') {
      let wrapper = $('#market__table__niche, #market__table__niche_wrapper');
      if (!wrapper.length) wrapper = $('#niche');
      const firstThead = wrapper.find('thead').first();
      const headCells = [];
      firstThead.find('th, td').each((_, th) => {
        const t = $(th).text().trim();
        if (t) headCells.push(t);
      });
      const periodHeaders = headCells.filter(h => h.length > 0 && h.toLowerCase() !== 'sector' && h.toLowerCase() !== 'name' && h.toLowerCase() !== 'in %');

      const rows = [];
      wrapper.find('tbody tr').each((_, tr) => {
        if ($(tr).attr('parent') !== '1') return;
        const nameDiv = $(tr).find('.nameofmetriccol');
        const rawLabel = nameDiv.length ? nameDiv.text() : $(tr).find('td:first-child').text();
        const label = rawLabel.replace(/\s*\+\s*$/, '').trim().split('\n')[0].trim();
        if (!label) return;

        const tjiid = $(tr).attr('tjiid') ?? null;
        const myid = $(tr).attr('myid') ?? null;

        const dataCells = $(tr).find('td.numericvalue, td.knowledge.numericvalue');
        const cells = dataCells.length ? dataCells : $(tr).find('td').slice(1);
        const values = [];

        cells.each((_, td) => {
          const raw = $(td).text().trim().replace(/\s+/g, ' ');
          values.push(raw === '—' || raw === '-' || raw === '' ? null : raw);
        });

        const row = { sector: label, tjiid, myid };
        values.forEach((val, i) => {
          const header = periodHeaders[i];
          if (header) row[header] = val;
        });
        rows.push(row);
      });
      result = { headers: ['sector', 'tjiid', 'myid', ...periodHeaders], rows };
    } else {
      result = this._extractSectionTable(html, tab);
    }

    if (this.cacheEnabled) {
      set(cacheKey, result, TTL.MARKETS, 'json');
    }

    return result;
  }

  async getMarketShare(slug, { fresh = false } = {}) {
    const cacheKey = `market_share:${slug}`;

    const fetched = await this._fetch(`/company/${slug}/`, {
      cacheKey,
      fresh,
    });

    if (fetched.isCached) {
      return fetched.data;
    }

    const html = await fetched.response.text();
    const $ = cheerio.load(html);
    const metrics = [];

    $('.market_share_card').each((_, card) => {
      const text = $(card).text() ?? '';
      const valueMatch = text.match(/([\d.]+)\s*%/);
      const dateMatch = text.match(/\(as of ([^)]+)\)/i) || text.match(/\(([^)]+)\)/);
      const metric = $(card).attr('data-title') || $(card).find('.name').text().trim();
      if (metric) {
        metrics.push({
          metric,
          value: valueMatch ? parseFloat(valueMatch[1]) : null,
          as_of: dateMatch ? dateMatch[1].trim() : null,
        });
      }
    });

    const result = metrics.length === 0
      ? { slug, metrics: [], note: 'No market share data available for this company.' }
      : { slug, metrics };

    if (this.cacheEnabled) {
      set(cacheKey, result, TTL.FINANCIALS, 'json', slug);
    }

    return result;
  }

  async getOperationalMetrics(slug, { fresh = false } = {}) {
    const cacheKey = `op_metrics:${slug}`;

    const fetched = await this._fetch(`/company/${slug}/`, {
      cacheKey,
      fresh,
    });

    if (fetched.isCached) {
      return fetched.data;
    }

    const html = await fetched.response.text();
    const $ = cheerio.load(html);

    const allMetrics = [];
    $('li[metricid]').each((_, li) => {
      const mId = parseInt($(li).attr('metricid'), 10);
      const name = $(li).attr('title') || $(li).text().trim();
      const unit = $(li).attr('unit')?.trim() || null;
      const indent = $(li).attr('indent') || '0';
      if (mId && name) {
        allMetrics.push({ metric_id: mId, name, unit, indent });
      }
    });

    const onclickAttr = $('li[metricid][onclick]').attr('onclick') || '';
    const idMatch = onclickAttr.match(/company_op_metrics\/(\d+)\//);
    let companyId = idMatch ? parseInt(idMatch[1], 10) : null;
    if (!companyId) {
      const scriptIdMatch = html.match(/"company_id"\s*:\s*(\d+)/);
      if (scriptIdMatch) companyId = parseInt(scriptIdMatch[1], 10);
    }

    const topLevel = allMetrics.filter(m => m.indent === '0');
    const targetMetrics = topLevel.length > 0 ? topLevel : allMetrics;

    if (!companyId || targetMetrics.length === 0) {
      const result = { slug, metrics: [], note: 'No operational metrics found for this company.' };
      if (this.cacheEnabled) {
        set(cacheKey, result, TTL.METRICS, 'json', slug);
      }
      return result;
    }

    const metricData = [];
    const BATCH_SIZE = 5;
    for (let i = 0; i < targetMetrics.length; i += BATCH_SIZE) {
      const batch = targetMetrics.slice(i, i + BATCH_SIZE);
      const batchResults = await Promise.all(batch.map(async (metric) => {
        try {
          const opRes = await this._fetch(`/api/v1/ind/company_op_metrics/${companyId}/${metric.metric_id}/`);
          const data = await opRes.response.json();
          const series = Array.isArray(data?.data) ? data.data : [];
          const latest = series.at(-1);
          const history = series.map(([ts, val]) => ({
            date: new Date(ts).toISOString().slice(0, 7),
            value: val,
          }));
          return {
            name: metric.name,
            unit: metric.unit,
            latest_value: latest?.[1] ?? null,
            latest_date: latest ? new Date(latest[0]).toISOString().slice(0, 7) : null,
            history,
          };
        } catch (e) {
          return { name: metric.name, unit: metric.unit, latest_value: null, error: e.message };
        }
      }));
      metricData.push(...batchResults);
    }

    const result = { slug, company_id: companyId, metrics: metricData };

    if (this.cacheEnabled) {
      set(cacheKey, result, TTL.METRICS, 'json', slug);
    }

    return result;
  }

  async getRevenueMix(slug, { fresh = false } = {}) {
    const cacheKey = `revenue_mix:${slug}`;

    const fetched = await this._fetch(`/company/${slug}/`, {
      cacheKey,
      fresh,
    });

    if (fetched.isCached) {
      return fetched.data;
    }

    const html = await fetched.response.text();
    const $ = cheerio.load(html);

    const charts = [];
    $('.rmix_graph_block').each((_, block) => {
      const pieEl = $(block).find('.rmix_pie_chart[chart-id]');
      if (!pieEl.length) return;
      let latest = [];
      try { latest = JSON.parse(pieEl.attr('chart-data') ?? '[]'); } catch {}
      charts.push({
        chartId: pieEl.attr('chart-id'),
        title: $(block).find('h4').text().trim() || null,
        latest_breakdown: latest.map(([name, pct]) => ({ name, pct })),
      });
    });

    if (charts.length === 0) {
      $('.rmix_pie_chart[chart-id]').each((_, pieEl) => {
        let latest = [];
        try { latest = JSON.parse($(pieEl).attr('chart-data') ?? '[]'); } catch {}
        charts.push({
          chartId: $(pieEl).attr('chart-id'),
          title: $(pieEl).closest('div').find('h4').text().trim() || null,
          latest_breakdown: latest.map(([name, pct]) => ({ name, pct })),
        });
      });
    }

    if (charts.length === 0) {
      const result = { slug, charts: [], note: 'No revenue mix data available for this company.' };
      if (this.cacheEnabled) {
        set(cacheKey, result, TTL.FINANCIALS, 'json', slug);
      }
      return result;
    }

    const chartsWithHistory = await Promise.all(charts.map(async (chart) => {
      try {
        const res = await this._fetch(`/api/rmix/historic/graph/${chart.chartId}`);
        const data = await res.response.json();
        const segments = (data?.context ?? []).map(seg => {
          let history = [];
          try {
            history = JSON.parse(seg.graphdata).map(([ts, val]) => ({
              date: new Date(ts).toISOString().slice(0, 7),
              value: val,
            }));
          } catch {}
          return { name: seg.fieldname, history };
        });
        return { title: chart.title, chart_id: parseInt(chart.chartId, 10), latest_breakdown: chart.latest_breakdown, segments };
      } catch (e) {
        return { title: chart.title, chart_id: parseInt(chart.chartId, 10), latest_breakdown: chart.latest_breakdown, error: e.message };
      }
    }));

    const result = { slug, charts: chartsWithHistory };

    if (this.cacheEnabled) {
      set(cacheKey, result, TTL.FINANCIALS, 'json', slug);
    }

    return result;
  }

  async getKnowledgeBase(slug, { fresh = false } = {}) {
    const cacheKey = `knowledge_base:${slug}`;

    const fetched = await this._fetch(`/company/${slug}/`, {
      cacheKey,
      fresh,
    });

    if (fetched.isCached) {
      return fetched.data;
    }

    const html = await fetched.response.text();
    const $ = cheerio.load(html);

    const categories = {
      annual_reports: [],
      earnings_releases: [],
      investor_presentations: [],
      conference_calls: [],
    };

    $('a[href*="files.tijorifinance.com"]').each((_, a) => {
      const href = $(a).attr('href') ?? '';
      if (!href) return;
      const file = href.split('/').pop()?.replace('.pdf', '') ?? '';
      let period = file;
      const annualMatch = file.match(/^AR-(\d{2})/);
      const quarterlyMatch = file.match(/^(?:CC|ER|IP)-([A-Za-z]{3})(\d{2})/);
      if (annualMatch) period = `FY${annualMatch[1]}`;
      else if (quarterlyMatch) period = `${quarterlyMatch[1]} 20${quarterlyMatch[2]}`;

      const entry = { period, url: href };
      if (href.includes('Annual%20Report') || href.includes('Annual+Report') || href.includes('AR-')) {
        categories.annual_reports.push(entry);
      } else if (href.includes('Earnings%20Release') || href.includes('Earnings+Release') || href.includes('ER-')) {
        categories.earnings_releases.push(entry);
      } else if (href.includes('Investor%20Presentation') || href.includes('Investor+Presentation') || href.includes('IP-')) {
        categories.investor_presentations.push(entry);
      } else if (href.includes('Conference%20Call') || href.includes('Conference+Call') || href.includes('CC-')) {
        categories.conference_calls.push(entry);
      }
    });

    const result = { slug, ...categories };

    if (this.cacheEnabled) {
      set(cacheKey, result, TTL.FINANCIALS, 'json', slug);
    }

    return result;
  }

  async fetchDocument(url, { fresh = false, signal = AbortSignal.timeout(15000) } = {}) {
    let parsedUrl;
    try {
      parsedUrl = new URL(url);
    } catch {
      throw new Error('Invalid document URL');
    }
    if (parsedUrl.protocol !== 'https:') {
      throw new Error('Only HTTPS URLs are supported');
    }
    if (parsedUrl.hostname !== 'files.tijorifinance.com') {
      throw new Error('Only files.tijorifinance.com URLs are supported');
    }

    const cacheKey = `doc:${url}`;
    if (this.cacheEnabled && !fresh) {
      const cached = get(cacheKey);
      if (cached) return cached;
    }

    this._loadSession();
    const headers = {
      'Referer': `${this.baseUrl}/`,
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    };
    if (this._session.cookieHeader) {
      headers['Cookie'] = this._session.cookieHeader;
    }

    const res = await this.fetchFn(url, {
      signal,
      headers,
    });

    if (res.status === 403) {
      throw new Error('Access denied — session may have expired. Run: npm run reauth');
    }
    if (res.status === 404) {
      throw new Error('Document not found at this URL');
    }
    if (res.status >= 400) {
      throw new Error(`HTTP ${res.status} from CDN`);
    }

    const arrayBuffer = await res.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const origLog = console.log;
    const origWarn = console.warn;
    const filterWrite = (args) => {
      const msg = args.join(' ');
      if (!msg.includes('TT: undefined function') && !msg.includes('Warning: TT:')) {
        process.stderr.write(msg + '\n');
      }
    };
    console.log = (...a) => filterWrite(a);
    console.warn = (...a) => filterWrite(a);

    let parsedData;
    try {
      parsedData = await pdfParse(buffer);
    } finally {
      console.log = origLog;
      console.warn = origWarn;
    }

    const result = {
      url,
      pages: parsedData.numpages,
      text: parsedData.text.trim(),
    };

    if (this.cacheEnabled) {
      set(cacheKey, result, TTL.PERMANENT, 'json');
    }

    return result;
  }

  async getFactorsAndBenchmarking(slug, { fresh = false } = {}) {
    const cacheKey = `factors:${slug}`;

    const fetched = await this._fetch(`/company/${slug}/factors/`, {
      cacheKey,
      fresh,
    });

    if (fetched.isCached) {
      return fetched.data;
    }

    const html = await fetched.response.text();
    const $ = cheerio.load(html);

    // Extract company name and ticker
    let companyName = null;
    let symbol = null;
    try {
      const tourEl = $('#benchmarking-tour-config');
      if (tourEl.length) {
        const tour = JSON.parse(tourEl.html());
        companyName = tour.companyShort || null;
        symbol = tour.companyTicker || null;
      }
    } catch (_) {}

    if (!companyName) {
      const title = $('title').text() || '';
      const match = title.match(/^(.*?)\s+(?:benchmarking|factors)/i);
      companyName = match ? match[1].trim() : slug;
    }

    // Extract radar data
    let radarAxes = [];
    try {
      const radarEl = $('#factor-radar-data');
      if (radarEl.length) {
        const radarData = JSON.parse(radarEl.html());
        const axes = radarData.axes || [];
        const series = radarData.series || [];
        const targetSeries = series[0];
        const peerSeries = series.slice(1);

        radarAxes = axes.map((axis, i) => {
          const rawCompanyScore = targetSeries?.data?.[i];
          const companyScore = typeof rawCompanyScore === 'number' && Number.isFinite(rawCompanyScore)
            ? rawCompanyScore
            : null;
          const peerScores = peerSeries
            .map((s) => s.data?.[i])
            .filter((score) => typeof score === 'number' && Number.isFinite(score));
          const peerMedian = peerScores.length ? computePercentiles(peerScores, [0.5]).p50 : null;
          return {
            name: axis.name || axis.label || axis.key,
            key: axis.key,
            company_score: companyScore,
            peer_median: peerMedian,
            polarity: axis.polarity || null,
          };
        });
      }
    } catch (_) {}

    // Extract formulas & qualitative notes
    let formulas = [];
    try {
      const cellInfoEl = $('#factor-cell-info');
      if (cellInfoEl.length) {
        const cellInfo = JSON.parse(cellInfoEl.html());
        if (Array.isArray(cellInfo.formulas)) {
          formulas = cellInfo.formulas;
        }
      }
    } catch (_) {}

    const hasData = radarAxes.length > 0 || formulas.length > 0;
    const result = {
      slug,
      company_name: companyName,
      symbol,
      radar_axes: radarAxes,
      formulas,
      ...(hasData ? {} : { note: 'No factor benchmarking data available for this company' }),
    };

    if (this.cacheEnabled) {
      set(cacheKey, result, TTL.FACTORS, 'json', slug);
    }

    return result;
  }

  async getValuationBands(slug, { fresh = false } = {}) {
    const cacheKey = `valuation_bands:${slug}`;

    if (this.cacheEnabled && !fresh) {
      const cached = get(cacheKey);
      if (cached) return cached;
    }

    try {
      // 1. Fetch overview page first to resolve company_id and peers
      const overviewRes = await this._fetchCompanyOverviewHtml(slug, { fresh, cacheKey });
      if (overviewRes.stale) return overviewRes.stale;
      const { $, html: overviewHtml } = overviewRes;

      let companyId = null;
      const companyIdMatch = overviewHtml.match(/"company_id"\s*:\s*(\d+)/);
      if (companyIdMatch) {
        companyId = parseInt(companyIdMatch[1], 10);
      } else {
        const ids = await this.resolveCompanyIds(slug, { fresh });
        companyId = ids?.company_id ?? null;
      }

      // Extract peers from #peers_table_data
      let peers = [];
      try {
        const scriptEl = $('#peers_table_data');
        if (scriptEl.length) {
          const raw = JSON.parse(scriptEl.html());
          const data = raw?.[1]?.data || [];
          peers = data.map((p) => {
            const rawMcap = p['Market Capital'] ?? null;
            const mcapCr = typeof rawMcap === 'number'
              ? rawMcap
              : (rawMcap ? parseFloat(String(rawMcap).replace(/[^\d.]/g, '')) || null : null);
            const mcapInr = mcapCr !== null ? Math.round(mcapCr * 1e7) : null;
            return {
              name: p.name || null,
              slug: p.slug || null,
              mcap: rawMcap,
              mcap_crores: mcapCr,
              mcap_inr: mcapInr,
              pe: typeof p.PE === 'number' ? p.PE : null,
              latest_price: p['Latest Price'] ?? null,
            };
          });
        }
      } catch (_) {}

      if (!companyId) {
        const fallback = {
          slug,
          company_id: null,
          current_pe: null,
          valuation_bands: { '1y': null, '3y': null, '5y': null, '10y': null },
          peers,
          loss_making_days_excluded: 0,
          note: 'Unable to resolve numeric company_id for valuation bands',
        };
        if (this.cacheEnabled) {
          set(cacheKey, fallback, TTL.VALUATION, 'json', slug);
        }
        return fallback;
      }

      // 2. Fetch daily historical P/E series
      const chartFetched = await this._fetch(`/api/v1/ind/chartdata/${companyId}/pe/`, { fresh });
      const chartJson = await chartFetched.response.json();
      let rawPoints = [];
      if (chartJson?.data) {
        rawPoints = typeof chartJson.data === 'string' ? JSON.parse(chartJson.data) : chartJson.data;
      }

      const observations = rawPoints
        .filter(point => Array.isArray(point) && point.length >= 2 &&
          typeof point[0] === 'number' && Number.isFinite(point[0]) &&
          typeof point[1] === 'number' && Number.isFinite(point[1]))
        .sort((a, b) => a[0] - b[0]);
      const lossDaysCount = observations.filter(([, pe]) => pe <= 0).length;
      const validPoints = [];
      for (const point of observations) {
        if (point[1] > 0) validPoints.push(point);
      }

      const latestObservation = observations.at(-1);
      const asOf = latestObservation ? new Date(latestObservation[0]).toISOString() : null;
      const currentPe = latestObservation?.[1] > 0 ? latestObservation[1] : null;

      const valuationBands = { '1y': null, '3y': null, '5y': null, '10y': null };
      if (validPoints.length > 0 && latestObservation) {
        const maxTs = latestObservation[0];
        const minTs = validPoints[0][0];
        const totalSpanDays = (maxTs - minTs) / 86400000;

        const timeframeDefs = [
          { key: '1y', days: 365 },
          { key: '3y', days: 3 * 365 },
          { key: '5y', days: 5 * 365 },
          { key: '10y', days: 10 * 365 },
        ];

        for (const tf of timeframeDefs) {
          if (totalSpanDays >= tf.days * 0.8) {
            const cutoffTs = maxTs - tf.days * 86400000;
            const windowPoints = validPoints.filter(([ts]) => ts >= cutoffTs);
            const peValues = windowPoints.map(([, pe]) => pe);
            const stats = computePercentiles(peValues, [0.25, 0.5, 0.75]);
            valuationBands[tf.key] = {
              min: stats.min,
              p25: stats.p25,
              median: stats.p50,
              p75: stats.p75,
              max: stats.max,
              sample_count: stats.count,
            };
          }
        }
      }

      const result = {
        slug,
        company_id: companyId,
        current_pe: currentPe,
        as_of: asOf,
        valuation_bands: valuationBands,
        peers,
        loss_making_days_excluded: lossDaysCount,
      };

      if (this.cacheEnabled) {
        set(cacheKey, result, TTL.VALUATION, 'json', slug);
      }

      return result;
    } catch (err) {
      if (this.cacheEnabled) {
        const stale = get(cacheKey, { allowStale: true });
        if (stale) {
          return {
            ...stale,
            _cache_meta: { ...(stale._cache_meta || {}), is_stale: true },
          };
        }
      }
      throw err;
    }
  }

  async getScenarioProjections(slug, { fresh = false } = {}) {
    const cacheKey = `scenarios:verified:${slug}`;

    const fetched = await this._fetch(`/company/${slug}/shareholding/`, {
      cacheKey,
      fresh,
    });

    if (fetched.isCached) {
      return fetched.data;
    }

    const html = await fetched.response.text();
    const $ = cheerio.load(html);

    const tables = $('.peg-sample__table');
    if (!tables.length) {
      const fallback = {
        slug,
        has_projections: false,
        scenarios: [],
        forecasts: null,
        note: 'No scenario projections available for this company',
      };
      if (this.cacheEnabled) {
        set(cacheKey, fallback, TTL.SCENARIOS, 'json', slug);
      }
      return fallback;
    }

    const pageCompany = $('title').text().split('|')[0].trim();
    const reportCompany = $('.peg-sample__company').first().text().trim();
    if (
      !pageCompany ||
      !reportCompany ||
      /^sample report of\b/i.test(reportCompany) ||
      pageCompany.toLocaleLowerCase() !== reportCompany.toLocaleLowerCase()
    ) {
      const fallback = {
        slug,
        has_projections: false,
        scenarios: [],
        forecasts: null,
        note: 'No verified company-specific scenario projections available',
      };
      if (this.cacheEnabled) {
        set(cacheKey, fallback, TTL.SCENARIOS, 'json', slug);
      }
      return fallback;
    }

    // 1. Table 0: Base / Bear / Bull scenarios
    const scenarios = [];
    const table0 = $(tables[0]);
    table0.find('tr').each((i, tr) => {
      if (i === 0) return;
      const cols = $(tr).find('td').map((_, td) => $(td).text().trim().replace(/\s+/g, ' ')).get();
      if (cols.length >= 3) {
        scenarios.push({
          scenario: cols[0],
          probability: cols[1],
          key_drivers: cols[2],
        });
      }
    });

    // 2. Table 1: Forward forecasts
    let forecasts = null;
    if (tables.length >= 2) {
      const table1 = $(tables[1]);
      const headerCols = table1.find('tr').first().find('th, td').map((_, el) => $(el).text().trim().replace(/\s+/g, ' ')).get();
      const years = [];
      let hasCagr = false;
      for (let c = 1; c < headerCols.length; c++) {
        const colName = headerCols[c];
        if (colName.toUpperCase() === 'CAGR') {
          hasCagr = true;
        } else if (colName) {
          years.push(colName);
        }
      }

      const metrics = [];
      let currentSection = null;

      table1.find('tr').slice(1).each((_, tr) => {
        const cells = $(tr).find('td, th').map((_, el) => $(el).text().trim().replace(/\s+/g, ' ')).get();
        if (cells.length === 0) return;

        if (cells.length === 1) {
          currentSection = cells[0];
          return;
        }

        const rawName = cells[0];
        const metricName = currentSection && rawName.startsWith('-') ? `${currentSection} ${rawName}` : (currentSection ? `${currentSection} - ${rawName}` : rawName);

        const values = [];
        for (let y = 0; y < years.length; y++) {
          const valStr = cells[y + 1];
          if (!valStr || valStr === '–' || valStr === '-' || valStr === '—') {
            values.push(null);
          } else {
            const clean = valStr.replace(/,/g, '');
            const num = parseFloat(clean);
            values.push(Number.isNaN(num) ? valStr : num);
          }
        }

        const cagrColIdx = hasCagr ? years.length + 1 : -1;
        const cagr = cagrColIdx > 0 && cagrColIdx < cells.length ? cells[cagrColIdx] : null;

        metrics.push({
          name: metricName,
          values,
          cagr: cagr || null,
        });
      });

      forecasts = {
        years,
        metrics,
      };
    }

    const result = {
      slug,
      report_company: reportCompany,
      has_projections: scenarios.length > 0 || forecasts !== null,
      scenarios,
      forecasts,
    };

    if (this.cacheEnabled) {
      set(cacheKey, result, TTL.SCENARIOS, 'json', slug);
    }

    return result;
  }

  async _fetchCompanyOverviewHtml(slug, { fresh = false, cacheKey = null } = {}) {
    const htmlCacheKey = `html:overview:${slug}`;
    if (this.cacheEnabled && !fresh) {
      const cached = get(htmlCacheKey, { allowStale: false });
      if (cached?.value) {
        return { $: cheerio.load(cached.value), html: cached.value };
      }
    }

    try {
      const fetched = await this._fetch(`/company/${slug}/`, { fresh });
      const html = await fetched.response.text();
      if (this.cacheEnabled) {
        set(htmlCacheKey, html, TTL.OVERVIEW, 'html', slug);
      }
      const $ = cheerio.load(html);
      return { $, html };
    } catch (err) {
      if (this.cacheEnabled && cacheKey) {
        const stale = get(cacheKey, { allowStale: true });
        if (stale) {
          return {
            stale: {
              ...stale,
              _cache_meta: { ...(stale._cache_meta || {}), is_stale: true },
            },
          };
        }
      }
      throw err;
    }
  }

  async getCompanyTimeline(slug, { fresh = false } = {}) {
    const cacheKey = `timeline:${slug}`;

    if (this.cacheEnabled && !fresh) {
      const cached = get(cacheKey);
      if (cached) return cached;
    }

    const overviewRes = await this._fetchCompanyOverviewHtml(slug, { fresh, cacheKey });
    if (overviewRes.stale) return overviewRes.stale;
    const { $, html } = overviewRes;

    let keyEvents = [];
    let whatToWatch = {
      analyst_summary: '',
      items: [],
      peg_summary: null,
    };

    const scriptEl = $('#company_details_data');
    try {
      if (scriptEl.length) {
        const data = JSON.parse(scriptEl.html());
        if (data.memory_overview?.key_events && Array.isArray(data.memory_overview.key_events)) {
          keyEvents = data.memory_overview.key_events.map((ev) => ({
            date: ev.chart_date || ev.date || null,
            label: ev.label || '',
          }));
        }
        const theRead = Array.isArray(data.memory_overview?.the_read)
          ? data.memory_overview.the_read.join(' ')
          : '';
        whatToWatch = {
          analyst_summary: theRead || data.peg_summary || '',
          items: data.memory_overview?.what_to_watch || [],
          peg_summary: data.peg_summary || null,
        };
      }
    } catch (_) {}

    if (!scriptEl.length) {
      $('script').each((_, el) => {
        const text = $(el).html() || '';
        if (text.includes('key_events')) {
          try {
            const parsed = JSON.parse(text);
            const events = parsed.key_events || parsed.memory_overview?.key_events;
            if (Array.isArray(events)) {
              keyEvents = events.map((ev) => ({
                date: ev.chart_date || ev.date || null,
                label: ev.label || '',
              }));
            }
          } catch (_) {}
        }
      });
    }

    // Deterministically sort key events chronologically
    keyEvents.sort((a, b) => (a.date || '').localeCompare(b.date || ''));

    const result = {
      slug,
      key_events: keyEvents,
      what_to_watch: whatToWatch,
    };

    if (this.cacheEnabled) {
      set(cacheKey, result, TTL.TIMELINE, 'json', slug);
    }

    return result;
  }

  async getStockNews(query, { limit = 10, days = 90, fresh = false } = {}) {
    const trimmed = String(query).trim();
    const numLimit = Number(limit) || 10;
    const numDays = Number(days) || 90;
    const cacheKey = `news:${trimmed}:${numDays}`;

    if (this.cacheEnabled && !fresh) {
      const cached = get(cacheKey);
      if (cached) {
        return {
          ...cached,
          news: (cached.news || []).slice(0, numLimit),
        };
      }
    }

    const rssUrl = `https://news.google.com/rss/search?q=${encodeURIComponent(trimmed)}+when:${numDays}d&hl=en-IN&gl=IN&ceid=IN:en`;
    let items = [];
    let fetchError = null;

    try {
      const fetched = await this._fetch(rssUrl, { fresh });
      const xml = await fetched.response.text();
      const $ = cheerio.load(xml, { xmlMode: true });

      $('item').each((_, el) => {
        const rawTitle = $(el).find('title').text().trim();
        const link = $(el).find('link').text().trim();
        const pubDate = $(el).find('pubDate').text().trim();
        const source = $(el).find('source').text().trim();

        let title = rawTitle;
        if (source && title.endsWith(` - ${source}`)) {
          title = title.slice(0, -(source.length + 3)).trim();
        }

        let isoDate = null;
        if (pubDate) {
          try {
            isoDate = new Date(pubDate).toISOString();
          } catch (_) {
            isoDate = pubDate;
          }
        }

        if (title && link) {
          items.push({
            title,
            source: source || 'Unknown',
            url: link,
            published_at: isoDate || pubDate,
          });
        }
      });
    } catch (err) {
      fetchError = err;
    }

    if (fetchError) {
      if (this.cacheEnabled) {
        const stale = get(cacheKey, { allowStale: true });
        if (stale) {
          return {
            ...stale,
            _cache_meta: { ...(stale._cache_meta || {}), is_stale: true },
            news: (stale.news || []).slice(0, numLimit),
          };
        }
      }
    }

    const totalFound = items.length;
    const fullResult = {
      query: trimmed,
      days: numDays,
      total_found: totalFound,
      news: items,
      ...(totalFound === 0 ? { note: 'No news found or RSS feed temporarily unavailable' } : {}),
    };

    if (this.cacheEnabled && !fetchError) {
      set(cacheKey, fullResult, TTL.NEWS, 'json');
    }

    return {
      ...fullResult,
      news: items.slice(0, numLimit),
    };
  }

  async getCorporateActions(slug, { fresh = false } = {}) {
    const cacheKey = `corporate_actions:${slug}`;

    if (this.cacheEnabled && !fresh) {
      const cached = get(cacheKey);
      if (cached) return cached;
    }

    const overviewRes = await this._fetchCompanyOverviewHtml(slug, { fresh, cacheKey });
    if (overviewRes.stale) return overviewRes.stale;
    const { $, html } = overviewRes;

    let dividends = [];
    let splits = [];
    let bonuses = [];
    let rights = [];

    const scriptEl = $('#corporate_actions');
    if (scriptEl.length) {
      try {
        const parsed = JSON.parse(scriptEl.html());
        if (Array.isArray(parsed.Dividend)) dividends = parsed.Dividend;
        if (Array.isArray(parsed.Split)) splits = parsed.Split;
        if (Array.isArray(parsed.Bonus)) bonuses = parsed.Bonus;
        if (Array.isArray(parsed.Rights)) rights = parsed.Rights;
      } catch (_) {}
    }

    if (!scriptEl.length) {
      $('script').each((_, el) => {
        const text = $(el).html() || '';
        if (text.includes('Dividend') && (text.includes('Bonus') || text.includes('Split'))) {
          try {
            const parsed = JSON.parse(text);
            if (Array.isArray(parsed.Dividend)) dividends = parsed.Dividend;
            if (Array.isArray(parsed.Split)) splits = parsed.Split;
            if (Array.isArray(parsed.Bonus)) bonuses = parsed.Bonus;
            if (Array.isArray(parsed.Rights)) rights = parsed.Rights;
          } catch (_) {}
        }
      });
    }

    const result = {
      slug,
      dividends,
      splits,
      bonuses,
      rights,
    };

    if (this.cacheEnabled) {
      set(cacheKey, result, TTL.ACTIONS, 'json', slug);
    }

    return result;
  }

  async getSupplyChain(slug, { fresh = false } = {}) {
    const cacheKey = `supply_chain:${slug}`;

    if (this.cacheEnabled && !fresh) {
      const cached = get(cacheKey);
      if (cached) return cached;
    }

    const overviewRes = await this._fetchCompanyOverviewHtml(slug, { fresh, cacheKey });
    if (overviewRes.stale) return overviewRes.stale;
    const { $, html } = overviewRes;

    let operationalSupplierNotes = [];
    let operationalCustomerNotes = [];
    // shortcut: relational products graph requires dedicated entity mapping endpoint, deferred to FEAT-024
    let relationalProducts = [];
    let industriesCatered = [];

    const scriptEl = $('#company_details_data');
    try {
      if (scriptEl.length) {
        const data = JSON.parse(scriptEl.html());
        if (data.sector) industriesCatered.push(data.sector);

        const sentences = [];
        if (Array.isArray(data.memory_overview?.the_read)) {
          sentences.push(...data.memory_overview.the_read);
        }
        if (Array.isArray(data.memory_overview?.what_to_watch)) {
          for (const item of data.memory_overview.what_to_watch) {
            if (item.body) sentences.push(item.body);
          }
        }

        for (const s of sentences) {
          const lower = s.toLowerCase();
          if (
            lower.includes('supplier') ||
            lower.includes('input') ||
            lower.includes('raw material') ||
            lower.includes('capacity') ||
            lower.includes('accrual') ||
            lower.includes('spending') ||
            lower.includes('procurement')
          ) {
            operationalSupplierNotes.push(s);
          }
          if (
            lower.includes('customer') ||
            lower.includes('client') ||
            lower.includes('buyer') ||
            lower.includes('sells') ||
            lower.includes('promoter') ||
            lower.includes('receivable') ||
            lower.includes('market share')
          ) {
            operationalCustomerNotes.push(s);
          }
        }
      }
    } catch (_) {}

    const result = {
      slug,
      operational_supplier_notes: operationalSupplierNotes,
      operational_customer_notes: operationalCustomerNotes,
      relational_products: relationalProducts,
      industries_catered: industriesCatered,
    };

    if (this.cacheEnabled) {
      set(cacheKey, result, TTL.SUPPLY_CHAIN, 'json', slug);
    }

    return result;
  }
}
