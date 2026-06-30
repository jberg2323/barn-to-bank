/**
 * Barn to Bank feature requests → Supabase (team-visible intake).
 * POST { id?, name, email?, type, priority, title, description, context? }
 * GET  → all requests for the team (newest first)
 */

const TABLE = 'feature_requests';
const { sendFeatureRequestEmail } = require('../lib/feature-request-email');

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

function teamId() {
  return process.env.MOAT_TEAM_ID || 'barn-to-bank-team';
}

function parseBody(req) {
  return typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {};
}

function normalizeAttachments(raw) {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((a) => a && (a.dataUrl || a.url))
    .slice(0, 2)
    .map((a) => ({
      name: String(a.name || 'attachment').slice(0, 200),
      mime: String(a.mime || 'application/octet-stream').slice(0, 120),
      size: parseInt(a.size, 10) || 0,
      dataUrl: String(a.dataUrl || a.url || ''),
    }))
    .filter((a) => a.dataUrl.length < 2_800_000);
}

function toClientRow(row) {
  return {
    id: row.id,
    name: row.name,
    email: row.email || '',
    type: row.type,
    priority: row.priority,
    title: row.title,
    description: row.description,
    context: row.context || '',
    attachments: normalizeAttachments(row.attachments),
    submittedAt: row.submitted_at,
    status: row.status,
  };
}

module.exports = async function handler(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(204).end();

  try {
    if (!process.env.SUPABASE_URL) {
      return json(res, 503, { ok: false, error: 'Feature request capture not configured on server' });
    }

    const tid = teamId();

    if (req.method === 'GET') {
      const rows = await supabaseFetch(
        `${TABLE}?team_id=eq.${encodeURIComponent(tid)}&select=*&order=submitted_at.desc&limit=100`,
        { method: 'GET' },
      );
      const requests = (Array.isArray(rows) ? rows : []).map(toClientRow);
      return json(res, 200, { ok: true, requests, teamId: tid });
    }

    if (req.method === 'POST') {
      const body = parseBody(req);
      const name = String(body.name || '').trim();
      const title = String(body.title || '').trim();
      const description = String(body.description || '').trim();
      const type = String(body.type || 'feature').trim();
      const priority = String(body.priority || 'important').trim();

      if (!name || !title || !description) {
        return json(res, 400, { ok: false, error: 'Name, title, and description are required' });
      }

      const submittedAt = body.submittedAt || new Date().toISOString();
      const attachments = normalizeAttachments(body.attachments);

      const row = {
        id: String(body.id || `fr-${Date.now()}`).trim(),
        team_id: tid,
        name,
        email: String(body.email || '').trim() || null,
        type,
        priority,
        title,
        description,
        context: String(body.context || '').trim() || null,
        attachments: attachments.length ? attachments : null,
        submitted_at: submittedAt,
        status: 'new',
      };

      let inserted;
      try {
        inserted = await supabaseFetch(TABLE, {
          method: 'POST',
          body: JSON.stringify(row),
        });
      } catch (err) {
        if (attachments.length && /attachments|column|schema/i.test(String(err.message))) {
          const { attachments: _drop, ...rowWithout } = row;
          inserted = await supabaseFetch(TABLE, {
            method: 'POST',
            body: JSON.stringify(rowWithout),
          });
        } else {
          throw err;
        }
      }
      const saved = Array.isArray(inserted) ? inserted[0] : inserted;
      const request = toClientRow(saved || row);

      let emailed = false;
      let emailError = null;
      try {
        const mail = await sendFeatureRequestEmail(request);
        emailed = !!mail.ok;
        if (!mail.ok) {
          emailError = mail.error || 'Email not sent';
          console.warn('feature-request email not sent:', emailError);
        }
      } catch (err) {
        emailError = err?.message || 'Email failed';
        console.warn('feature-request email failed:', err);
      }

      return json(res, 201, { ok: true, request, emailed, emailError });
    }

    return json(res, 405, { ok: false, error: 'Method not allowed' });
  } catch (err) {
    console.error('feature-requests-api error:', err);
    return json(res, 500, { ok: false, error: err.message || 'Feature request API failed' });
  }
};