import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const fixtureDir = path.join(rootDir, 'test/fixtures/perplexity');
fs.mkdirSync(fixtureDir, { recursive: true });

const headers = {
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36',
  'Referer': 'https://www.perplexity.ai/finance/HEROMOTOCO.NS',
  'Accept': 'application/json'
};

const sessionPath = process.env.PPLX_SESSION_PATH || path.join(rootDir, 'output/perplexity_session.json');
if (fs.existsSync(sessionPath)) {
  try {
    const sessionData = JSON.parse(fs.readFileSync(sessionPath, 'utf8'));
    const cookies = Array.isArray(sessionData?.cookies) ? sessionData.cookies : (Array.isArray(sessionData) ? sessionData : []);
    if (cookies.length > 0) {
      headers['Cookie'] = cookies.map(c => `${c.name}=${c.value}`).join('; ');
      console.log(`Loaded ${cookies.length} session cookies from ${sessionPath}`);
    }
  } catch (err) {
    console.warn('Could not parse session cookies:', err.message);
  }
}

async function record() {
  const ticker = process.argv[2] || 'HEROMOTOCO.NS';
  console.log(`Recording live fixtures for ${ticker}...`);

  const fetchJson = async (url) => {
    const res = await fetch(url, { headers });
    if (!res.ok) throw new Error(`${url} returned HTTP ${res.status}`);
    return res.json();
  };

  const fetchText = async (url) => {
    const res = await fetch(url, { headers });
    if (!res.ok) throw new Error(`${url} returned HTTP ${res.status}`);
    return res.text();
  };

  // 1. Timeline
  console.log('Fetching timeline entries...');
  const timeline = await fetchJson(`https://www.perplexity.ai/rest/finance/timeline/${ticker}/entries?limit=10`);
  fs.writeFileSync(path.join(fixtureDir, 'timeline.json'), JSON.stringify(timeline, null, 2));

  // 2. Documents & Brokerage reports
  console.log('Fetching documents...');
  const docs = await fetchJson(`https://www.perplexity.ai/rest/finance/documents/${ticker}`);
  fs.writeFileSync(path.join(fixtureDir, 'documents.json'), JSON.stringify(docs, null, 2));

  // 3. Earnings series
  console.log('Fetching earnings series...');
  const earnings = await fetchJson(`https://www.perplexity.ai/rest/finance/earnings/${ticker}`);
  fs.writeFileSync(path.join(fixtureDir, 'earnings.json'), JSON.stringify(earnings, null, 2));

  // Find reported event with actual data
  const reportedEvent = Array.isArray(earnings) ? (earnings.find(e => e.actualRevenue != null) || earnings[0]) : null;
  if (reportedEvent?.id) {
    console.log(`Fetching earnings analysis for reported event ${reportedEvent.id} (${reportedEvent.fiscalPeriod} FY${reportedEvent.fiscalYear})...`);
    try {
      const analysis = await fetchJson(`https://www.perplexity.ai/rest/finance/earnings/${ticker}/analysis/${reportedEvent.id}`);
      fs.writeFileSync(path.join(fixtureDir, 'earnings_analysis.json'), JSON.stringify(analysis, null, 2));
    } catch (e) {
      console.warn('Analysis not found, writing null');
      fs.writeFileSync(path.join(fixtureDir, 'earnings_analysis.json'), 'null');
    }

    console.log(`Fetching earnings transcript for reported event ${reportedEvent.id}...`);
    try {
      const transcript = await fetchJson(`https://www.perplexity.ai/rest/finance/earnings/${ticker}/transcript/${reportedEvent.id}`);
      fs.writeFileSync(path.join(fixtureDir, 'earnings_transcript.json'), JSON.stringify(transcript, null, 2));
    } catch (e) {
      console.warn('Transcript not found, writing null');
      fs.writeFileSync(path.join(fixtureDir, 'earnings_transcript.json'), 'null');
    }
  }

  // 4. Quote metadata
  console.log('Fetching quote metadata...');
  const quote = await fetchJson(`https://www.perplexity.ai/rest/finance/quote/${ticker}`);
  fs.writeFileSync(path.join(fixtureDir, 'quote.json'), JSON.stringify(quote, null, 2));

  // 5. Strategic Profile Description
  console.log('Fetching profile description...');
  const desc = await fetchText(`https://www.perplexity.ai/rest/finance/profile/${ticker}/description`);
  fs.writeFileSync(path.join(fixtureDir, 'profile_description.txt'), desc);

  // 6. News
  console.log('Fetching publisher news...');
  const news = await fetchJson(`https://www.perplexity.ai/rest/finance/publisher-news/${ticker}?limit=5`);
  fs.writeFileSync(path.join(fixtureDir, 'news.json'), JSON.stringify(news, null, 2));

  console.log(`✅ All fixtures recorded to ${fixtureDir}`);
}

record().catch(err => {
  console.error('Fixture recording failed:', err);
  process.exit(1);
});
