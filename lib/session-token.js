const crypto = require('crypto');

function authSecret() {
  return process.env.AUTH_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || 'barn-to-bank-auth-v1';
}

function originationPassword() {
  return process.env.ORIGINATION_PASSWORD || 'zitlowinc';
}

function sessionToken() {
  const secret = authSecret();
  const password = originationPassword();
  return crypto.createHmac('sha256', secret).update(password).digest('base64url');
}

function cookieName() {
  return 'barn-session';
}

function sessionCookieHeader() {
  const maxAge = 60 * 60 * 24 * 30; // 30 days
  return `${cookieName()}=${sessionToken()}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`;
}

function clearSessionCookieHeader() {
  return `${cookieName()}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;
}

function isValidSessionCookie(value) {
  if (!value) return false;
  const expected = sessionToken();
  try {
    return crypto.timingSafeEqual(Buffer.from(value), Buffer.from(expected));
  } catch {
    return false;
  }
}

module.exports = {
  authSecret,
  originationPassword,
  sessionToken,
  cookieName,
  sessionCookieHeader,
  clearSessionCookieHeader,
  isValidSessionCookie,
};