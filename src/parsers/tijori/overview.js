import * as cheerio from 'cheerio';

export function parseCompanyOverviewHtml(html, { slug = '' } = {}) {
  const $ = cheerio.load(html);
  const result = { slug };

  $('script:not([src])').each((_, s) => {
    const text = $(s).text().trim();
    if (text.includes('company_id') && text.startsWith('{')) {
      try {
        const parsed = JSON.parse(text);
        const { company, company_id, symbol, shortname, slug: sSlug, ind_code, is_banking, mcap, pe, mcap_raw } = parsed;
        const rawMcapVal = typeof mcap_raw === 'number'
          ? mcap_raw
          : (typeof mcap === 'number'
              ? mcap
              : (typeof mcap === 'string'
                  ? parseFloat(mcap.replace(/[^\d.]/g, '')) || null
                  : null));
        const mcapCrores = rawMcapVal !== null && !isNaN(rawMcapVal) ? rawMcapVal : null;
        const mcapInr = mcapCrores !== null ? Math.round(mcapCrores * 1e7) : null;

        Object.assign(result, {
          company,
          company_id,
          symbol,
          shortname,
          slug: sSlug || slug,
          ind_code,
          is_banking,
          mcap,
          mcap_raw: rawMcapVal,
          mcap_crores: mcapCrores,
          mcap_inr: mcapInr,
          currency: 'INR',
          denomination_scale: 'Crores (1 Cr = 10,000,000 INR)',
          pe,
        });
        if (parsed.quick_look) result.quick_look = parsed.quick_look;
      } catch (_) {}
    }
  });

  if (!result.currency) {
    result.currency = 'INR';
    result.denomination_scale = 'Crores (1 Cr = 10,000,000 INR)';
  }

  const ratios = {};
  $('.custom_ratio').each((_, el) => {
    const label = $(el).find('.custom_ratio__field_name').text().trim();
    const value = $(el).find('.custom_ratio__field_value').text().trim().replace(/\s+/g, ' ');
    if (label && value) {
      ratios[label] = value;
    }
  });
  if (Object.keys(ratios).length > 0) result.ratios = ratios;

  const msCards = [];
  $('.market_share_card').each((_, card) => {
    const title = $(card).attr('data-title') || $(card).find('.name').text().trim();
    const value = $(card).find('.values > div:first-child').text().trim() || null;
    const asof = $(card).find('.asof').text().trim().replace(/[()]/g, '').trim() || null;
    if (title) {
      msCards.push({ metric: title, value, as_of: asof });
    }
  });
  if (msCards.length > 0) result.market_share = msCards;

  const pieCharts = [];
  $('.rmix_pie_chart[chart-data]').each((_, el) => {
    const title = $(el).closest('.charts_cont').find('h4').text().trim() || null;
    try {
      const segments = JSON.parse($(el).attr('chart-data') || '[]');
      const parsed = segments.map(([name, pct]) => ({ name, pct: Math.round(pct * 10) / 10 }));
      if (parsed.length > 0) {
        pieCharts.push({ title, segments: parsed });
      }
    } catch (_) {}
  });
  if (pieCharts.length > 0) result.revenue_mix = pieCharts;

  if (!result.company) {
    const title = $('title').text() || '';
    result.company = title.split('|')[0].trim();
  }

  return result;
}

export function parseCompanyTimelineHtml(html, { slug = '' } = {}) {
  const $ = cheerio.load(html);

  let keyEvents = [];
  let whatToWatch = {
    analyst_summary: '',
    items: [],
    peg_summary: null,
  };

  const scriptEl = $('#company_details_data');
  try {
    if (scriptEl.length) {
      const data = JSON.parse(scriptEl.html());
      if (data.memory_overview?.key_events && Array.isArray(data.memory_overview.key_events)) {
        keyEvents = data.memory_overview.key_events.map((ev) => ({
          date: ev.chart_date || ev.date || null,
          label: ev.label || '',
        }));
      }
      const theRead = Array.isArray(data.memory_overview?.the_read)
        ? data.memory_overview.the_read.join(' ')
        : '';
      whatToWatch = {
        analyst_summary: theRead || data.peg_summary || '',
        items: data.memory_overview?.what_to_watch || [],
        peg_summary: data.peg_summary || null,
      };
    }
  } catch (_) {}

  if (!scriptEl.length) {
    $('script').each((_, el) => {
      const text = $(el).html() || '';
      if (text.includes('key_events')) {
        try {
          const parsed = JSON.parse(text);
          const events = parsed.key_events || parsed.memory_overview?.key_events;
          if (Array.isArray(events)) {
            keyEvents = events.map((ev) => ({
              date: ev.chart_date || ev.date || null,
              label: ev.label || '',
            }));
          }
        } catch (_) {}
      }
    });
  }

  // Deterministically sort key events chronologically
  keyEvents.sort((a, b) => (a.date || '').localeCompare(b.date || ''));

  return {
    slug,
    key_events: keyEvents,
    what_to_watch: whatToWatch,
  };
}

export function parseCorporateActionsHtml(html, { slug = '' } = {}) {
  const $ = cheerio.load(html);

  let dividends = [];
  let splits = [];
  let bonuses = [];
  let rights = [];

  const scriptEl = $('#corporate_actions');
  if (scriptEl.length) {
    try {
      const parsed = JSON.parse(scriptEl.html());
      if (Array.isArray(parsed.Dividend)) dividends = parsed.Dividend;
      if (Array.isArray(parsed.Split)) splits = parsed.Split;
      if (Array.isArray(parsed.Bonus)) bonuses = parsed.Bonus;
      if (Array.isArray(parsed.Rights)) rights = parsed.Rights;
    } catch (_) {}
  }

  if (!scriptEl.length) {
    $('script').each((_, el) => {
      const text = $(el).html() || '';
      if (text.includes('Dividend') && (text.includes('Bonus') || text.includes('Split'))) {
        try {
          const parsed = JSON.parse(text);
          if (Array.isArray(parsed.Dividend)) dividends = parsed.Dividend;
          if (Array.isArray(parsed.Split)) splits = parsed.Split;
          if (Array.isArray(parsed.Bonus)) bonuses = parsed.Bonus;
          if (Array.isArray(parsed.Rights)) rights = parsed.Rights;
        } catch (_) {}
      }
    });
  }

  return {
    slug,
    dividends,
    splits,
    bonuses,
    rights,
  };
}

export function parseSupplyChainHtml(html, { slug = '' } = {}) {
  const $ = cheerio.load(html);

  let operationalSupplierNotes = [];
  let operationalCustomerNotes = [];
  // shortcut: relational products graph requires dedicated entity mapping endpoint, deferred to FEAT-024
  let relationalProducts = [];
  let industriesCatered = [];

  const scriptEl = $('#company_details_data');
  try {
    if (scriptEl.length) {
      const data = JSON.parse(scriptEl.html());
      if (data.sector) industriesCatered.push(data.sector);

      const sentences = [];
      if (Array.isArray(data.memory_overview?.the_read)) {
        sentences.push(...data.memory_overview.the_read);
      }
      if (Array.isArray(data.memory_overview?.what_to_watch)) {
        for (const item of data.memory_overview.what_to_watch) {
          if (item.body) sentences.push(item.body);
        }
      }

      for (const s of sentences) {
        const lower = s.toLowerCase();
        if (
          lower.includes('supplier') ||
          lower.includes('input') ||
          lower.includes('raw material') ||
          lower.includes('capacity') ||
          lower.includes('accrual') ||
          lower.includes('spending') ||
          lower.includes('procurement')
        ) {
          operationalSupplierNotes.push(s);
        }
        if (
          lower.includes('customer') ||
          lower.includes('client') ||
          lower.includes('buyer') ||
          lower.includes('sells') ||
          lower.includes('promoter') ||
          lower.includes('receivable') ||
          lower.includes('market share')
        ) {
          operationalCustomerNotes.push(s);
        }
      }
    }
  } catch (_) {}

  return {
    slug,
    operational_supplier_notes: operationalSupplierNotes,
    operational_customer_notes: operationalCustomerNotes,
    relational_products: relationalProducts,
    industries_catered: industriesCatered,
  };
}
