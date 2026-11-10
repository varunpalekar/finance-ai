import * as cheerio from 'cheerio';
import { computePercentiles } from '../../helpers.js';

export function parseFactorsAndBenchmarkingHtml(html, { slug = '' } = {}) {
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
  return {
    slug,
    company_name: companyName,
    symbol,
    radar_axes: radarAxes,
    formulas,
    ...(hasData ? {} : { note: 'No factor benchmarking data available for this company' }),
  };
}

export function parseValuationBands(chartJson, { slug = '', companyId = null, peers = [] } = {}) {
  let rawPoints = [];
  if (chartJson?.data) {
    rawPoints = typeof chartJson.data === 'string' ? JSON.parse(chartJson.data) : chartJson.data;
  } else if (Array.isArray(chartJson)) {
    rawPoints = chartJson;
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

  return {
    slug,
    company_id: companyId,
    current_pe: currentPe,
    as_of: asOf,
    valuation_bands: valuationBands,
    peers,
    loss_making_days_excluded: lossDaysCount,
  };
}

export function parseScenarioProjectionsHtml(html, { slug = '' } = {}) {
  const $ = cheerio.load(html);

  const tables = $('.peg-sample__table');
  if (!tables.length) {
    return {
      slug,
      has_projections: false,
      scenarios: [],
      forecasts: null,
      note: 'No scenario projections available for this company',
    };
  }

  const pageCompany = $('title').text().split('|')[0].trim();
  const reportCompany = $('.peg-sample__company').first().text().trim();
  if (
    !pageCompany ||
    !reportCompany ||
    /^sample report of\b/i.test(reportCompany) ||
    pageCompany.toLocaleLowerCase() !== reportCompany.toLocaleLowerCase()
  ) {
    return {
      slug,
      has_projections: false,
      scenarios: [],
      forecasts: null,
      note: 'No verified company-specific scenario projections available',
    };
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

  return {
    slug,
    report_company: reportCompany,
    has_projections: true,
    scenarios,
    forecasts,
  };
}

export function parseValuationOverview(overviewHtml) {
  const $ = cheerio.load(overviewHtml);
  let companyId = null;
  const companyIdMatch = overviewHtml.match(/"company_id"\s*:\s*(\d+)/);
  if (companyIdMatch) {
    companyId = parseInt(companyIdMatch[1], 10);
  }

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

  return { companyId, peers };
}
