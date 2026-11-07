import assert from 'node:assert/strict';
import { test, beforeEach } from 'node:test';
import { get, set, prune, initDb, clear } from '../src/cache.js';

beforeEach(() => {
  initDb(':memory:');
});

test('set with ttl stores fetched_at ISO timestamp, slug, and expires_at', () => {
  set('overview:tata-steel-limited', { foo: 'bar' }, 60000, 'json', 'tata-steel-limited');
  const result = get('overview:tata-steel-limited');
  assert.ok(result);
  assert.equal(result.foo, 'bar');
  assert.ok(result._cache_meta);
  assert.equal(result._cache_meta.is_cached, true);
  assert.ok(typeof result._cache_meta.fetched_at === 'string');
  assert.ok(result._cache_meta.expires_at !== null);
  assert.equal(result._cache_meta.permanent, false);
});

test('set with null ttl stores permanent entry that survives prune', () => {
  set('doc:permanent', { text: 'immutable concall' }, null, 'json');
  prune(Date.now() + 1000000); // Prune into future
  const result = get('doc:permanent');
  assert.ok(result);
  assert.equal(result.text, 'immutable concall');
  assert.equal(result._cache_meta.permanent, true);
  assert.equal(result._cache_meta.expires_at, null);
});

test('allowStale returns expired row with is_stale: true when offline', () => {
  set('financials:tata:pl', { revenue: 100 }, 1000, 'json', 'tata'); // 1s TTL
  const expired = get('financials:tata:pl', { allowStale: false, now: Date.now() + 5000 });
  assert.equal(expired, null, 'Should return null for strict check');
  
  const stale = get('financials:tata:pl', { allowStale: true, now: Date.now() + 5000 });
  assert.ok(stale);
  assert.equal(stale.revenue, 100);
  assert.equal(stale._cache_meta.is_stale, true);
});

test('selective clear removes only targeted stock via indexed slug without wildcard injection', () => {
  set('overview:tata-steel-limited', { name: 'Tata Steel' }, 60000, 'json', 'tata-steel-limited');
  set('overview:reliance-industries-limited', { name: 'Reliance' }, 60000, 'json', 'reliance-industries-limited');
  set('overview:special%stock', { name: 'Special' }, 60000, 'json', 'special%stock');
  
  // Test pattern character safety: clearing with '%' must not wipe all stocks
  clear('%');
  assert.ok(get('overview:tata-steel-limited'), 'Tata Steel must remain intact');
  
  clear('tata-steel-limited');
  assert.equal(get('overview:tata-steel-limited'), null);
  assert.ok(get('overview:reliance-industries-limited'), 'Reliance must remain intact');
});
