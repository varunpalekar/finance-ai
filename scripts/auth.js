import { chromium } from 'playwright';
import { existsSync, mkdirSync, writeFileSync, chmodSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = join(__dirname, '..');
const OUTPUT_DIR = join(ROOT_DIR, 'output');
const SESSION_PATH = join(OUTPUT_DIR, 'session.json');
const BASE_URL = 'https://www.tijorifinance.com';

const FORCE_REAUTH = process.argv.includes('--reauth');

async function login(context) {
  const page = await context.newPage();
  console.error('Navigating to signin page...');
  await page.goto(`${BASE_URL}/account/signin/`, { waitUntil: 'domcontentloaded' });

  console.error('\n┌──────────────────────────────────────────────────────────┐');
  console.error('│  Browser is open. Log in however you normally would.      │');
  console.error('│  Waiting up to 3 minutes for you to complete login...     │');
  console.error('└──────────────────────────────────────────────────────────┘\n');

  const deadline = Date.now() + 3 * 60 * 1000;
  let loggedIn = false;
  while (Date.now() < deadline) {
    const pages = context.pages();
    const activePage = pages[pages.length - 1] || page;
    const currentUrl = activePage.url();

    let onTijoriHome = false;
    try {
      const u = new URL(currentUrl);
      const isTijori = u.hostname.endsWith('tijorifinance.com');
      const isAuthPath = u.pathname.includes('/signin') || u.pathname.includes('/zerodha') || u.pathname.includes('/callback');
      if (isTijori && !isAuthPath) {
        onTijoriHome = true;
      }
    } catch (_) {}

    const cookies = await context.cookies('https://www.tijorifinance.com');
    const sessionCookie = cookies.find(c => c.name === 'sessionid' && c.value);

    if (onTijoriHome && sessionCookie) {
      loggedIn = true;
      break;
    }

    if (currentUrl.includes('kite.zerodha.com')) {
      process.stderr.write('\rWaiting... Complete Zerodha Kite login in the browser window...   ');
    } else if (currentUrl.includes('accounts.google.com')) {
      process.stderr.write('\rWaiting... Complete Google login in the browser window...         ');
    } else {
      process.stderr.write(`\rWaiting for login... current URL: ${currentUrl.slice(0, 60)}... `);
    }
    await page.waitForTimeout(1000);
  }

  if (!loggedIn) {
    throw new Error('Timed out — login was not completed within 3 minutes.');
  }

  console.error('\nVerifying session with Tijori Finance...');
  const probe = await context.request.get(`${BASE_URL}/api/v1/ind/company_search/?q=tata`);
  if (!probe.ok() || probe.url().includes('/signin')) {
    throw new Error('Authentication verification failed — Tijori Finance rejected the session.');
  }

  console.error(`Logged in and verified successfully!`);
  await page.close();
}

async function main() {
  mkdirSync(OUTPUT_DIR, { recursive: true, mode: 0o700 });

  const hasSavedSession = existsSync(SESSION_PATH) && !FORCE_REAUTH;

  if (hasSavedSession) {
    console.error('Saved session already exists at output/session.json. Use --reauth to overwrite.');
    return;
  }

  console.error('Launching browser for authentication...');
  const browser = await chromium.launch({ headless: false });

  try {
    const context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
      viewport: { width: 1440, height: 900 },
    });

    await login(context);

    const storageState = await context.storageState();
    writeFileSync(SESSION_PATH, JSON.stringify(storageState, null, 2), { mode: 0o600 });
    try {
      chmodSync(SESSION_PATH, 0o600);
    } catch (_) {}

    console.error('Session saved with mode 0600 to output/session.json.');
  } finally {
    await browser.close();
  }
}

main().catch(err => {
  console.error('Auth failed:', err.message);
  process.exit(1);
});
