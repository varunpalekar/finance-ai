import * as cheerio from 'cheerio';

function findBestShareholdingTable($) {
  let bestTable = null;
  let bestColCount = 0;

  $('table').each((_, tbl) => {
    const text = $(tbl).text().toLowerCase();
    const hasSh = text.includes('promoter') && (text.includes('public') || text.includes('fii') || text.includes('foreign') || text.includes('institutions'));
    if (!hasSh) return;

    const colCount = $(tbl).find('tr:first-child th, tr:first-child td').length;
    if (colCount > bestColCount) {
      bestColCount = colCount;
      bestTable = $(tbl);
    }
  });

  return bestTable;
}

export function parseShareholdingSummaryHtml(html) {
  const $ = cheerio.load(html);
  const bestTable = findBestShareholdingTable($);

  if (!bestTable) {
    return { quarters: [], error: 'Shareholding table not found' };
  }

  const trs = bestTable.find('tr');
  if (trs.length < 2) {
    return { quarters: [], error: 'Table has too few rows' };
  }

  const headerCells = [];
  trs.first().find('th, td').each((_, td) => headerCells.push($(td).text().trim()));
  const quarterPeriods = headerCells.slice(1).filter(Boolean);

  const quarterMap = {};
  quarterPeriods.forEach(p => { quarterMap[p] = { period: p }; });

  trs.slice(1).each((_, tr) => {
    const cells = [];
    $(tr).find('td, th').each((_, td) => cells.push($(td).text().trim()));
    if (cells.length < 2) return;
    const category = cells[0];
    if (!category) return;

    cells.slice(1).forEach((val, idx) => {
      const period = quarterPeriods[idx];
      if (!period) return;
      const cleaned = val.replace('%', '').trim();
      if (cleaned === '—' || cleaned === '-' || cleaned === '' || cleaned === '–') {
        quarterMap[period][category] = null;
      } else {
        const num = parseFloat(cleaned.replace(/,/g, ''));
        quarterMap[period][category] = isNaN(num) ? val : num;
      }
    });
  });

  const quarters = Object.values(quarterMap).filter(q => Object.keys(q).length > 1);
  return { quarters };
}

export function parseShareholdingDetailedHtml(html, { slug = '' } = {}) {
  const $ = cheerio.load(html);
  const bestTable = findBestShareholdingTable($);

  if (!bestTable) {
    return { quarters: [], error: 'Shareholding table not found' };
  }

  const trs = bestTable.find('tr');
  if (trs.length < 2) {
    return { quarters: [], error: 'Table has too few rows' };
  }

  const headerCells = [];
  trs.first().find('th, td').each((_, td) => headerCells.push($(td).text().trim()));
  const quarterPeriods = headerCells.slice(1).filter(Boolean);

  const summaryRows = [];
  const institutions = [];
  const nonInstitutions = [];
  let currentSection = 'summary';

  trs.slice(1).each((_, tr) => {
    const cells = [];
    $(tr).find('td, th').each((_, td) => cells.push($(td).text().trim().replace(/\s+/g, ' ')));
    if (cells.length < 2) return;
    const name = cells[0];
    if (!name) return;

    const lowerName = name.toLowerCase();
    if (lowerName === 'institutions') {
      currentSection = 'institutions';
    } else if (lowerName === 'non-institutions') {
      currentSection = 'non_institutions';
    }

    const values = [];
    cells.slice(1).forEach((val, idx) => {
      if (idx >= quarterPeriods.length) return;
      const cleaned = val.replace('%', '').trim();
      if (cleaned === '—' || cleaned === '-' || cleaned === '' || cleaned === '–') {
        values.push(null);
      } else {
        const num = parseFloat(cleaned.replace(/,/g, ''));
        values.push(isNaN(num) ? val : num);
      }
    });

    const rowObj = {
      name,
      shares_pct: values,
    };

    if (currentSection === 'institutions' && lowerName !== 'institutions') {
      institutions.push(rowObj);
    } else if (currentSection === 'non_institutions' && lowerName !== 'non-institutions') {
      nonInstitutions.push(rowObj);
    } else {
      summaryRows.push(rowObj);
    }
  });

  return {
    slug,
    detailed: true,
    quarters: quarterPeriods,
    summary: summaryRows,
    institutions,
    non_institutions: nonInstitutions,
  };
}
