import * as cheerio from 'cheerio';

export function parseGoogleNewsXml(xml) {
  if (!xml || typeof xml !== 'string') return [];

  try {
    const $ = cheerio.load(xml, { xmlMode: true });
    const items = [];

    $('item').each((_, el) => {
      const rawTitle = $(el).find('title').text().trim();
      const link = $(el).find('link').text().trim();
      const pubDate = $(el).find('pubDate').text().trim();
      const source = $(el).find('source').text().trim();

      let title = rawTitle;
      if (source && title.endsWith(` - ${source}`)) {
        title = title.slice(0, -(source.length + 3)).trim();
      }

      let isoDate = null;
      if (pubDate) {
        try {
          isoDate = new Date(pubDate).toISOString();
        } catch (_) {
          isoDate = pubDate;
        }
      }

      if (title && link) {
        items.push({
          title,
          source: source || 'Unknown',
          url: link,
          published_at: isoDate || pubDate,
        });
      }
    });

    return items;
  } catch (_) {
    return [];
  }
}
