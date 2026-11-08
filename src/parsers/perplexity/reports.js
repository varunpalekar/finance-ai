export function parseReports(raw, ticker) {
  const reportsList = Array.isArray(raw?.sourced_reports)
    ? raw.sourced_reports
    : (Array.isArray(raw?.documents) ? raw.documents : []);

  const reports = reportsList.map(r => {
    if (!r) return null;
    return {
      title: r.title || '',
      provider: r.provider || '',
      pdf_url: r.source_url || r.url || '',
      date: r.date || '',
      outlook: r.outlook || 'unknown',
      summary: r.summary || ''
    };
  }).filter(Boolean);

  return {
    ticker,
    total_reports: reports.length,
    reports
  };
}
