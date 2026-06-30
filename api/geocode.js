/**
 * Server-side proxy for U.S. Census geocoding (browser CORS blocks direct calls).
 * GET ?type=address&address=...  or  ?type=coords&lat=...&lng=...
 */

const CENSUS = 'https://geocoding.geo.census.gov/geocoder';

function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

function json(res, status, body) {
  cors(res);
  res.status(status).json(body);
}

module.exports = async function handler(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'GET') return json(res, 405, { ok: false, error: 'Method not allowed' });

  try {
    const type = String(req.query?.type || '').trim();
    let censusUrl = '';

    if (type === 'address') {
      const address = String(req.query?.address || '').trim();
      if (!address) return json(res, 400, { ok: false, error: 'address required' });
      censusUrl = `${CENSUS}/locations/onelineaddress?address=${encodeURIComponent(address)}&benchmark=Public_AR_Current&format=json`;
    } else if (type === 'coords') {
      const lat = Number(req.query?.lat);
      const lng = Number(req.query?.lng);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
        return json(res, 400, { ok: false, error: 'lat and lng required' });
      }
      censusUrl = `${CENSUS}/geographies/coordinates?x=${lng}&y=${lat}&benchmark=Public_AR_Current&vintage=Current_Current&format=json`;
    } else {
      return json(res, 400, { ok: false, error: 'type must be address or coords' });
    }

    const upstream = await fetch(censusUrl, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(12000),
    });
    const data = await upstream.json().catch(() => null);
    if (!upstream.ok) {
      return json(res, upstream.status, { ok: false, error: 'Census geocoder error', data });
    }
    return json(res, 200, { ok: true, result: data?.result || data });
  } catch (err) {
    console.error('geocode proxy error:', err);
    return json(res, 500, { ok: false, error: err.message || 'Geocode failed' });
  }
};