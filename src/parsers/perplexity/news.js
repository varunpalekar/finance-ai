export function parseNews(raw, ticker) {
  const items = Array.isArray(raw) ? raw : [];
  const articles = items.map(a => {
    if (!a) return null;
    return {
      title: a.title || '',
      source: a.source || '',
      published_at: a.published_date || '',
      url: a.url || '',
      thumbnail: a.thumbnail_url || ''
    };
  }).filter(Boolean);

  return {
    ticker,
    total_articles: articles.length,
    articles
  };
}
