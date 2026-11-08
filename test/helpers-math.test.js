import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computePercentiles } from '../src/helpers.js';
import { TTL } from '../src/cache.js';

test('computePercentiles calculates exact percentiles, min, max, and median on numeric dataset', () => {
  // 100-point linear sequence 1..100
  const data = Array.from({ length: 100 }, (_, i) => i + 1);
  const res = computePercentiles(data, [0.25, 0.5, 0.75]);
  assert.equal(res.min, 1);
  assert.equal(res.max, 100);
  assert.equal(res.p25, 25.75);
  assert.equal(res.p50, 50.5);
  assert.equal(res.p75, 75.25);
  assert.equal(res.count, 100);
});

test('computePercentiles enforces min <= p25 <= median <= p75 <= max property on unsorted data', () => {
  const data = [45.2, 12.1, 89.4, 33.0, 55.6, 21.8, 67.3, 10.5, 95.0, 41.2];
  const res = computePercentiles(data, [0.25, 0.5, 0.75]);
  assert.ok(res.min <= res.p25);
  assert.ok(res.p25 <= res.p50);
  assert.ok(res.p50 <= res.p75);
  assert.ok(res.p75 <= res.max);
  assert.equal(res.count, 10);
});

test('computePercentiles handles single-element array without crash', () => {
  const res = computePercentiles([25.4], [0.25, 0.5, 0.75]);
  assert.equal(res.min, 25.4);
  assert.equal(res.max, 25.4);
  assert.equal(res.p50, 25.4);
  assert.equal(res.p25, 25.4);
  assert.equal(res.p75, 25.4);
  assert.equal(res.count, 1);
});

test('computePercentiles handles empty array by returning null stats and 0 count', () => {
  const res = computePercentiles([], [0.25, 0.5, 0.75]);
  assert.equal(res.min, null);
  assert.equal(res.max, null);
  assert.equal(res.p50, null);
  assert.equal(res.p25, null);
  assert.equal(res.p75, null);
  assert.equal(res.count, 0);
});

test('TTL constants exist for all expanded research domains with realistic durations in milliseconds', () => {
  assert.equal(TTL.FACTORS, 7 * 86400 * 1000, 'Factors TTL should be 7 days in ms');
  assert.equal(TTL.VALUATION, 12 * 3600 * 1000, 'Valuation TTL should be 12 hours in ms');
  assert.equal(TTL.SCENARIOS, 7 * 86400 * 1000, 'Scenarios TTL should be 7 days in ms');
  assert.equal(TTL.TIMELINE, 24 * 3600 * 1000, 'Timeline TTL should be 24 hours in ms');
  assert.equal(TTL.NEWS, 3600 * 1000, 'News TTL should be 1 hour in ms');
  assert.equal(TTL.ACTIONS, 7 * 86400 * 1000, 'Corporate actions TTL should be 7 days in ms');
  assert.equal(TTL.SUPPLY_CHAIN, 7 * 86400 * 1000, 'Supply chain TTL should be 7 days in ms');
});
