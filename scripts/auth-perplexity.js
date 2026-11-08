import { chromium } from 'playwright';
import { existsSync, mkdirSync, writeFileSync, chmodSync, readFileSync, unlinkSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PerplexityClient } from '../src/client/PerplexityClient.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = join(__dirname, '..');
const OUTPUT_DIR = join(ROOT_DIR, 'output');
const SESSION_PATH = process.env.PPLX_SESSION_PATH || join(OUTPUT_DIR, 'perplexity_session.json');
const SIGNIN_URL = 'https://www.perplexity.ai/api/auth/signin';
const PROBE_URL = 'https://www.perplexity.ai/rest/finance/quote/HEROMOTOCO.NS';

const IS_STATUS_ONLY = process.argv.includes('--status');
const FORCE_REAUTH = process.argv.includes('--reauth');

async function main() {
  const client = new PerplexityClient({ sessionPath: SESSION_PATH });

  if (IS_STATUS_ONLY) {
    const status = await client.validateSession({ probe: true });
    if (status.valid) {
      console.error(`✅ Perplexity session is VALID. (updated_at: ${status.updated_at || 'unknown'})`);
      process.exit(0);
    } else {
      console.error(`❌ Perplexity session INVALID: ${status.reason}. Run 'npm run auth:pplx' to sign in.`);
      process.exit(1);
    }
  }

  if (FORCE_REAUTH && existsSync(SESSION_PATH)) {
    console.error('Clearing existing session for fresh re-authentication...');
    try { unlinkSync(SESSION_PATH); } catch (_) {}
  } else if (existsSync(SESSION_PATH)) {
    const check = await client.validateSession({ probe: true });
    if (check.valid) {
      console.error(`✅ Active Perplexity session already exists and is valid. Use 'npm run reauth:pplx' to force re-sign in.`);
      process.exit(0);
    }
  }

  mkdirSync(OUTPUT_DIR, { recursive: true });

  console.error('\n┌──────────────────────────────────────────────────────────┐');
  console.error('│  Opening browser for Perplexity Finance sign-in...        │');
  console.error('│  Log in via Google, Apple, or Email in the window.       │');
  console.error('│  Waiting up to 120 seconds for login completion...        │');
  console.error('└──────────────────────────────────────────────────────────┘\n');

  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  await page.goto(SIGNIN_URL, { waitUntil: 'domcontentloaded' });

  const deadline = Date.now() + 120000;
  let sessionToken = null;
  let allCookies = [];

  while (Date.now() < deadline) {
    allCookies = await context.cookies();
    const token = allCookies.find(c => c.name === '__Secure-next-auth.session-token');
    if (token?.value) {
      sessionToken = token.value;
      break;
    }

    const pages = context.pages();
    const activePage = pages[pages.length - 1] || page;
    const currentUrl = activePage.url();
    process.stderr.write(`\rWaiting for sign-in... URL: ${currentUrl.slice(0, 60)}... `);

    await page.waitForTimeout(1000);
  }

  if (!sessionToken) {
    await browser.close();
    console.error('\n❌ Timed out — sign-in was not completed within 120 seconds.');
    process.exit(1);
  }

  const sessionData = {
    updated_at: new Date().toISOString(),
    cookies: allCookies
      .filter(c => c.domain?.includes('perplexity.ai'))
      .map(c => ({
        name: c.name,
        value: c.value,
        domain: c.domain,
        path: c.path,
        secure: c.secure,
        httpOnly: c.httpOnly
      }))
  };

  writeFileSync(SESSION_PATH, JSON.stringify(sessionData, null, 2));
  chmodSync(SESSION_PATH, 0o600);
  await browser.close();

  console.error(`\n✅ Perplexity session captured and saved to ${SESSION_PATH}`);

  // Validate captured session with live probe
  const verify = await client.validateSession({ probe: true });
  if (verify.valid) {
    console.error('✅ Session verified against Perplexity Finance endpoints.');
  } else {
    console.error(`⚠️ Session saved but probe returned: ${verify.reason}`);
  }
}

main().catch(err => {
  console.error('Auth error:', err);
  process.exit(1);
});
