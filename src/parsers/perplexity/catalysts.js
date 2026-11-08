export function parseCatalysts(raw, ticker) {
  const items = Array.isArray(raw) ? raw : [];
  const timeline = items.map(entry => {
    if (!entry) return null;
    const move = typeof entry.price_movement === 'number' ? entry.price_movement : null;
    const desc = entry.description || '';
    const hasCatalyst = !desc.includes('No new macro, sector or company catalysts detected');

    return {
      date: entry.last_modified || entry.last_updated || '',
      price: typeof entry.price === 'number' ? entry.price : null,
      price_movement: move,
      price_movement_percent: move,
      narrative: desc,
      has_catalyst: hasCatalyst,
      sources: Array.isArray(entry.sources) ? entry.sources : []
    };
  }).filter(Boolean);

  return {
    ticker,
    total_entries: timeline.length,
    timeline
  };
}
