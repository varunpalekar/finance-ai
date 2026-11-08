import { chromium } from 'playwright';
import { existsSync, mkdirSync, writeFileSync, chmodSync, unlinkSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PerplexityClient } from '../src/client/PerplexityClient.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = join(__dirname, '..');
const OUTPUT_DIR = join(ROOT_DIR, 'output');
const SESSION_PATH = process.env.PPLX_SESSION_PATH || join(OUTPUT_DIR, 'perplexity_session.json');
const SIGNIN_URL = 'https://www.perplexity.ai/api/auth/signin';

function printUserBanner(user) {
  const displayName = user?.name || user?.username || user?.email;
  console.error('\n┌──────────────────────────────────────────────────────────┐');
  console.error('│  Perplexity Authentication Success                       │');
  if (displayName) {
    console.error(`│  User:      ${displayName.padEnd(45)}│`);
  }
  if (user?.email && user.email !== displayName) {
    console.error(`│  Email:     ${user.email.padEnd(45)}│`);
  }
  if (user?.username && user.username !== displayName) {
    console.error(`│  Username:  ${user.username.padEnd(45)}│`);
  }
  if (user?.subscription_status) {
    console.error(`│  Plan:      ${user.subscription_status.toUpperCase().padEnd(45)}│`);
  }
  console.error('└──────────────────────────────────────────────────────────┘\n');
}

export async function saveManualToken(client, tokenVal, targetPath = client?.sessionPath || SESSION_PATH) {
  mkdirSync(dirname(targetPath), { recursive: true });
  const cleanToken = tokenVal.replace(/^__Secure-next-auth\.session-token=/, '').split(';')[0].trim();
  const sessionData = {
    updated_at: new Date().toISOString(),
    cookies: [
      {
        name: '__Secure-next-auth.session-token',
        value: cleanToken,
        domain: '.perplexity.ai',
        path: '/',
        secure: true,
        httpOnly: true
      }
    ]
  };

  writeFileSync(targetPath, JSON.stringify(sessionData, null, 2));
  chmodSync(targetPath, 0o600);
  console.error(`\n✅ Session token saved to ${targetPath}`);

  const verify = await client.validateSession({ probe: false });
  if (verify.valid) {
    const user = await client.getUserInfo({ fresh: true }).catch(() => null);
    if (user?.is_authenticated) {
      printUserBanner(user);
    } else {
      console.error('✅ Session token verified.');
    }
    return { success: true, user };
  } else {
    console.error(`⚠️ Session saved but validation returned: ${verify.reason}`);
    return { success: false, reason: verify.reason };
  }
}

async function launchBrowser() {
  const baseArgs = [
    '--disable-blink-features=AutomationControlled',
    '--no-sandbox',
    '--disable-infobars'
  ];
  const ignoreDefaultArgs = ['--enable-automation'];

  try {
    return await chromium.launch({
      channel: 'chrome',
      headless: false,
      args: baseArgs,
      ignoreDefaultArgs
    });
  } catch (_) {
    return await chromium.launch({
      headless: false,
      args: baseArgs,
      ignoreDefaultArgs
    });
  }
}

export async function interactiveLogin(client) {
  mkdirSync(OUTPUT_DIR, { recursive: true });

  console.error('\n┌──────────────────────────────────────────────────────────┐');
  console.error('│  Opening browser for Perplexity Finance sign-in...        │');
  console.error('│  Log in via Email (Magic Link), Google, or Apple.        │');
  console.error('│  💡 If Google blocks login ("browser not secure"):        │');
  console.error('│     1. Click "Continue with Email" for 1-click magic link │');
  console.error('│     2. Or paste token: npm run auth:pplx -- --token <val> │');
  console.error('│  Waiting up to 120 seconds for login completion...        │');
  console.error('└──────────────────────────────────────────────────────────┘\n');

  const browser = await launchBrowser();
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'
  });
  await context.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
  });

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
    return { success: false, reason: 'TIMEOUT' };
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

  const verify = await client.validateSession({ probe: true });
  if (verify.valid) {
    const user = await client.getUserInfo({ fresh: true }).catch(() => null);
    if (user?.is_authenticated) {
      printUserBanner(user);
    } else {
      console.error('✅ Session verified against Perplexity Finance endpoints.');
    }
    return { success: true, user };
  } else {
    console.error(`⚠️ Session saved but probe returned: ${verify.reason}`);
    return { success: false, reason: verify.reason };
  }
}

export async function runDaemon(client, options = {}) {
  const intervalMs = options.intervalMs || 30 * 60 * 1000; // 30 minutes
  const maxIterations = options.maxIterations || Infinity;
  let iterations = 0;
  let isRunning = true;

  console.error(`[pplx-daemon] Starting session keep-alive daemon (probe interval: ${Math.round(intervalMs / 1000)}s)...`);

  const cleanup = () => {
    if (isRunning) {
      isRunning = false;
      console.error('\n[pplx-daemon] Stopping session keep-alive daemon.');
    }
  };

  process.once('SIGINT', cleanup);
  process.once('SIGTERM', cleanup);

  while (isRunning && iterations < maxIterations) {
    iterations++;
    const status = await client.validateSession({ probe: true });
    const nowIso = new Date().toISOString();

    if (status.valid) {
      console.error(`[pplx-daemon] [${nowIso}] Session active and valid.`);
    } else {
      console.error(`[pplx-daemon] [${nowIso}] ⚠️ Session invalid/expired (${status.reason}). Triggering re-authentication...`);
      if (options.onAuthRequired) {
        await options.onAuthRequired(client);
      } else {
        await interactiveLogin(client);
      }
    }

    if (!isRunning || iterations >= maxIterations) break;
    await new Promise(r => setTimeout(r, intervalMs));
  }

  return { iterations };
}

async function main() {
  const client = new PerplexityClient({ sessionPath: SESSION_PATH });
  const isStatusOnly = process.argv.includes('--status');
  const isDaemon = process.argv.includes('--daemon');
  const forceReauth = process.argv.includes('--reauth');

  const tokenIdx = process.argv.findIndex(arg => arg === '--token' || arg === '-t');
  if (tokenIdx !== -1 && process.argv[tokenIdx + 1]) {
    const res = await saveManualToken(client, process.argv[tokenIdx + 1]);
    if (!res.success) {
      process.exit(1);
    }
    process.exit(0);
  }

  if (isStatusOnly) {
    const status = await client.validateSession({ probe: true });
    if (status.valid) {
      const user = await client.getUserInfo({ fresh: true }).catch(() => null);
      if (user?.is_authenticated) {
        printUserBanner(user);
      } else {
        console.error(`✅ Perplexity session is VALID. (updated_at: ${status.updated_at || 'unknown'})`);
      }
      process.exit(0);
    } else {
      console.error(`❌ Perplexity session INVALID: ${status.reason}. Run 'npm run auth:pplx' to sign in.`);
      process.exit(1);
    }
  }

  if (isDaemon) {
    await runDaemon(client);
    process.exit(0);
  }

  if (forceReauth && existsSync(SESSION_PATH)) {
    console.error('Clearing existing session for fresh re-authentication...');
    try { unlinkSync(SESSION_PATH); } catch (_) {}
  } else if (existsSync(SESSION_PATH)) {
    const check = await client.validateSession({ probe: true });
    if (check.valid) {
      console.error(`✅ Active Perplexity session already exists and is valid. Use 'npm run reauth:pplx' to force re-sign in.`);
      process.exit(0);
    }
  }

  const res = await interactiveLogin(client);
  if (!res.success) {
    process.exit(1);
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch(err => {
    console.error('Auth error:', err);
    process.exit(1);
  });
}
