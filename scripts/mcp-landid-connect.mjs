#!/usr/bin/env node
/**
 * MCP-aligned id.land connect: uses the Playwright MCP Chrome profile,
 * signs in via API when LANDID_EMAIL/LANDID_PASSWORD are set, otherwise
 * opens id.land sign-in and polls jwtTokens, then injects into barn-to-bank.
 */
import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const APP_PATH = path.join(__dirname, '..', 'barn-to-bank.html');
const APP_URL = `file://${APP_PATH}`;
const SIGN_IN = 'https://id.land/users/sign_in';
const TOKEN_KEY = 'barn-to-bank-landid-token';
const TIMEOUT_MS = 180_000;
const POLL_MS = 2000;

function mcpChromeProfile() {
  const base = path.join(process.env.HOME, 'Library/Caches/ms-playwright-mcp');
  if (!fs.existsSync(base)) return null;
  const dirs = fs.readdirSync(base).filter((d) => d.startsWith('mcp-chrome-'));
  if (!dirs.length) return null;
  dirs.sort((a, b) => {
    const sa = fs.statSync(path.join(base, a)).mtimeMs;
    const sb = fs.statSync(path.join(base, b)).mtimeMs;
    return sb - sa;
  });
  return path.join(base, dirs[0]);
}

async function authViaApi(email, password) {
  const mutation = `
    mutation AuthnCreateAccessToken($email: String!, $password: String!) {
      createAccessToken(input: { email: $email, password: $password }) {
        accessToken
        refreshToken
      }
    }
  `;
  const res = await fetch('https://gateway.id.land/authn/query', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'X-Platform': 'web',
    },
    body: JSON.stringify({
      operationName: 'AuthnCreateAccessToken',
      query: mutation,
      variables: { email: email.trim(), password },
    }),
  });
  const data = await res.json();
  if (!res.ok || data.errors?.length) {
    throw new Error(data.errors?.[0]?.message || `Sign-in failed (${res.status})`);
  }
  const token = data.data?.createAccessToken?.accessToken;
  if (!token) throw new Error('No access token returned');
  return token;
}

async function readJwtFromPage(page) {
  return page.evaluate(() => {
    try {
      const raw = localStorage.getItem('jwtTokens');
      if (!raw) return null;
      return JSON.parse(raw)?.accessToken || null;
    } catch {
      return null;
    }
  });
}

async function injectToken(context, token) {
  const appPage = context.pages().find((p) => p.url().includes('barn-to-bank.html'))
    || (await context.newPage());
  if (!appPage.url().includes('barn-to-bank.html')) {
    await appPage.goto(APP_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
  }
  await appPage.evaluate(([key, t]) => {
    localStorage.setItem(key, t);
    const status = document.getElementById('landid-connect-status');
    if (status) {
      status.textContent = `Connected · token ${t.slice(0, 8)}…${t.slice(-6)} (${t.length} chars)`;
      status.style.color = 'var(--green)';
    }
  }, [TOKEN_KEY, token]);
  await appPage.bringToFront();
  return appPage;
}

const email = process.env.LANDID_EMAIL || '';
const password = process.env.LANDID_PASSWORD || '';
const mcpProfile = mcpChromeProfile();
const profile = mcpProfile || path.join(__dirname, '..', '.playwright-idland-profile');

console.log(`Profile: ${profile}${mcpProfile ? ' (MCP Chrome)' : ' (fallback)'}`);

let token = null;
if (email && password) {
  console.log('→ Signing in via id.land API…');
  token = await authViaApi(email, password);
  console.log(`✓ API token (${token.length} chars)`);
}

const context = await chromium.launchPersistentContext(profile, {
  headless: false,
  viewport: { width: 1280, height: 900 },
});

const page = context.pages()[0] || (await context.newPage());

if (!token) {
  console.log('→ Opening id.land sign-in — log in in this browser window…');
  await page.goto(SIGN_IN, { waitUntil: 'domcontentloaded', timeout: 60000 });
  token = await readJwtFromPage(page);
  const start = Date.now();
  while (!token && Date.now() - start < TIMEOUT_MS) {
    await page.waitForTimeout(POLL_MS);
    token = await readJwtFromPage(page);
    if (!token) process.stdout.write('.');
  }
}

if (!token) {
  console.error('\n✗ No token within 3 minutes.');
  console.error('  Options: sign in in the browser, or run:');
  console.error('  LANDID_EMAIL=you@co.com LANDID_PASSWORD=secret npm run connect-landid-mcp');
  await context.close();
  process.exit(1);
}

console.log(`\n✓ Token ready (${token.length} chars)`);
const appPage = await injectToken(context, token);
console.log('✓ Token injected into Barn to Bank');
console.log('  Run Automation 1 in the app tab. Leave this browser open.');

await appPage.waitForTimeout(2000);