const COOKIE_NAME = 'barn-session';

function authSecret() {
  return process.env.AUTH_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || 'barn-to-bank-auth-v1';
}

function originationPassword() {
  return process.env.ORIGINATION_PASSWORD || 'zitlowinc';
}

async function sessionToken() {
  const secret = authSecret();
  const password = originationPassword();
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(password));
  const bytes = new Uint8Array(sig);
  let binary = '';
  bytes.forEach((b) => { binary += String.fromCharCode(b); });
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function parseCookies(header) {
  const out = {};
  if (!header) return out;
  header.split(';').forEach((part) => {
    const idx = part.indexOf('=');
    if (idx === -1) return;
    const key = part.slice(0, idx).trim();
    const val = part.slice(idx + 1).trim();
    out[key] = val;
  });
  return out;
}

function isPublicPath(pathname, method) {
  if (pathname === '/app/login' || pathname === '/login.html') return true;
  if (pathname === '/api/auth') return true;
  if (pathname === '/api/leads' && method === 'POST') return true;
  if (method === 'OPTIONS') return true;
  return false;
}

function isProtectedPath(pathname) {
  if (pathname === '/app' || pathname.startsWith('/app/')) return true;
  if (pathname === '/barn-to-bank.html') return true;
  if (pathname === '/api/leads') return true;
  if (pathname === '/api/moat-sync') return true;
  if (pathname === '/api/moat-config') return true;
  if (pathname === '/api/dnc-scrub') return true;
  if (pathname === '/api/feature-requests') return true;
  if (pathname === '/api/geocode') return true;
  return false;
}

export default async function middleware(request) {
  const url = new URL(request.url);
  const { pathname } = url;
  const method = request.method || 'GET';

  if (!isProtectedPath(pathname) || isPublicPath(pathname, method)) {
    return;
  }

  const cookies = parseCookies(request.headers.get('cookie'));
  const session = cookies[COOKIE_NAME];
  const expected = await sessionToken();

  if (session && session === expected) {
    return;
  }

  if (pathname.startsWith('/api/')) {
    return Response.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  }

  const loginUrl = new URL('/app/login', url.origin);
  loginUrl.searchParams.set('next', pathname + url.search);
  return Response.redirect(loginUrl, 302);
}

export const config = {
  matcher: [
    '/app',
    '/app/:path*',
    '/barn-to-bank.html',
    '/api/leads',
    '/api/moat-sync',
    '/api/moat-config',
    '/api/dnc-scrub',
    '/api/feature-requests',
    '/api/geocode',
  ],
};