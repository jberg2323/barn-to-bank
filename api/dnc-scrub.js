/**
 * Federal DNC scrub proxy, DNCScrub (Contact Center Compliance)
 * POST { phones: string[] } → scrub results (API key stays server-side)
 *
 * Env:
 *   DNC_SCRUB_API_KEY    , loginId from dncscrub.com portal (required for live)
 *   DNC_SCRUB_PROJECT_ID , optional projId
 *   DNC_SCRUB_CAMPAIGN_ID, optional campaignId
 *   DNC_SCRUB_MOCK=true  , local/demo mock when no vendor key
 */

const { scrubPhones } = require('../lib/dnc-scrub');

function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

function json(res, status, body) {
  cors(res);
  res.status(status).json(body);
}

function parseBody(req) {
  return typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {};
}

module.exports = async function handler(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(204).end();

  if (req.method !== 'POST') {
    return json(res, 405, { ok: false, error: 'Method not allowed' });
  }

  try {
    const body = parseBody(req);
    const phones = Array.isArray(body.phones) ? body.phones : [];
    if (!phones.length) {
      return json(res, 400, { ok: false, error: 'phones array required' });
    }
    if (phones.length > 1000) {
      return json(res, 400, { ok: false, error: 'Maximum 1,000 phone numbers per request' });
    }

    const { results, live, provider, transport } = await scrubPhones(phones);
    return json(res, 200, {
      ok: true,
      live,
      provider,
      transport: transport || (live ? 'rest' : 'mock'),
      results,
      summary: {
        total: results.length,
        cleared: results.filter((r) => r.status === 'cleared').length,
        blocked: results.filter((r) => r.status === 'blocked').length,
      },
    });
  } catch (err) {
    const code = err.code || 'SCRUB_FAILED';
    const status = code === 'NOT_CONFIGURED' ? 503
      : code === 'INVALID_PHONE' ? 400
        : 502;
    return json(res, status, { ok: false, error: err.message || 'DNC scrub failed', code });
  }
};