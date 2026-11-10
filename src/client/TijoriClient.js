import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { get, set, clear, TTL, initDb } from '../cache.js';
import { computePercentiles } from '../helpers.js';
import { parseFinancialsHtml } from '../parsers/tijori/financials.js';
import {
  parseShareholdingSummaryHtml,
  parseShareholdingDetailedHtml,
} from '../parsers/tijori/shareholding.js';
import { TijoriScreener } from './TijoriScreener.js';
import { SessionManager } from './SessionManager.js';
import {
  parseValuationBands,
  parseScenarioProjectionsHtml,
  parseFactorsAndBenchmarkingHtml,
  parseValuationOverview,
} from '../parsers/tijori/valuation.js';
import {
  parseCompanyOverviewHtml,
  parseCompanyTimelineHtml,
  parseCorporateActionsHtml,
  parseSupplyChainHtml,
} from '../parsers/tijori/overview.js';
import {
  extractSectionTable,
  parseRawMaterialsHtml,
  parseMacroIndicatorsHtml,
  parseMarketsHtml,
  parseMarketShareHtml,
  parseRevenueMixCharts,
  parseKnowledgeBaseHtml,
  parseOperationalMetricsInitial,
} from '../parsers/tijori/markets.js';
import { parseGoogleNewsXml } from '../parsers/tijori/news.js';
import {
  parseResolveCompanyIdsHtml,
  parseFundFlowJson,
  parseConglomerateConstituentsJson,
  parseNicheConstituentsJson,
} from '../parsers/tijori/company.js';

import { fetchDocument } from './TijoriDocumentFetcher.js';

const BASE_URL = 'https://www.tijorifinance.com';
const DEFAULT_SESSION_PATH = process.env.TIJORI_SESSION_PATH || path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../output/session.json');

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

    this._sessionManager = new SessionManager({
      sessionPath: this.sessionPath,
      baseUrl: this.baseUrl,
      fetchFn: this.fetchFn,
      cacheEnabled: this.cacheEnabled,
      fetchClient: this,
    });
    this._screener = new TijoriScreener(this);
  }

  get _session() {
    return this._sessionManager._session;
  }

  set _session(val) {
    this._sessionManager._session = val;
  }

  get _sessionMtime() {
    return this._sessionManager._sessionMtime;
  }

  set _sessionMtime(val) {
    this._sessionManager._sessionMtime = val;
  }

  _loadSession() {
    return this._sessionManager.loadSession();
  }

  getHeaders() {
    return this._sessionManager.getHeaders();
  }

  async validateSession(options) {
    return this._sessionManager.validateSession(options);
  }

  async getUserInfo(options) {
    return this._sessionManager.getUserInfo(options);
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
    const final = parseResolveCompanyIdsHtml(html, { slug });

    if (this.cacheEnabled && final.company_id !== null) {
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
    const result = parseFundFlowJson(raw, companyId, numYears);

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
    const result = parseConglomerateConstituentsJson(raw, tjiid);

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
    const result = parseNicheConstituentsJson(raw, tjiid);

    if (this.cacheEnabled) {
      set(cacheKey, result, TTL.MARKETS, 'json');
    }

    return result;
  }

  async getSectorConstituents(tjiid, opts) {
    return this.getNicheConstituents(tjiid, opts);
  }

  async searchScreenerFields(options) {
    return this._screener.searchScreenerFields(options);
  }

  async listPopularScreens(options) {
    return this._screener.listPopularScreens(options);
  }

  async _runScreenerApi(endpoint, params, options) {
    return this._screener._runScreenerApi(endpoint, params, options);
  }

  async screenCompanies(options) {
    return this._screener.screenCompanies(options);
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
    const result = parseCompanyOverviewHtml(html, { slug });

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
    const result = parseFinancialsHtml(html, { type, basis, slug });

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
    const result = isDetailed
      ? parseShareholdingDetailedHtml(html, { slug })
      : parseShareholdingSummaryHtml(html);

    if (this.cacheEnabled) {
      set(cacheKey, result, TTL.SHAREHOLDING || TTL.FINANCIALS, 'json', slug);
    }

    return result;
  }

  _extractSectionTable(html, sectionId) {
    return extractSectionTable(html, sectionId);
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
    const result = parseRawMaterialsHtml(html, tab);

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
    const result = parseMacroIndicatorsHtml(html, tab);

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
    const result = parseMarketsHtml(html, tab);

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
    const result = parseMarketShareHtml(html, { slug });

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
    const { companyId, targetMetrics } = parseOperationalMetricsInitial(html);

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
    const charts = parseRevenueMixCharts(html);

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
    const result = parseKnowledgeBaseHtml(html, { slug });

    if (this.cacheEnabled) {
      set(cacheKey, result, TTL.FINANCIALS, 'json', slug);
    }

    return result;
  }

  async fetchDocument(url, options = {}) {
    return fetchDocument(this, url, options);
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
    const result = parseFactorsAndBenchmarkingHtml(html, { slug });

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
      const { html: overviewHtml } = overviewRes;

      let { companyId, peers } = parseValuationOverview(overviewHtml);
      if (!companyId) {
        const ids = await this.resolveCompanyIds(slug, { fresh });
        companyId = ids?.company_id ?? null;
      }

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
      const result = parseValuationBands(chartJson, { slug, companyId, peers });

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
    const result = parseScenarioProjectionsHtml(html, { slug });

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
        return { html: cached.value };
      }
    }

    try {
      const fetched = await this._fetch(`/company/${slug}/`, { fresh });
      const html = await fetched.response.text();
      if (this.cacheEnabled) {
        set(htmlCacheKey, html, TTL.OVERVIEW, 'html', slug);
      }
      return { html };
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

  async _getOverviewParsed(slug, cacheKey, ttl, parser, { fresh = false } = {}) {
    if (this.cacheEnabled && !fresh) {
      const cached = get(cacheKey);
      if (cached) return cached;
    }

    const overviewRes = await this._fetchCompanyOverviewHtml(slug, { fresh, cacheKey });
    if (overviewRes.stale) return overviewRes.stale;
    const { html } = overviewRes;

    const result = parser(html, { slug });

    if (this.cacheEnabled) {
      set(cacheKey, result, ttl, 'json', slug);
    }

    return result;
  }

  async getCompanyTimeline(slug, { fresh = false } = {}) {
    return this._getOverviewParsed(slug, `timeline:${slug}`, TTL.TIMELINE, parseCompanyTimelineHtml, { fresh });
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
      items = parseGoogleNewsXml(xml);
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
    return this._getOverviewParsed(slug, `corporate_actions:${slug}`, TTL.ACTIONS, parseCorporateActionsHtml, { fresh });
  }

  async getSupplyChain(slug, { fresh = false } = {}) {
    return this._getOverviewParsed(slug, `supply_chain:${slug}`, TTL.SUPPLY_CHAIN, parseSupplyChainHtml, { fresh });
  }
}
