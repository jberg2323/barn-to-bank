#!/usr/bin/env node
import { chromium } from 'playwright';
import path from 'path';
import { fileURLToPath } from 'url';

const MCP_PROFILE = path.join(
  process.env.HOME,
  'Library/Caches/ms-playwright-mcp/mcp-chrome-bcc9a15',
);

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const APP_URL = `file://${path.join(__dirname, '..', 'barn-to-bank.html')}`;

const context = await chromium.launchPersistentContext(MCP_PROFILE, {
  headless: true,
});
const page = context.pages()[0] || (await context.newPage());
await page.goto('https://id.land/', { waitUntil: 'domcontentloaded', timeout: 30000 });
const token = await page.evaluate(() => {
  try {
    return JSON.parse(localStorage.getItem('jwtTokens') || 'null')?.accessToken || null;
  } catch {
    return null;
  }
});
await context.close();

if (!token) {
  console.log('NO_TOKEN');
  process.exit(2);
}

console.log('TOKEN_LENGTH', token.length);
const ctx2 = await chromium.launchPersistentContext(
  path.join(__dirname, '..', '.playwright-idland-profile'),
  { headless: true },
);
const app = ctx2.pages()[0] || (await ctx2.newPage());
await app.goto(APP_URL, { waitUntil: 'domcontentloaded' });
await app.evaluate((t) => localStorage.setItem('barn-to-bank-landid-token', t), token);
await ctx2.close();
console.log('INJECTED_OK');