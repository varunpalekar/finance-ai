import { createRequire } from 'node:module';
import { get, set, TTL } from '../cache.js';

const require = createRequire(import.meta.url);
const pdfParse = require('pdf-parse');

export async function fetchDocument(client, url, { fresh = false, signal = AbortSignal.timeout(15000) } = {}) {
  let parsedUrl;
  try {
    parsedUrl = new URL(url);
  } catch {
    throw new Error('Invalid document URL');
  }
  if (parsedUrl.protocol !== 'https:') {
    throw new Error('Only HTTPS URLs are supported');
  }
  if (parsedUrl.hostname !== 'files.tijorifinance.com') {
    throw new Error('Only files.tijorifinance.com URLs are supported');
  }

  const cacheKey = `doc:${url}`;
  if (client?.cacheEnabled && !fresh) {
    const cached = get(cacheKey);
    if (cached) return cached;
  }

  if (typeof client?._loadSession === 'function') {
    client._loadSession();
  }
  const headers = {
    'Referer': `${client?.baseUrl || 'https://www.tijorifinance.com'}/`,
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  };
  if (client?._session?.cookieHeader) {
    headers['Cookie'] = client._session.cookieHeader;
  }

  const fetchFn = client?.fetchFn || globalThis.fetch;
  const res = await fetchFn(url, {
    signal,
    headers,
  });

  if (res.status === 403) {
    throw new Error('Access denied — session may have expired. Run: npm run reauth');
  }
  if (res.status === 404) {
    throw new Error('Document not found at this URL');
  }
  if (res.status >= 400) {
    throw new Error(`HTTP ${res.status} from CDN`);
  }

  const arrayBuffer = await res.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  const origLog = console.log;
  const origWarn = console.warn;
  const filterWrite = (args) => {
    const msg = args.join(' ');
    if (!msg.includes('TT: undefined function') && !msg.includes('Warning: TT:')) {
      process.stderr.write(msg + '\n');
    }
  };
  console.log = (...a) => filterWrite(a);
  console.warn = (...a) => filterWrite(a);

  let parsedData;
  try {
    parsedData = await pdfParse(buffer);
  } finally {
    console.log = origLog;
    console.warn = origWarn;
  }

  const result = {
    url,
    pages: parsedData.numpages,
    text: parsedData.text.trim(),
  };

  if (client?.cacheEnabled) {
    set(cacheKey, result, TTL.PERMANENT, 'json');
  }

  return result;
}
