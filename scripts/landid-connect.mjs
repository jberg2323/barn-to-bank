#!/usr/bin/env node
/**
 * Opens id.land sign-in, waits for jwtTokens in localStorage,
 * then injects accessToken into barn-to-bank.html via localStorage.
 */
import { chromium } from 'playwright';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROFILE = path.join(__dirname, '..', '.playwright-idland-profile');
const APP_URL = `file://${path.join(__dirname, '..', 'barn-to-bank.html')}`;
const SIGN_IN = 'https://id.land/users/sign_in';
const TIMEOUT_MS = 180_000;
const POLL_MS = 2000;

async function readToken(page) {
  return page.evaluate(() => {
    try {
      const raw = localStorage.getItem('jwtTokens');
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      return parsed?.accessToken || null;
    } catch {
      return null;
    }
  });
}

const context = await chromium.launchPersistentContext(PROFILE, {
  headless: false,
  viewport: { width: 1280, height: 900 },
});

const page = context.pages()[0] || (await context.newPage());
console.log('→ Opening id.land sign-in. Log in if prompted…');
await page.goto(SIGN_IN, { waitUntil: 'domcontentloaded', timeout: 60000 });

let token = await readToken(page);
const start = Date.now();
while (!token && Date.now() - start < TIMEOUT_MS) {
  await page.waitForTimeout(POLL_MS);
  token = await readToken(page);
  if (!token) process.stdout.write('.');
}

if (!token) {
  console.error('\n✗ No token found within 3 minutes. Sign in at id.land and re-run.');
  await context.close();
  process.exit(1);
}

console.log(`\n✓ Token captured (${token.length} chars)`);

const appPage = await context.newPage();
await appPage.goto(APP_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
await appPage.evaluate((t) => {
  localStorage.setItem('barn-to-bank-landid-token', t);
}, token);

console.log('✓ Token injected into Barn to Bank (localStorage)');
console.log('  Leave this browser open and run Automation 1 in the app tab.');

// Keep browser open briefly so user sees the app
await appPage.waitForTimeout(3000);