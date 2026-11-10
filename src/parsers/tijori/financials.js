import * as cheerio from 'cheerio';

export const TYPE_TO_SECTION = {
  pl: { section: 'profit_and_loss', label: 'P&L' },
  bs: { section: 'balance_sheet', label: 'balance sheet' },
  cf: { section: 'cash_flow', label: 'cash flow' },
  ratios: { section: 'ratios', label: 'ratios' },
  quarterly: { section: 'quarterly_results', label: 'quarterly results' },
};

/**
 * Parses financial statements (P&L, Balance Sheet, Cash Flow, Ratios, Quarterly)
 * from HTML or embedded SSR JSON.
 */
export function parseFinancialsHtml(html, { type = 'pl', basis = 'consolidated', slug = '' } = {}) {
  const typeInfo = TYPE_TO_SECTION[type];
  if (!typeInfo) throw new Error(`Unsupported financial statement type: ${type}`);
  if (!['consolidated', 'standalone'].includes(basis)) {
    throw new Error(`Unsupported reporting basis: ${basis}`);
  }

  const sectionId = typeInfo.section;
  const unavailable = () => {
    throw new Error(`Requested ${basis} ${typeInfo.label} statement is unavailable${slug ? ` for ${slug}` : ''}`);
  };

  const $ = cheerio.load(html);

  // 1. Try extracting from embedded JSON script blob (Tijori SSR pattern)
  let embeddedData = null;
  $('script:not([src])').each((_, s) => {
    const text = $(s).text().trim();
    if (text.startsWith('{"bs_s_s"') || (text.includes('"report_dates"') && text.includes('"data"'))) {
      try {
        embeddedData = JSON.parse(text);
        return false;
      } catch (_) {}
    }
  });

  if (embeddedData) {
    let section = null;
    const basisKey = basis === 'consolidated' ? 'c' : 's';
    const keys = type === 'pl' || type === 'bs'
      ? [`${type}_${basisKey}_s`, `${type}_${basisKey}_d`]
      : [{
          cf: `cf_${basisKey}`,
          ratios: `fr_${basisKey}`,
          quarterly: `qt_${basisKey}`,
        }[type]];
    section = keys.map(key => embeddedData[key]).find(Boolean) || null;

    if (section && section.report_dates && Array.isArray(section.data)) {
      const periodHeaders = section.report_dates;
      const rows = [];
      const appendRows = (items, parentHierarchy = []) => {
        for (const item of items) {
          const hierarchy = [...parentHierarchy, item.name];
          const row = { metric: item.name, hierarchy };
          (Array.isArray(item.value) ? item.value : []).forEach((val, i) => {
            const h = periodHeaders[i];
            if (h) {
              row[h] = val === null || val === undefined ? null : String(val);
            }
          });
          rows.push(row);
          if (Array.isArray(item.sub_section)) {
            appendRows(item.sub_section, hierarchy);
          }
        }
      };
      appendRows(section.data);

      return {
        type,
        reporting_basis: basis,
        currency: 'INR',
        denomination: 'Crores (1 Cr = 10,000,000 INR)',
        notes: 'Amounts in ₹ Crores, ratios in %, EPS in INR per share.',
        headers: ['metric', ...periodHeaders],
        rows
      };
    }
  }

  const wrapper = $(`#${sectionId}_table_wrapper`).first().length
    ? $(`#${sectionId}_table_wrapper`).first()
    : $(`#company_table_innertab_${sectionId}_content .dt-container`).first();
  if (!wrapper.length) unavailable();

  const declaredBasis = wrapper.attr('data-reporting-basis');
  const activeBasis = ['consolidated', 'standalone'].find(value =>
    $(`[data-toggle="${value}"].active, [data-toggle="${value}"][aria-selected="true"]`).length > 0
  );
  if ((declaredBasis && declaredBasis !== basis) || (!declaredBasis && activeBasis !== basis)) {
    unavailable();
  }

  // Parse only the requested statement container; never substitute another table.
  const periodHeaders = [];
  wrapper.find('thead th.headerItem, thead th').each((_, th) => {
    const t = $(th).text().trim();
    if (t && !$(th).hasClass('firstcol') && !$(th).hasClass('compare_col')) {
      periodHeaders.push(t);
    }
  });

  const rows = [];
  wrapper.find('tbody tr').each((_, tr) => {
    const label = $(tr).attr('data-id') || $(tr).find('td.firstcol, th:first-child').text().trim();
    if (!label) return;

    const valueCells = $(tr).find('td.knowledge.numericvalue, td.numericvalue');
    const cells = valueCells.length ? valueCells : $(tr).find('td:not(.firstcol):not(.compare_col)');
    const values = [];

    cells.each((_, td) => {
      const raw = $(td).text().trim().replace(/\s+/g, ' ');
      values.push(raw === '—' || raw === '-' || raw === '' ? null : raw);
    });

    const row = { metric: label };
    values.forEach((val, i) => {
      const header = periodHeaders[i];
      if (header) row[header] = val;
    });
    rows.push(row);
  });

  if (periodHeaders.length === 0 || rows.length === 0) unavailable();

  return {
    type,
    reporting_basis: basis,
    currency: 'INR',
    denomination: 'Crores (1 Cr = 10,000,000 INR)',
    notes: `Amounts in ₹ Crores, ratios in %, EPS in INR per share. Reporting basis: ${basis}.`,
    headers: ['metric', ...periodHeaders],
    rows
  };
}
