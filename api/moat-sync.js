/**
 * Barn to Bank, team moat cloud sync (Supabase via server-side credentials).
 * GET  ?teamId=...  → pull latest bundle
 * POST { teamId, bundle, mode? } → push / merge bundle
 */

const TABLE = 'moat_bundles';

function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

function json(res, status, body) {
  cors(res);
  res.status(status).json(body);
}

function supabaseHeaders() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
  if (!key) throw new Error('Supabase credentials not configured');
  return {
    apikey: key,
    Authorization: `Bearer ${key}`,
    'Content-Type': 'application/json',
    Prefer: 'return=representation',
  };
}

function supabaseBase() {
  const url = process.env.SUPABASE_URL;
  if (!url) throw new Error('SUPABASE_URL not configured');
  return url.replace(/\/$/, '');
}

async function supabaseFetch(path, options = {}) {
  const res = await fetch(`${supabaseBase()}/rest/v1/${path}`, {
    ...options,
    headers: { ...supabaseHeaders(), ...(options.headers || {}) },
  });
  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  if (!res.ok) {
    const msg = typeof data === 'object' && data?.message ? data.message : `Supabase ${res.status}`;
    throw new Error(msg);
  }
  return data;
}

function dealTimestamp(d) {
  return String(d?.updatedAt || d?.lastContact || '');
}

function normalizeDeletedEntry(entry) {
  if (!entry) return null;
  if (typeof entry === 'string') return { id: entry, deletedAt: '' };
  if (!entry.id) return null;
  return { id: entry.id, deletedAt: String(entry.deletedAt || '') };
}

function mergeDeletedDealIds(local, remote) {
  const map = new Map();
  [...(remote?.deletedDealIds || []), ...(local?.deletedDealIds || [])].forEach((entry) => {
    const norm = normalizeDeletedEntry(entry);
    if (!norm) return;
    const prev = map.get(norm.id);
    if (!prev || norm.deletedAt >= prev.deletedAt) map.set(norm.id, norm);
  });
  return [...map.values()];
}

function isDealTombstoned(dealId, deletedDealIds, dealUpdatedAt = '') {
  const tomb = deletedDealIds.find((x) => x.id === dealId);
  if (!tomb) return false;
  if (!tomb.deletedAt) return true;
  return !dealUpdatedAt || tomb.deletedAt >= String(dealUpdatedAt);
}

function mergeBundles(local, remote) {
  if (!remote) return { ...local, deletedDealIds: mergeDeletedDealIds(local, null) };
  if (!local) return { ...remote, deletedDealIds: mergeDeletedDealIds(null, remote) };

  const deletedDealIds = mergeDeletedDealIds(local, remote);
  const localExport = String(local.exportedAt || '');
  const remoteExport = String(remote.exportedAt || remote.updated_at || '');
  const localPipelineAuthoritative = localExport >= remoteExport;
  const localDealIds = new Set((local.deals || []).map((d) => d.id));

  const dealMap = new Map();
  [...(remote.deals || []), ...(local.deals || [])].forEach((d) => {
    if (!d?.id) return;
    if (isDealTombstoned(d.id, deletedDealIds, d.updatedAt)) return;
    const prev = dealMap.get(d.id);
    if (!prev || dealTimestamp(d) >= dealTimestamp(prev)) dealMap.set(d.id, d);
  });

  // When the client just edited the pipeline, do not resurrect deals they removed locally.
  if (localPipelineAuthoritative) {
    for (const id of [...dealMap.keys()]) {
      if (localDealIds.has(id)) continue;
      const remoteDeal = dealMap.get(id);
      const addedAfterLocalEdit = dealTimestamp(remoteDeal) > localExport;
      if (!addedAfterLocalEdit) dealMap.delete(id);
    }
  }

  const compMap = new Map();
  [...(remote.comps || []), ...(local.comps || [])].forEach((c) => {
    if (!c?.id) return;
    const prev = compMap.get(c.id);
    if (!prev || String(c.loggedAt || c.date || '') >= String(prev.loggedAt || prev.date || '')) {
      compMap.set(c.id, c);
    }
  });

  const auditIds = new Set();
  const audit = [];
  [...(remote.audit || []), ...(local.audit || [])].forEach((a) => {
    if (!a?.id || auditIds.has(a.id)) return;
    auditIds.add(a.id);
    audit.push(a);
  });
  audit.sort((a, b) => String(b.ts).localeCompare(String(a.ts)));

  const leadMap = new Map();
  [...(remote.inboundLeads || []), ...(local.inboundLeads || [])].forEach((l) => {
    if (!l?.id) return;
    const prev = leadMap.get(l.id);
    if (!prev || String(l.updatedAt || l.createdAt || '') >= String(prev.updatedAt || prev.createdAt || '')) {
      leadMap.set(l.id, l);
    }
  });

  const remoteTime = remote.exportedAt || remote.updated_at || '';
  const localTime = local.exportedAt || '';
  const outreach = localTime >= remoteTime ? (local.outreach || remote.outreach) : (remote.outreach || local.outreach);

  const SEED_DEAL_IDS = new Set([
    'deal-bastrop-001',
    'deal-caldwell-001',
    'deal-comal-001',
    'deal-bexar-001',
  ]);

  const deals = [...dealMap.values()].filter((d) => {
    if (!SEED_DEAL_IDS.has(d.id)) return true;
    return !isDealTombstoned(d.id, deletedDealIds, d.updatedAt);
  });

  return {
    version: Math.max(local.version || 1, remote.version || 1),
    exportedAt: new Date().toISOString(),
    teamId: local.teamId || remote.teamId,
    deals,
    comps: [...compMap.values()],
    audit: audit.slice(0, 500),
    outreach: outreach || {},
    inboundLeads: [...leadMap.values()],
    deletedDealIds,
  };
}

module.exports = async function handler(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(204).end();

  try {
    if (!process.env.SUPABASE_URL) {
      return json(res, 503, { ok: false, error: 'Cloud sync not configured on server' });
    }

    const teamId = (req.method === 'GET'
      ? req.query.teamId
      : (typeof req.body === 'string' ? JSON.parse(req.body) : req.body)?.teamId)
      || process.env.MOAT_TEAM_ID
      || 'barn-to-bank-team';

    if (req.method === 'GET') {
      const rows = await supabaseFetch(
        `${TABLE}?team_id=eq.${encodeURIComponent(teamId)}&select=team_id,payload,updated_at,updated_by&limit=1`,
        { method: 'GET' },
      );
      const row = Array.isArray(rows) ? rows[0] : null;
      return json(res, 200, {
        ok: true,
        teamId,
        bundle: row?.payload || null,
        updatedAt: row?.updated_at || null,
        configured: true,
      });
    }

    if (req.method === 'POST') {
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      const localBundle = body?.bundle;
      if (!localBundle || !Array.isArray(localBundle.deals)) {
        return json(res, 400, { ok: false, error: 'Invalid bundle, missing deals array' });
      }

      let remoteBundle = null;
      try {
        const rows = await supabaseFetch(
          `${TABLE}?team_id=eq.${encodeURIComponent(teamId)}&select=payload&limit=1`,
          { method: 'GET' },
        );
        remoteBundle = Array.isArray(rows) && rows[0] ? rows[0].payload : null;
      } catch {
        remoteBundle = null;
      }

      const merged = body.mode === 'push_only' ? localBundle : mergeBundles(localBundle, remoteBundle);
      merged.teamId = teamId;
      merged.exportedAt = new Date().toISOString();

      const row = {
        team_id: teamId,
        payload: merged,
        updated_at: merged.exportedAt,
        updated_by: body.updatedBy || 'vercel-api',
      };

      const upserted = await supabaseFetch(`${TABLE}?on_conflict=team_id`, {
        method: 'POST',
        headers: { Prefer: 'resolution=merge-duplicates,return=representation' },
        body: JSON.stringify(row),
      });

      const saved = Array.isArray(upserted) ? upserted[0] : upserted;
      return json(res, 200, {
        ok: true,
        teamId,
        bundle: saved?.payload || merged,
        updatedAt: saved?.updated_at || merged.exportedAt,
        merged: !!remoteBundle,
      });
    }

    return json(res, 405, { ok: false, error: 'Method not allowed' });
  } catch (err) {
    console.error('moat-sync error:', err);
    return json(res, 500, { ok: false, error: err.message || 'Sync failed' });
  }
};