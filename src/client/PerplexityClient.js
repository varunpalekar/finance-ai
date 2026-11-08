import fs from 'node:fs';
import path from 'node:path';
import { get, set, TTL } from '../cache.js';

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
        .filter(c => c && c.name && c.value)
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
      if (cached !== null) return cached;
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
      if (cached !== null) return cached;
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
}
