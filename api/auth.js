/**
 * Origination platform auth
 * POST { password } → sets session cookie
 * DELETE → clears session cookie
 */

const {
  originationPassword,
  sessionCookieHeader,
  clearSessionCookieHeader,
} = require('../lib/session-token');

function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

function json(res, status, body, extraHeaders = {}) {
  cors(res);
  Object.entries(extraHeaders).forEach(([k, v]) => res.setHeader(k, v));
  res.status(status).json(body);
}

function parseBody(req) {
  return typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {};
}

module.exports = async function handler(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(204).end();

  if (req.method === 'POST') {
    try {
      const body = parseBody(req);
      const password = String(body.password || '').trim();
      if (!password) {
        return json(res, 400, { ok: false, error: 'Password required' });
      }
      if (password !== originationPassword()) {
        return json(res, 401, { ok: false, error: 'Invalid password' });
      }
      return json(res, 200, { ok: true }, { 'Set-Cookie': sessionCookieHeader() });
    } catch (err) {
      return json(res, 500, { ok: false, error: err.message || 'Auth failed' });
    }
  }

  if (req.method === 'DELETE') {
    return json(res, 200, { ok: true }, { 'Set-Cookie': clearSessionCookieHeader() });
  }

  return json(res, 405, { ok: false, error: 'Method not allowed' });
};