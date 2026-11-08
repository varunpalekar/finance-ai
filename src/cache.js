import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

export const TTL = {
  MARKETS: 30 * 60 * 1000,           // 30m
  COMMODITY: 60 * 60 * 1000,         // 1h
  OVERVIEW: 2 * 60 * 60 * 1000,      // 2h
  METRICS: 30 * 24 * 60 * 60 * 1000, // 30d
  FINANCIALS: 30 * 24 * 60 * 60 * 1000, // 30d
  FACTORS: 7 * 86400 * 1000,          // 7d
  VALUATION: 12 * 3600 * 1000,        // 12h
  SCENARIOS: 7 * 86400 * 1000,        // 7d
  TIMELINE: 24 * 3600 * 1000,         // 24h
  NEWS: 3600 * 1000,                  // 1h
  ACTIONS: 7 * 86400 * 1000,          // 7d
  SUPPLY_CHAIN: 7 * 86400 * 1000,     // 7d
  SHAREHOLDING: 6 * 3600 * 1000,      // 6h
  PERMANENT: null,
};

let db = null;
let currentDbPath = null;

export function initDb(dbPath) {
  const targetPath = dbPath || path.join(os.homedir(), '.cache', 'tijori', 'cache.db');

  if (db && currentDbPath === targetPath && targetPath !== ':memory:') {
    return db;
  }

  if (targetPath !== ':memory:') {
    const dir = path.dirname(targetPath);
    try {
      fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
      fs.chmodSync(dir, 0o700);
    } catch (_) {}
  }

  db = new DatabaseSync(targetPath);
  currentDbPath = targetPath;

  if (targetPath !== ':memory:') {
    try {
      db.exec('PRAGMA journal_mode = WAL;');
      db.exec('PRAGMA synchronous = NORMAL;');
    } catch (_) {}
  }

  db.exec(`
    CREATE TABLE IF NOT EXISTS http_cache (
      key TEXT PRIMARY KEY,
      slug TEXT,
      value TEXT NOT NULL,
      content_type TEXT NOT NULL,
      fetched_at TEXT NOT NULL,
      expires_at INTEGER,
      created_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_cache_slug ON http_cache(slug);
    CREATE INDEX IF NOT EXISTS idx_cache_expires ON http_cache(expires_at);
  `);

  return db;
}

function getDb() {
  if (!db) {
    initDb();
  }
  return db;
}

export function get(key, { allowStale = false, now = Date.now() } = {}) {
  const database = getDb();
  const row = database
    .prepare('SELECT value, content_type, fetched_at, expires_at FROM http_cache WHERE key = ?')
    .get(key);

  if (!row) return null;

  const isExpired = row.expires_at !== null && row.expires_at <= now;
  if (isExpired && !allowStale) return null;

  let parsed;
  if (row.content_type === 'json') {
    try {
      parsed = JSON.parse(row.value);
    } catch {
      parsed = row.value;
    }
  } else {
    parsed = row.value;
  }

  const meta = {
    is_cached: true,
    is_stale: isExpired,
    fetched_at: row.fetched_at,
    expires_at: row.expires_at ? new Date(row.expires_at).toISOString() : null,
    permanent: row.expires_at === null,
  };

  if (parsed && typeof parsed === 'object') {
    parsed._cache_meta = meta;
    return parsed;
  }

  return { value: parsed, _cache_meta: meta };
}

export function set(key, value, ttlMs, contentType = 'json', slug = null) {
  const database = getDb();
  const now = Date.now();
  const fetchedAt = new Date(now).toISOString();
  const expiresAt = ttlMs === null || ttlMs === undefined ? null : now + ttlMs;
  const valStr = contentType === 'json' ? JSON.stringify(value) : String(value);

  const stmt = database.prepare(`
    INSERT INTO http_cache (key, slug, value, content_type, fetched_at, expires_at, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(key) DO UPDATE SET
      slug = excluded.slug,
      value = excluded.value,
      content_type = excluded.content_type,
      fetched_at = excluded.fetched_at,
      expires_at = excluded.expires_at,
      created_at = excluded.created_at
  `);

  stmt.run(key, slug, valStr, contentType, fetchedAt, expiresAt, now);
}

export function prune(now = Date.now()) {
  const database = getDb();
  database.prepare('DELETE FROM http_cache WHERE expires_at IS NOT NULL AND expires_at <= ?').run(now);
}

export function clear(slug = null) {
  const database = getDb();
  if (slug) {
    database.prepare('DELETE FROM http_cache WHERE slug = ?').run(slug);
  } else {
    database.prepare('DELETE FROM http_cache').run();
  }
}
