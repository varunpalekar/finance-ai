/**
 * Statistical and mathematical utility helpers.
 */

/**
 * Calculates continuous linearly interpolated percentiles, min, max, and count.
 * @param {number[]} values - Array of numeric values
 * @param {number[]} percentiles - Array of fractional percentiles (e.g. [0.25, 0.5, 0.75])
 * @returns {Record<string, number | null>} Percentile statistics dictionary
 */
export function computePercentiles(values, percentiles = [0.25, 0.5, 0.75]) {
  if (!Array.isArray(values) || values.length === 0) {
    const emptyStats = {
      min: null,
      max: null,
      count: 0,
    };
    for (const p of percentiles) {
      emptyStats[`p${Math.round(p * 100)}`] = null;
    }
    return emptyStats;
  }

  // Filter valid numbers and sort ascending
  const sorted = values
    .filter((v) => typeof v === 'number' && !Number.isNaN(v))
    .sort((a, b) => a - b);

  const n = sorted.length;
  if (n === 0) {
    const emptyStats = { min: null, max: null, count: 0 };
    for (const p of percentiles) {
      emptyStats[`p${Math.round(p * 100)}`] = null;
    }
    return emptyStats;
  }

  const result = {
    min: sorted[0],
    max: sorted[n - 1],
    count: n,
  };

  for (const p of percentiles) {
    const key = `p${Math.round(p * 100)}`;
    if (n === 1) {
      result[key] = sorted[0];
      continue;
    }
    const idx = (n - 1) * p;
    const lower = Math.floor(idx);
    const upper = Math.ceil(idx);
    const weight = idx - lower;
    if (lower === upper) {
      result[key] = sorted[lower];
    } else {
      result[key] = sorted[lower] + weight * (sorted[upper] - sorted[lower]);
    }
  }

  return result;
}
