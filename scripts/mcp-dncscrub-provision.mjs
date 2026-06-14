#!/usr/bin/env node
/**
 * MCP-aligned DNCScrub provision for Barn to Bank outreach compliance.
 * - Registers DNCScrub MCP in project + global Grok config
 * - Pushes DNC_SCRUB_* env vars to Vercel
 * - Enables mock scrub when no vendor API key is available yet
 *
 * Usage:
 *   npm run provision-dncscrub-mcp
 *   DNC_SCRUB_API_KEY=your-login-id npm run provision-dncscrub-mcp
 */
import { execSync, spawnSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const GROK_GLOBAL = path.join(process.env.HOME || '', '.grok', 'config.toml');
const GROK_PROJECT = path.join(ROOT, '.grok', 'config.toml');

const MCP_BLOCK = `
[mcp_servers.dncscrub]
url = "https://mcp.dnc.com/mcp"
enabled = true

[mcp_servers.dncscrub.headers]
x-dncscrub-api-key = "\${DNC_SCRUB_API_KEY}"
`;

function run(cmd, opts = {}) {
  console.log(`→ ${cmd}`);
  return execSync(cmd, { cwd: ROOT, stdio: 'inherit', ...opts });
}

function vercelEnvAdd(name, value, env) {
  const r = spawnSync('vercel', ['env', 'add', name, env, '--force'], {
    cwd: ROOT,
    input: value,
    encoding: 'utf8',
  });
  if (r.status !== 0) throw new Error(`vercel env add ${name} ${env} failed: ${r.stderr || r.stdout}`);
}

function ensureMcpConfig(filePath) {
  if (!fs.existsSync(filePath)) {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, '# Barn to Bank MCP\n');
  }
  const text = fs.readFileSync(filePath, 'utf8');
  if (text.includes('[mcp_servers.dncscrub]')) {
    console.log(`✓ DNCScrub MCP already in ${filePath}`);
    return;
  }
  fs.appendFileSync(filePath, MCP_BLOCK);
  console.log(`✓ Added DNCScrub MCP to ${filePath}`);
}

async function main() {
  console.log('Barn to Bank — DNCScrub MCP provision');

  ensureMcpConfig(GROK_PROJECT);
  if (fs.existsSync(GROK_GLOBAL)) ensureMcpConfig(GROK_GLOBAL);

  const apiKey = process.env.DNC_SCRUB_API_KEY || process.env.DNC_REGISTRY_API_KEY || '';
  const projectId = process.env.DNC_SCRUB_PROJECT_ID || '';
  const campaignId = process.env.DNC_SCRUB_CAMPAIGN_ID || '';

  for (const env of ['production', 'preview', 'development']) {
    if (apiKey) {
      vercelEnvAdd('DNC_SCRUB_API_KEY', apiKey, env);
      vercelEnvAdd('DNC_SCRUB_USE_MCP', 'true', env);
      console.log(`✓ DNC_SCRUB_API_KEY + MCP mode → ${env}`);
    } else {
      vercelEnvAdd('DNC_SCRUB_MOCK', 'true', env);
      vercelEnvAdd('DNC_SCRUB_USE_MCP', 'true', env);
      console.log(`✓ DNC_SCRUB_MOCK=true (no API key yet) → ${env}`);
    }
    if (projectId) vercelEnvAdd('DNC_SCRUB_PROJECT_ID', projectId, env);
    if (campaignId) vercelEnvAdd('DNC_SCRUB_CAMPAIGN_ID', campaignId, env);
  }

  if (!apiKey) {
    console.log('\nNo DNC_SCRUB_API_KEY found. Next steps:');
    console.log('  1. Sign in at https://www.dncscrub.com/login');
    console.log('  2. User Admin → API user → Get API Key (loginId)');
    console.log('  3. Re-run: DNC_SCRUB_API_KEY=your-key npm run provision-dncscrub-mcp');
    console.log('  4. Export locally for Grok MCP: export DNC_SCRUB_API_KEY=your-key');
  } else {
    console.log('\n✓ Live DNCScrub configured. Mock mode disabled on next deploy.');
    for (const env of ['production', 'preview', 'development']) {
      try {
        spawnSync('vercel', ['env', 'rm', 'DNC_SCRUB_MOCK', env, '--yes'], { cwd: ROOT, stdio: 'pipe' });
      } catch { /* ignore if missing */ }
    }
  }

  console.log('\n→ Deploying production…');
  run('vercel deploy --prod --yes');
  console.log('\nDone. Outreach DNC scrub uses /api/dnc-scrub (MCP → REST fallback).');
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});