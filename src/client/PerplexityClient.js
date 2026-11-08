import fs from 'node:fs';
import path from 'node:path';
import { get, set, TTL } from '../cache.js';
import { parseCatalysts } from '../parsers/perplexity/catalysts.js';
import { parseReports } from '../parsers/perplexity/reports.js';
import { parseEarnings } from '../parsers/perplexity/earnings.js';
import { parseProfile } from '../parsers/perplexity/profile.js';
import { parseNews } from '../parsers/perplexity/news.js';

const KNOWN_US_TICKERS = new Set([
  'AAPL', 'MSFT', 'GOOG', 'GOOGL', 'AMZN', 'META', 'TSLA', 'NVDA', 'BRK.A', 'BRK.B',
  'JPM', 'V', 'JNJ', 'WMT', 'PG', 'UNH', 'HD', 'MA', 'DIS', 'NFLX', 'INTC', 'AMD'
]);

export class PerplexityClient {
  constructor(options = {}) {
    this.baseUrl = options.baseUrl || 'https://www.perplexity.ai';
    this.sessionPath = options.sessionPath || process.env.PPLX_SESSION_PATH || path.resolve(process.cwd(), 'output/perplexity_session.json');
    this._inFlight = new Map();
    this._sessionMtime = 0;
    this._cachedCookies = [];
  }

  normalizeTicker(ticker) {
    if (!ticker || typeof ticker !== 'string') return '';
    const clean = ticker.trim().toUpperCase();
    if (clean.endsWith('.US')) {
      return clean.slice(0, -3);
    }
    if (clean.includes('.')) {
      return clean;
    }
    if (/^\d+$/.test(clean)) {
      return `${clean}.BO`;
    }
    if (KNOWN_US_TICKERS.has(clean)) {
      return clean;
    }
    return `${clean}.NS`;
  }

  cacheKey(endpointType, ticker, paramsHash = '') {
    return ['pplx', endpointType, ticker, paramsHash].filter(Boolean).join(':');
  }

  getCookieHeader() {
    try {
      if (!fs.existsSync(this.sessionPath)) {
        return '';
      }
      const stat = fs.statSync(this.sessionPath);
      if (stat.mtimeMs > this._sessionMtime || !this._cachedCookies.length) {
        const raw = fs.readFileSync(this.sessionPath, 'utf8');
        const parsed = JSON.parse(raw);
        this._cachedCookies = Array.isArray(parsed?.cookies) ? parsed.cookies : [];
        this._sessionMtime = stat.mtimeMs;
      }
      return this._cachedCookies
        .filter(c => c && c.name && c.value && (!c.domain || c.domain.includes('perplexity.ai')))
        .map(c => `${c.name}=${c.value}`)
        .join('; ');
    } catch (_) {
      return '';
    }
  }

  async validateSession(options = {}) {
    const probe = options.probe ?? false;
    if (!fs.existsSync(this.sessionPath)) {
      return { valid: false, reason: 'SESSION_MISSING' };
    }

    let parsed;
    try {
      const raw = fs.readFileSync(this.sessionPath, 'utf8');
      parsed = JSON.parse(raw);
    } catch {
      return { valid: false, reason: 'SESSION_INVALID_JSON' };
    }

    const cookies = Array.isArray(parsed?.cookies) ? parsed.cookies : [];
    const hasSessionToken = cookies.some(c => c.name === '__Secure-next-auth.session-token');
    if (!hasSessionToken) {
      return { valid: false, reason: 'SESSION_TOKEN_MISSING' };
    }

    if (probe) {
      try {
        const res = await this._rawFetch(`${this.baseUrl}/rest/finance/quote/HEROMOTOCO.NS`, {
          headers: this._getHeaders()
        });
        if (res.status === 401 || res.status === 403) {
          return { valid: false, reason: 'NOT_AUTHENTICATED' };
        }
        if (!res.ok) {
          return { valid: false, reason: `HTTP_${res.status}` };
        }
      } catch (err) {
        return { valid: false, reason: err.message };
      }
    }

    return { valid: true, updated_at: parsed.updated_at };
  }

  async getUserInfo({ fresh = false } = {}) {
    const cacheKey = 'pplx:user:profile_info';
    if (!fresh) {
      const cached = get(cacheKey, { allowStale: false });
      if (cached) return cached;
    }

    try {
      const res = await this._rawFetch(`${this.baseUrl}/api/auth/session`, {
        headers: this._getHeaders()
      });
      if (!res.ok) {
        return { is_authenticated: false, name: null, username: null, email: null };
      }
      const data = await res.json().catch(() => null);
      if (!data?.user) {
        return { is_authenticated: false, name: null, username: null, email: null };
      }

      const info = {
        is_authenticated: true,
        name: data.user.name || null,
        username: data.user.username || null,
        email: data.user.email || null,
        subscription_status: data.user.subscription_status || 'free',
        org_role: data.user.org_role || null
      };

      set(cacheKey, info, TTL.OVERVIEW, 'json');
      return info;
    } catch {
      return { is_authenticated: false, name: null, username: null, email: null };
    }
  }

  _getHeaders() {
    const headers = {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
      'Accept': 'application/json, text/plain, */*',
      'Accept-Language': 'en-US,en;q=0.9',
      'Referer': `${this.baseUrl}/finance`,
      'Sec-Ch-Ua': '"Google Chrome";v="131", "Chromium";v="131", "Not_A Brand";v="24"',
      'Sec-Ch-Ua-Mobile': '?0',
      'Sec-Ch-Ua-Platform': '"macOS"',
      'Sec-Fetch-Dest': 'empty',
      'Sec-Fetch-Mode': 'cors',
      'Sec-Fetch-Site': 'same-origin'
    };
    const cookies = this.getCookieHeader();
    if (cookies) {
      headers['Cookie'] = cookies;
    }
    return headers;
  }

  async _rawFetch(url, options) {
    return await fetch(url, options);
  }

  async fetchJson(endpoint, options = {}) {
    const { fresh = false, ttl = null, cacheKey: customCacheKey = null } = options;
    const cKey = customCacheKey || (endpoint.startsWith('pplx:') ? endpoint : null);

    if (!fresh && cKey) {
      const cached = get(cKey);
      if (cached !== null) {
        return typeof cached === 'object' && cached !== null && 'value' in cached ? cached.value : cached;
      }
    }

    if (this._inFlight.has(endpoint)) {
      return await this._inFlight.get(endpoint);
    }

    const fetchPromise = (async () => {
      const url = endpoint.startsWith('http') ? endpoint : `${this.baseUrl}${endpoint}`;
      let res;
      let retries = 0;

      while (true) {
        res = await this._rawFetch(url, {
          headers: this._getHeaders()
        });

        if (res.status === 429 && retries < 2) {
          retries++;
          const delay = 500 * Math.pow(2, retries) + Math.random() * 200;
          await new Promise(r => setTimeout(r, delay));
          continue;
        }
        break;
      }

      if (res.status === 401 || res.status === 403) {
        const text = await res.text().catch(() => '');
        const err = new Error(`Perplexity API authentication required (HTTP ${res.status}): ${res.statusText} - ${text.slice(0, 100)}`);
        err.code = 'PERPLEXITY_AUTH_REQUIRED';
        err.status = res.status;
        throw err;
      }

      if (!res.ok) {
        const text = await res.text().catch(() => '');
        const err = new Error(`Perplexity API request failed (HTTP ${res.status}): ${text.slice(0, 100)}`);
        err.status = res.status;
        throw err;
      }

      const data = await res.json();
      if (cKey && ttl !== null) {
        set(cKey, data, ttl, 'json');
      }
      return data;
    })();

    this._inFlight.set(endpoint, fetchPromise);
    try {
      return await fetchPromise;
    } finally {
      this._inFlight.delete(endpoint);
    }
  }

  async fetchText(endpoint, options = {}) {
    const { fresh = false, ttl = null, cacheKey: customCacheKey = null } = options;
    const cKey = customCacheKey || (endpoint.startsWith('pplx:') ? endpoint : null);

    if (!fresh && cKey) {
      const cached = get(cKey);
      if (cached !== null) {
        return typeof cached === 'object' && cached !== null && 'value' in cached ? cached.value : cached;
      }
    }

    if (this._inFlight.has(endpoint)) {
      return await this._inFlight.get(endpoint);
    }

    const fetchPromise = (async () => {
      const url = endpoint.startsWith('http') ? endpoint : `${this.baseUrl}${endpoint}`;
      let res;
      let retries = 0;

      while (true) {
        res = await this._rawFetch(url, {
          headers: this._getHeaders()
        });

        if (res.status === 429 && retries < 2) {
          retries++;
          const delay = 500 * Math.pow(2, retries) + Math.random() * 200;
          await new Promise(r => setTimeout(r, delay));
          continue;
        }
        break;
      }

      if (res.status === 401 || res.status === 403) {
        const text = await res.text().catch(() => '');
        const err = new Error(`Perplexity API authentication required (HTTP ${res.status}): ${res.statusText} - ${text.slice(0, 100)}`);
        err.code = 'PERPLEXITY_AUTH_REQUIRED';
        err.status = res.status;
        throw err;
      }

      if (!res.ok) {
        const text = await res.text().catch(() => '');
        const err = new Error(`Perplexity API request failed (HTTP ${res.status}): ${text.slice(0, 100)}`);
        err.status = res.status;
        throw err;
      }

      const data = await res.text();
      if (cKey && ttl !== null) {
        set(cKey, data, ttl, 'text');
      }
      return data;
    })();

    this._inFlight.set(endpoint, fetchPromise);
    try {
      return await fetchPromise;
    } finally {
      this._inFlight.delete(endpoint);
    }
  }

  async _queryWithUsFallback(ticker, fn) {
    const norm = this.normalizeTicker(ticker);
    try {
      return await fn(norm);
    } catch (err) {
      if (err.status === 404 && norm.endsWith('.NS') && !ticker.includes('.')) {
        const bare = norm.slice(0, -3);
        return await fn(bare);
      }
      throw err;
    }
  }

  async getPriceMovementCatalysts(ticker, options = {}) {
    return this._queryWithUsFallback(ticker, async (normTicker) => {
      const limit = options.limit || 100;
      const endpoint = `/rest/finance/timeline/${normTicker}/entries?limit=${limit}`;
      const cacheKey = this.cacheKey('timeline', normTicker, `limit=${limit}`);
      const ttl = TTL.TIMELINE || (24 * 3600 * 1000);
      const raw = await this.fetchJson(endpoint, { fresh: options.fresh, ttl, cacheKey });
      return parseCatalysts(raw, normTicker);
    });
  }

  async getBrokerageReports(ticker, options = {}) {
    return this._queryWithUsFallback(ticker, async (normTicker) => {
      const endpoint = `/rest/finance/documents/${normTicker}`;
      const cacheKey = this.cacheKey('reports', normTicker);
      const ttl = 24 * 3600 * 1000;
      const raw = await this.fetchJson(endpoint, { fresh: options.fresh, ttl, cacheKey });
      return parseReports(raw, normTicker);
    });
  }

  async getEarningsIntelligence(ticker, options = {}) {
    return this._queryWithUsFallback(ticker, async (normTicker) => {
      const includeTranscript = options.includeTranscript ?? false;
      const chapterFilter = options.chapterFilter || 'prepared_remarks';

      const earningsEndpoint = `/rest/finance/earnings/${normTicker}`;
      const earningsCacheKey = this.cacheKey('earnings', normTicker);
      const earningsRaw = await this.fetchJson(earningsEndpoint, {
        fresh: options.fresh,
        ttl: 7 * 86400 * 1000,
        cacheKey: earningsCacheKey
      });

      const list = Array.isArray(earningsRaw) ? earningsRaw : [];
      const activeEvent = options.eventId
        ? list.find(e => e && e.id === Number(options.eventId))
        : (list.find(e => e && e.actualRevenue != null) || list[0]);

      if (!activeEvent || !activeEvent.id) {
        return parseEarnings(earningsRaw, null, null, {
          ticker: normTicker,
          eventId: options.eventId,
          includeTranscript: false
        });
      }

      const eventId = activeEvent.id;

      // Stagger request by 150ms before analysis
      await new Promise(r => setTimeout(r, 150));

      let analysisRaw = null;
      try {
        const analysisEndpoint = `/rest/finance/earnings/${normTicker}/analysis/${eventId}`;
        const analysisCacheKey = this.cacheKey('earnings_analysis', normTicker, `event=${eventId}`);
        analysisRaw = await this.fetchJson(analysisEndpoint, {
          fresh: options.fresh,
          ttl: 30 * 86400 * 1000,
          cacheKey: analysisCacheKey
        });
      } catch (err) {
        if (err.status !== 404) throw err;
      }

      let transcriptRaw = null;
      if (includeTranscript) {
        // Stagger request by 150ms before transcript
        await new Promise(r => setTimeout(r, 150));
        try {
          const transcriptEndpoint = `/rest/finance/earnings/${normTicker}/transcript/${eventId}`;
          const transcriptCacheKey = this.cacheKey('earnings_transcript', normTicker, `event=${eventId}`);
          transcriptRaw = await this.fetchJson(transcriptEndpoint, {
            fresh: options.fresh,
            ttl: 30 * 86400 * 1000,
            cacheKey: transcriptCacheKey
          });
        } catch (err) {
          if (err.status !== 404) throw err;
        }
      }

      return parseEarnings(earningsRaw, analysisRaw, transcriptRaw, {
        ticker: normTicker,
        eventId,
        includeTranscript,
        chapterFilter
      });
    });
  }

  async getCompanyStrategicProfile(ticker, options = {}) {
    return this._queryWithUsFallback(ticker, async (normTicker) => {
      const quoteEndpoint = `/rest/finance/quote/${normTicker}`;
      const quoteCacheKey = this.cacheKey('quote', normTicker);
      const descEndpoint = `/rest/finance/profile/${normTicker}/description`;
      const descCacheKey = this.cacheKey('profile_description', normTicker);

      const [quoteRes, descRes] = await Promise.allSettled([
        this.fetchJson(quoteEndpoint, { fresh: options.fresh, ttl: 2 * 3600 * 1000, cacheKey: quoteCacheKey }),
        this.fetchText(descEndpoint, { fresh: options.fresh, ttl: 7 * 86400 * 1000, cacheKey: descCacheKey })
      ]);

      if (quoteRes.status === 'rejected') {
        throw quoteRes.reason;
      }

      const quoteRaw = quoteRes.value;
      const descRaw = descRes.status === 'fulfilled' ? descRes.value : '';

      return parseProfile(quoteRaw, descRaw, normTicker);
    });
  }

  async getCuratedNews(ticker, options = {}) {
    return this._queryWithUsFallback(ticker, async (normTicker) => {
      const limit = options.limit || 10;
      const endpoint = `/rest/finance/publisher-news/${normTicker}?limit=${limit}`;
      const cacheKey = this.cacheKey('news', normTicker, `limit=${limit}`);
      const ttl = TTL.NEWS || (3600 * 1000);
      const raw = await this.fetchJson(endpoint, { fresh: options.fresh, ttl, cacheKey });
      return parseNews(raw, normTicker);
    });
  }
}
