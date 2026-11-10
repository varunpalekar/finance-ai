import fs from 'node:fs';
import { get, set, TTL } from '../cache.js';

export class SessionManager {
  constructor({
    sessionPath,
    baseUrl = 'https://www.tijorifinance.com',
    fetchFn = globalThis.fetch,
    cacheEnabled = true,
    fetchClient = null,
  } = {}) {
    this._sessionPath = sessionPath;
    this.baseUrl = baseUrl;
    this.fetchFn = fetchFn;
    this.cacheEnabled = cacheEnabled;
    this.fetchClient = fetchClient;
    this._sessionMtime = 0;
    this._session = { cookieHeader: '', csrfToken: '' };
    this.loadSession();
  }

  get sessionPath() {
    return this.fetchClient?.sessionPath ?? this._sessionPath;
  }

  set sessionPath(val) {
    this._sessionPath = val;
  }

  loadSession() {
    try {
      if (this.sessionPath && fs.existsSync(this.sessionPath)) {
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
    this.loadSession();
    if (!this.sessionPath || !fs.existsSync(this.sessionPath)) {
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
    if (!this.sessionPath || !fs.existsSync(this.sessionPath)) {
      return {
        valid: false,
        reason: 'SESSION_MISSING',
        message: `Session file not found at ${this.sessionPath}. Run "npm run auth" to log in.`,
      };
    }

    this.loadSession();
    if (!this._session.cookieHeader || !this._session.cookieHeader.includes('sessionid=')) {
      return {
        valid: false,
        reason: 'SESSIONID_MISSING',
        message: 'No sessionid cookie found in session file. Run "npm run auth" to re-authenticate.',
      };
    }

    if (probe) {
      try {
        const fetchFn = this.fetchFn || globalThis.fetch;
        const res = await fetchFn(`${this.baseUrl}/alerts/`, {
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

    if (!this.fetchClient || typeof this.fetchClient._fetch !== 'function') {
      throw new Error('fetchClient._fetch is required for getUserInfo');
    }

    const fetched = await this.fetchClient._fetch('/account/subscription/', { cacheKey, fresh });
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
}
