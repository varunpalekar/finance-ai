import { get, set, TTL } from '../cache.js';
import {
  stripSpans,
  parseFilterFields,
  parsePopularScreensHtml,
  buildQuery,
} from '../parsers/tijori/screener.js';

export const DEFAULT_LIMIT = 50;
export const FIELD_RESULT_CAP = 60;

export function paginate({ total_results, results }, offset, limit) {
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

export class TijoriScreener {
  constructor(client) {
    this.client = client;
  }

  get cacheEnabled() {
    return this.client?.cacheEnabled ?? true;
  }

  _fetch(urlOrPath, options) {
    return this.client._fetch(urlOrPath, options);
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

    const matches = parseFilterFields(data, { query, type });

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
    const screens = parsePopularScreensHtml(html);

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
    if (filters !== undefined && filters !== null) {
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
}
