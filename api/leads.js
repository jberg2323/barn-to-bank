/**
 * Public website leads → Barn to Bank origination backend (Supabase moat bundle).
 * POST { name, phone?, email, about?, listing?, source? }
 * GET  → inbound leads for staff app
 * PATCH { id, status } → update lead status (contacted | converted | dismissed)
 */

const TABLE = 'moat_bundles';

function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, OPTIONS');
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

function teamId(req) {
  return process.env.MOAT_TEAM_ID || 'barn-to-bank-team';
}

async function loadBundle(tid) {
  const rows = await supabaseFetch(
    `${TABLE}?team_id=eq.${encodeURIComponent(tid)}&select=payload,updated_at&limit=1`,
    { method: 'GET' },
  );
  const row = Array.isArray(rows) ? rows[0] : null;
  return {
    payload: row?.payload || { deals: [], comps: [], audit: [], inboundLeads: [] },
    updatedAt: row?.updated_at || null,
  };
}

async function saveBundle(tid, payload) {
  const exportedAt = new Date().toISOString();
  const row = {
    team_id: tid,
    payload: {
      ...payload,
      teamId: tid,
      exportedAt,
      inboundLeads: payload.inboundLeads || [],
    },
    updated_at: exportedAt,
    updated_by: 'website-leads-api',
  };
  await supabaseFetch(`${TABLE}?on_conflict=team_id`, {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates,return=representation' },
    body: JSON.stringify(row),
  });
  return exportedAt;
}

function parseBody(req) {
  return typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {};
}

module.exports = async function handler(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(204).end();

  try {
    if (!process.env.SUPABASE_URL) {
      return json(res, 503, { ok: false, error: 'Lead capture not configured on server' });
    }

    const tid = teamId(req);

    if (req.method === 'GET') {
      const { payload } = await loadBundle(tid);
      const leads = (payload.inboundLeads || []).filter((l) => l.status !== 'dismissed');
      leads.sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
      return json(res, 200, { ok: true, leads, teamId: tid });
    }

    if (req.method === 'POST') {
      const body = parseBody(req);
      const name = String(body.name || '').trim();
      const email = String(body.email || '').trim();
      if (!name || !email) {
        return json(res, 400, { ok: false, error: 'Name and email are required' });
      }

      const lead = {
        id: `lead-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        name,
        phone: String(body.phone || '').trim(),
        email,
        about: String(body.about || '').trim(),
        listing: String(body.listing || '').trim(),
        source: body.source || 'website',
        status: 'new',
        createdAt: new Date().toISOString(),
      };

      const { payload } = await loadBundle(tid);
      const inboundLeads = [...(payload.inboundLeads || []), lead];
      await saveBundle(tid, { ...payload, inboundLeads });

      return json(res, 201, { ok: true, lead });
    }

    if (req.method === 'PATCH') {
      const body = parseBody(req);
      const id = body.id;
      const status = body.status;
      if (!id || !status) {
        return json(res, 400, { ok: false, error: 'id and status required' });
      }

      const { payload } = await loadBundle(tid);
      const inboundLeads = (payload.inboundLeads || []).map((l) =>
        l.id === id ? { ...l, status, updatedAt: new Date().toISOString() } : l,
      );
      if (!inboundLeads.some((l) => l.id === id)) {
        return json(res, 404, { ok: false, error: 'Lead not found' });
      }
      await saveBundle(tid, { ...payload, inboundLeads });
      return json(res, 200, { ok: true });
    }

    return json(res, 405, { ok: false, error: 'Method not allowed' });
  } catch (err) {
    console.error('leads-api error:', err);
    return json(res, 500, { ok: false, error: err.message || 'Lead API failed' });
  }
};