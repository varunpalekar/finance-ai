import * as cheerio from 'cheerio';

export function extractSectionTable(html, sectionId) {
  const $ = cheerio.load(html);
  const section = $(`#${sectionId}`);
  const container = section.length ? section : $('body');

  const headTable = container.find('.dt-scroll-head table, .dataTables_scrollHead table, thead');
  const allHeadCells = [];
  const targetHeads = headTable.length ? headTable.find('thead th, thead td') : container.find('thead th, thead td');
  targetHeads.each((_, th) => {
    const t = $(th).text().trim();
    if (t) allHeadCells.push(t);
  });

  const periodHeaders = allHeadCells.filter(h => h.length > 0 && h.toLowerCase() !== 'metric' && h.toLowerCase() !== 'name');

  const bodyTable = container.find('.dt-scroll-body table, .dataTables_scrollBody table, table');
  const rows = [];

  bodyTable.find('tbody tr').each((_, tr) => {
    const labelDiv = $(tr).find('.nameofmetriccol');
    const firstCol = $(tr).find('.firstcol, td:first-child');
    const label = labelDiv.text().trim() || firstCol.find('a').text().trim() || firstCol.text().trim();
    if (!label) return;

    const unit = labelDiv.attr('data-unit') || null;
    const parentAttr = $(tr).attr('parent');
    const depth = parentAttr !== undefined && parentAttr !== null ? parseInt(parentAttr, 10) : null;

    const dataCells = $(tr).find('td.numericvalue, td.knowledge.numericvalue');
    const cells = dataCells.length ? dataCells : $(tr).find('td').slice(1);
    const values = [];

    cells.each((_, td) => {
      const raw = $(td).text().trim().replace(/\s+/g, ' ');
      values.push(raw === '—' || raw === '-' || raw === '' ? null : raw);
    });

    const row = { metric: label };
    if (unit) row.unit = unit;
    if (depth !== null && !isNaN(depth)) row.depth = depth;

    values.forEach((val, i) => {
      const header = periodHeaders[i];
      if (header) row[header] = val;
    });

    rows.push(row);
  });

  return { headers: ['metric', ...periodHeaders], rows };
}

export function parseRawMaterialsHtml(html, tab) {
  return extractSectionTable(html, tab);
}

export function parseMacroIndicatorsHtml(html, tab) {
  return extractSectionTable(html, tab);
}

export function parseMarketsHtml(html, tab) {
  const $ = cheerio.load(html);

  if (tab === 'conglomerates') {
    let wrapper = $('#market__table__groups, #market__table__groups_wrapper');
    if (!wrapper.length) wrapper = $('#conglomerates');
    const rows = [];
    wrapper.find('tbody tr').each((_, tr) => {
      if ($(tr).attr('parent') !== '1') return;
      const nameDiv = $(tr).find('.nameofmetriccol');
      const rawLabel = nameDiv.length ? nameDiv.text() : $(tr).find('td:first-child').text();
      const label = rawLabel.replace(/\s*\+\s*$/, '').trim().split('\n')[0].trim();
      if (label) {
        rows.push({
          conglomerate: label,
          tjiid: $(tr).attr('tjiid') ?? null,
          myid: $(tr).attr('myid') ?? null,
        });
      }
    });
    return { headers: ['conglomerate', 'tjiid', 'myid'], rows };
  } else if (tab === 'niche') {
    let wrapper = $('#market__table__niche, #market__table__niche_wrapper');
    if (!wrapper.length) wrapper = $('#niche');
    const firstThead = wrapper.find('thead').first();
    const headCells = [];
    firstThead.find('th, td').each((_, th) => {
      const t = $(th).text().trim();
      if (t) headCells.push(t);
    });
    const periodHeaders = headCells.filter(h => h.length > 0 && h.toLowerCase() !== 'sector' && h.toLowerCase() !== 'name' && h.toLowerCase() !== 'in %');

    const rows = [];
    wrapper.find('tbody tr').each((_, tr) => {
      if ($(tr).attr('parent') !== '1') return;
      const nameDiv = $(tr).find('.nameofmetriccol');
      const rawLabel = nameDiv.length ? nameDiv.text() : $(tr).find('td:first-child').text();
      const label = rawLabel.replace(/\s*\+\s*$/, '').trim().split('\n')[0].trim();
      if (!label) return;

      const tjiid = $(tr).attr('tjiid') ?? null;
      const myid = $(tr).attr('myid') ?? null;

      const dataCells = $(tr).find('td.numericvalue, td.knowledge.numericvalue');
      const cells = dataCells.length ? dataCells : $(tr).find('td').slice(1);
      const values = [];

      cells.each((_, td) => {
        const raw = $(td).text().trim().replace(/\s+/g, ' ');
        values.push(raw === '—' || raw === '-' || raw === '' ? null : raw);
      });

      const row = { sector: label, tjiid, myid };
      values.forEach((val, i) => {
        const header = periodHeaders[i];
        if (header) row[header] = val;
      });
      rows.push(row);
    });
    return { headers: ['sector', 'tjiid', 'myid', ...periodHeaders], rows };
  }

  return extractSectionTable(html, tab);
}

export function parseMarketShareHtml(html, { slug = '' } = {}) {
  const $ = cheerio.load(html);
  const metrics = [];

  $('.market_share_card').each((_, card) => {
    const text = $(card).text() ?? '';
    const valueMatch = text.match(/([\d.]+)\s*%/);
    const dateMatch = text.match(/\(as of ([^)]+)\)/i) || text.match(/\(([^)]+)\)/);
    const metric = $(card).attr('data-title') || $(card).find('.name').text().trim();
    if (metric) {
      metrics.push({
        metric,
        value: valueMatch ? parseFloat(valueMatch[1]) : null,
        as_of: dateMatch ? dateMatch[1].trim() : null,
      });
    }
  });

  return metrics.length === 0
    ? { slug, metrics: [], note: 'No market share data available for this company.' }
    : { slug, metrics };
}

export function parseRevenueMixCharts(html) {
  const $ = cheerio.load(html);
  const charts = [];
  $('.rmix_graph_block').each((_, block) => {
    const pieEl = $(block).find('.rmix_pie_chart[chart-id]');
    if (!pieEl.length) return;
    let latest = [];
    try { latest = JSON.parse(pieEl.attr('chart-data') ?? '[]'); } catch {}
    charts.push({
      chartId: pieEl.attr('chart-id'),
      title: $(block).find('h4').text().trim() || null,
      latest_breakdown: latest.map(([name, pct]) => ({ name, pct })),
    });
  });

  if (charts.length === 0) {
    $('.rmix_pie_chart[chart-id]').each((_, pieEl) => {
      let latest = [];
      try { latest = JSON.parse($(pieEl).attr('chart-data') ?? '[]'); } catch {}
      charts.push({
        chartId: $(pieEl).attr('chart-id'),
        title: $(pieEl).closest('div').find('h4').text().trim() || null,
        latest_breakdown: latest.map(([name, pct]) => ({ name, pct })),
      });
    });
  }
  return charts;
}

export function parseKnowledgeBaseHtml(html, { slug = '' } = {}) {
  const $ = cheerio.load(html);

  const categories = {
    annual_reports: [],
    earnings_releases: [],
    investor_presentations: [],
    conference_calls: [],
  };

  $('a[href*="files.tijorifinance.com"]').each((_, a) => {
    const href = $(a).attr('href') ?? '';
    if (!href) return;
    const file = href.split('/').pop()?.replace('.pdf', '') ?? '';
    let period = file;
    const annualMatch = file.match(/^AR-(\d{2})/);
    const quarterlyMatch = file.match(/^(?:CC|ER|IP)-([A-Za-z]{3})(\d{2})/);
    if (annualMatch) period = `FY${annualMatch[1]}`;
    else if (quarterlyMatch) period = `${quarterlyMatch[1]} 20${quarterlyMatch[2]}`;

    const entry = { period, url: href };
    if (href.includes('Annual%20Report') || href.includes('Annual+Report') || href.includes('AR-')) {
      categories.annual_reports.push(entry);
    } else if (href.includes('Earnings%20Release') || href.includes('Earnings+Release') || href.includes('ER-')) {
      categories.earnings_releases.push(entry);
    } else if (href.includes('Investor%20Presentation') || href.includes('Investor+Presentation') || href.includes('IP-')) {
      categories.investor_presentations.push(entry);
    } else if (href.includes('Conference%20Call') || href.includes('Conference+Call') || href.includes('CC-')) {
      categories.conference_calls.push(entry);
    }
  });

  return { slug, ...categories };
}

export function parseOperationalMetricsInitial(html) {
  const $ = cheerio.load(html);

  const allMetrics = [];
  $('li[metricid]').each((_, li) => {
    const mId = parseInt($(li).attr('metricid'), 10);
    const name = $(li).attr('title') || $(li).text().trim();
    const unit = $(li).attr('unit')?.trim() || null;
    const indent = $(li).attr('indent') || '0';
    if (mId && name) {
      allMetrics.push({ metric_id: mId, name, unit, indent });
    }
  });

  const onclickAttr = $('li[metricid][onclick]').attr('onclick') || '';
  const idMatch = onclickAttr.match(/company_op_metrics\/(\d+)\//);
  let companyId = idMatch ? parseInt(idMatch[1], 10) : null;
  if (!companyId) {
    const scriptIdMatch = html.match(/"company_id"\s*:\s*(\d+)/);
    if (scriptIdMatch) companyId = parseInt(scriptIdMatch[1], 10);
  }

  const topLevel = allMetrics.filter(m => m.indent === '0');
  const targetMetrics = topLevel.length > 0 ? topLevel : allMetrics;

  return { companyId, targetMetrics };
}
