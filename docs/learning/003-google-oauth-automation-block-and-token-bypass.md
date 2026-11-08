---
id: "003"
title: "Google OAuth Automation Blocks in Headed Browsers and Direct Token Bypass"
status: "Accepted"
date: 2026-11-08
supersedes: N/A
---

## Context
When running Playwright interactive sign-in (`scripts/auth-perplexity.js` or `scripts/auth.js`), Google Account OAuth login fails with:
*"This browser or app may not be secure. Learn more. Try using a different browser. If you’re already using a supported browser, you can try again to sign in."*

This occurs because:
1. Playwright defaults to launching packaged "Chrome for Testing".
2. Default launch arguments include `--enable-automation`.
3. `navigator.webdriver` evaluates to `true`.
Google's risk assessment engine flags the session as an untrusted automated browser and blocks authentication.

## Learning / Decision
1. **Direct Token Import**: Always provide a CLI flag to inject session tokens directly (`npm run auth:pplx -- --token "<token>"`). Users can copy their `__Secure-next-auth.session-token` cookie from their regular browser (Chrome, Arc, Safari, Brave) in 5 seconds without spawning any browser process or triggering Google anti-bot checks.
2. **Channel 'chrome'**: Launch the system's authentic Google Chrome binary (`channel: 'chrome'`) instead of Playwright's bundled Chromium/Chrome-for-Testing build.
3. **Anti-Detection Flags**: Pass `--disable-blink-features=AutomationControlled`, pass `ignoreDefaultArgs: ['--enable-automation']`, and inject a page init script setting `Object.defineProperty(navigator, 'webdriver', { get: () => undefined })`.
4. **Provider Fallbacks**: Document alternative 1-click providers (e.g. Perplexity "Continue with Email" magic links or Apple Sign-In) that do not enforce Google's automated browser blocks.

## Rejected Alternatives
* Forcing users to complete Google OAuth in automated Chromium: Rejected because Google server-side risk detection consistently rejects automated sessions.
* Storing Google passwords in plaintext/scripts: Rejected due to Google 2FA prompts, account lockouts, and security policy.
