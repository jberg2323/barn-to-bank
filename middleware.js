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
  if (pathname.startsWith('/api/')) return true;
  if (pathname.startsWith('/lib/')) return true;
  if (
    pathname === '/reference-page.html'
    || pathname === '/iframe-page.html'
    || pathname === '/raw-source.html'
    || pathname === '/public-site.html'
  ) return true;
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

  if (pathname.startsWith('/api/') || pathname.startsWith('/lib/')) {
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
    '/api/:path*',
    '/lib/:path*',
    '/reference-page.html',
    '/iframe-page.html',
    '/raw-source.html',
    '/public-site.html',
  ],
};