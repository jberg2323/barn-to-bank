#!/usr/bin/env node
/**
 * MCP-aligned Supabase provision for Barn to Bank moat sync.
 * - Ensures linked project + migration on moat_bundles
 * - Pushes env vars to Vercel (SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, MOAT_TEAM_ID)
 *
 * Usage:
 *   npm run provision-supabase-mcp
 *   SUPABASE_PROJECT_REF=nbtzhpuwyvdkmrpzhocy npm run provision-supabase-mcp
 */
import { execSync, spawnSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const PROJECT_REF = process.env.SUPABASE_PROJECT_REF || 'nbtzhpuwyvdkmrpzhocy';
const TEAM_ID = process.env.MOAT_TEAM_ID || 'barn-to-bank-team';
const MIGRATION = path.join(ROOT, 'supabase', 'migrations', '20260614174500_moat_bundles.sql');

function run(cmd, opts = {}) {
  console.log(`→ ${cmd}`);
  return execSync(cmd, { cwd: ROOT, stdio: 'inherit', ...opts });
}

function getSupabaseAccessToken() {
  try {
    const raw = execSync('security find-generic-password -s "Supabase CLI" -w', { encoding: 'utf8' }).trim();
    const b64 = raw.replace(/^go-keyring-base64:/, '');
    return Buffer.from(b64, 'base64').toString('utf8');
  } catch (e) {
    throw new Error('Supabase CLI not logged in — run: supabase login');
  }
}

async function runMigrationViaApi() {
  if (!fs.existsSync(MIGRATION)) throw new Error(`Missing migration: ${MIGRATION}`);
  const sql = fs.readFileSync(MIGRATION, 'utf8');
  const token = getSupabaseAccessToken();
  const res = await fetch(`https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query: sql }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Migration API failed (${res.status}): ${err}`);
  }
  console.log('✓ Migration applied via Supabase Management API');
}

function getApiKeys() {
  const out = execSync(`supabase projects api-keys --project-ref ${PROJECT_REF}`, { encoding: 'utf8' });
  const service = out.match(/service_role\s*\|\s*(\S+)/);
  if (!service) throw new Error('Could not parse service_role key from supabase CLI');
  return {
    url: `https://${PROJECT_REF}.supabase.co`,
    serviceRole: service[1],
  };
}

function vercelEnvAdd(name, value, env) {
  const r = spawnSync('vercel', ['env', 'add', name, env, '--force'], {
    cwd: ROOT,
    input: value,
    encoding: 'utf8',
  });
  if (r.status !== 0) throw new Error(`vercel env add ${name} ${env} failed: ${r.stderr || r.stdout}`);
}

async function main() {
  console.log(`Barn to Bank — Supabase MCP provision (${PROJECT_REF})`);
  run(`supabase link --project-ref ${PROJECT_REF}`);
  await runMigrationViaApi();
  const keys = getApiKeys();
  for (const env of ['production', 'preview', 'development']) {
    vercelEnvAdd('SUPABASE_URL', keys.url, env);
    vercelEnvAdd('SUPABASE_SERVICE_ROLE_KEY', keys.serviceRole, env);
    vercelEnvAdd('MOAT_TEAM_ID', TEAM_ID, env);
  }
  console.log('✓ Vercel env vars set');
  console.log(`✓ Supabase URL: ${keys.url}`);
  console.log('  Redeploy barn-to-bank on Vercel, then tap Cloud Sync in the app.');
}

main().catch((err) => {
  console.error('✗', err.message);
  process.exit(1);
});