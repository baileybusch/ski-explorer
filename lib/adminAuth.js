/**
 * /admin session: password from the ADMIN_PASSWORD env var (never in the repo), exchanged for a
 * 12-hour HttpOnly cookie. The cookie is an HMAC keyed by the password itself, so rotating the
 * password signs everyone out.
 */
import crypto from 'node:crypto';

export const ADMIN_COOKIE = 'ss_admin';
export const ADMIN_TTL_SEC = 12 * 60 * 60;

const key = password => crypto.createHash('sha256').update(`ss-admin:${password}`).digest();
const mac = (password, exp) => crypto.createHmac('sha256', key(password)).update(`adm1.${exp}`).digest('base64url');

export function passwordOk(input, password) {
  if (!password || typeof input !== 'string' || !input) return false;
  const a = crypto.createHash('sha256').update(input).digest();
  const b = crypto.createHash('sha256').update(password).digest();
  return crypto.timingSafeEqual(a, b);
}

export function signAdminSession(password, now = Date.now()) {
  const exp = Math.floor(now / 1000) + ADMIN_TTL_SEC;
  return `adm1.${exp}.${mac(password, exp)}`;
}

export function verifyAdminSession(token, password, now = Date.now()) {
  if (!password || typeof token !== 'string') return false;
  const m = token.match(/^adm1\.(\d{9,12})\.([A-Za-z0-9_-]{20,})$/);
  if (!m) return false;
  if (+m[1] < Math.floor(now / 1000)) return false;
  const want = Buffer.from(mac(password, m[1]));
  const got = Buffer.from(m[2]);
  return want.length === got.length && crypto.timingSafeEqual(want, got);
}

export function adminCookieHeader(token, { secure = true, clear = false } = {}) {
  const parts = [`${ADMIN_COOKIE}=${clear ? '' : token}`, 'HttpOnly', 'SameSite=Strict', 'Path=/api', `Max-Age=${clear ? 0 : ADMIN_TTL_SEC}`];
  if (secure) parts.push('Secure');
  return parts.join('; ');
}
