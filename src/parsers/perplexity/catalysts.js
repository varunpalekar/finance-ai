export function parseCatalysts(raw, ticker) {
  const items = Array.isArray(raw) ? raw : [];
  const timeline = items.map(entry => {
    if (!entry) return null;
    return {
      date: entry.last_modified || entry.last_updated || '',
      price: typeof entry.price === 'number' ? entry.price : null,
      price_movement: typeof entry.price_movement === 'number' ? entry.price_movement : null,
      narrative: entry.description || '',
      has_catalyst: true,
      sources: Array.isArray(entry.sources) ? entry.sources : []
    };
  }).filter(Boolean);

  return {
    ticker,
    total_entries: timeline.length,
    timeline
  };
}
