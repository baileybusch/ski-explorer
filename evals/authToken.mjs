import {
  MANAGE_TTL_SEC, SIGNIN_TTL_SEC, SESSION_TTL_SEC,
  consumeJti, csrfOk, peekJti, readCookie, resetConsumedForEval,
  sessionCookieHeader, signAuthToken, verifyAuthToken,
} from '../lib/authToken.js';
import { authRateLimit, resetAuthLimitForEval } from '../lib/authLimit.js';
import {
  CONSENT_TEXT, CONSENT_VERSION, NEUTRAL_MANAGE, NEUTRAL_SIGNUP,
  canReceiveEmail, consentRecord, isPendingExpired,
} from '../lib/consent.js';

const SECRET = 'eval-secret-not-for-prod';
const OTHER = 'other-secret';

const cases = [
  {
    id: 'sign-verify-manage',
    run: () => {
      const t = signAuthToken({ email: 'Bailey@Example.com', purpose: 'manage' }, SECRET);
      const v = verifyAuthToken(t, SECRET);
      const miss = [];
      if (!v.ok) miss.push(`not ok ${v.reason}`);
      if (v.email !== 'bailey@example.com') miss.push(`email ${v.email}`);
      if (v.purpose !== 'manage') miss.push(`purpose ${v.purpose}`);
      if (!v.jti) miss.push('missing jti');
      if (!t.startsWith('ss1.')) miss.push('version prefix');
      return miss;
    },
  },
  {
    id: 'signin-ttl-default',
    run: () => {
      const now = 1_700_000_000_000;
      const t = signAuthToken({ email: 'a@b.co', purpose: 'signin', now }, SECRET);
      const v = verifyAuthToken(t, SECRET, { now });
      const miss = [];
      if (!v.ok) miss.push(`not ok ${v.reason}`);
      if (v.exp !== Math.floor(now / 1000) + SIGNIN_TTL_SEC) miss.push(`exp ${v.exp}`);
      return miss;
    },
  },
  {
    id: 'session-ttl',
    run: () => {
      const now = 1_700_000_000_000;
      const t = signAuthToken({ email: 'a@b.co', purpose: 'session', now }, SECRET);
      const v = verifyAuthToken(t, SECRET, { purpose: 'session', now });
      return !v.ok || v.exp !== Math.floor(now / 1000) + SESSION_TTL_SEC
        ? [`session ttl ${JSON.stringify(v)}`] : [];
    },
  },
  {
    id: 'expired',
    run: () => {
      const now = 1_700_000_000_000;
      const t = signAuthToken({ email: 'a@b.co', purpose: 'manage', ttlSec: MANAGE_TTL_SEC, now }, SECRET);
      const v = verifyAuthToken(t, SECRET, { now: now + (MANAGE_TTL_SEC + 1) * 1000 });
      return v.ok || v.reason !== 'expired' ? [`expected expired, got ${JSON.stringify(v)}`] : [];
    },
  },
  {
    id: 'tampered-payload',
    run: () => {
      const t = signAuthToken({ email: 'a@b.co', purpose: 'manage' }, SECRET);
      const [v, , sig] = t.split('.');
      const bad = Buffer.from(JSON.stringify({ v: 1, e: 'evil@x.co', p: 'manage', exp: 9999999999 })).toString('base64url');
      const out = verifyAuthToken(`${v}.${bad}.${sig}`, SECRET);
      return out.ok ? ['tamper accepted'] : [];
    },
  },
  {
    id: 'wrong-secret',
    run: () => {
      const t = signAuthToken({ email: 'a@b.co' }, SECRET);
      const out = verifyAuthToken(t, OTHER);
      return out.ok ? ['wrong secret accepted'] : [];
    },
  },
  {
    id: 'purpose-mismatch',
    run: () => {
      const t = signAuthToken({ email: 'a@b.co', purpose: 'signin' }, SECRET);
      const out = verifyAuthToken(t, SECRET, { purpose: 'manage' });
      return out.ok || out.reason !== 'purpose' ? [`expected purpose, got ${JSON.stringify(out)}`] : [];
    },
  },
  {
    id: 'consume-once',
    run: () => {
      resetConsumedForEval();
      const t = signAuthToken({ email: 'a@b.co', purpose: 'signin' }, SECRET);
      const v = verifyAuthToken(t, SECRET);
      const a = consumeJti(v.jti);
      const b = consumeJti(v.jti);
      return a.ok && !b.ok && b.reason === 'replay' && peekJti(v.jti) ? [] : [`consume ${JSON.stringify({ a, b })}`];
    },
  },
  {
    id: 'csrf-origin',
    run: () => {
      const ok = csrfOk({ method: 'POST', headers: { host: 'skiscope.vercel.app', origin: 'https://skiscope.vercel.app' } });
      const bad = csrfOk({ method: 'POST', headers: { host: 'skiscope.vercel.app', origin: 'https://evil.test' } });
      const get = csrfOk({ method: 'GET', headers: { host: 'skiscope.vercel.app', origin: 'https://evil.test' } });
      return ok && !bad && get ? [] : ['csrf'];
    },
  },
  {
    id: 'session-cookie-flags',
    run: () => {
      const h = sessionCookieHeader('tok');
      const miss = [];
      if (!h.includes('HttpOnly')) miss.push('httponly');
      if (!h.includes('SameSite=Lax')) miss.push('samesite');
      if (!h.includes('Secure')) miss.push('secure');
      if (readCookie(`foo=1; ss_sess=tok; bar=2`) !== 'tok') miss.push('parse');
      return miss;
    },
  },
  {
    id: 'rate-limit-email',
    run: () => {
      resetAuthLimitForEval();
      let blocked = false;
      for (let i = 0; i < 6; i++) {
        const r = authRateLimit({ email: 'a@b.co', ip: '1.1.1.1' });
        if (!r.ok) blocked = true;
      }
      return blocked ? [] : ['did not rate limit'];
    },
  },
  {
    id: 'consent-version-lockstep',
    run: () => {
      const miss = [];
      if (CONSENT_VERSION !== 'ss-consent-1') miss.push(`version ${CONSENT_VERSION}`);
      if (!CONSENT_TEXT.includes('sponsored content')) miss.push('missing sponsor mention');
      if (/sell/i.test(CONSENT_TEXT)) miss.push('selling-data language');
      const rec = consentRecord({ source: 'signup', ip: '203.0.113.9', salt: 'eval', now: 1_700_000_000_000 });
      if (rec.version !== CONSENT_VERSION) miss.push('record version');
      if (rec.source !== 'signup') miss.push('source');
      if (!rec.ipHash || rec.ipHash === '203.0.113.9') miss.push('ip not hashed');
      return miss;
    },
  },
  {
    id: 'pending-expires-seven-days',
    run: () => {
      const created = new Date(1_700_000_000_000).toISOString();
      const pending = { status: 'pending', created };
      const fresh = isPendingExpired(pending, 1_700_000_000_000 + 2 * 86400000);
      const old = isPendingExpired(pending, 1_700_000_000_000 + 8 * 86400000);
      const active = canReceiveEmail({ status: 'active', created }, 1_700_000_000_000 + 8 * 86400000);
      const unsub = canReceiveEmail({ status: 'unsubscribed', created }, 1_700_000_000_000);
      return !fresh && old && active && !unsub ? [] : ['pending expiry'];
    },
  },
  {
    id: 'enumeration-safe-copy',
    run: () => {
      const miss = [];
      if (NEUTRAL_SIGNUP.message !== NEUTRAL_SIGNUP.message) miss.push('signup');
      if (!/check your email/i.test(NEUTRAL_SIGNUP.message)) miss.push('signup copy');
      if (!/if that address is on file/i.test(NEUTRAL_MANAGE.message)) miss.push('manage copy');
      return miss;
    },
  },
];

export function runAuthTokenEvals() {
  let fail = 0;
  const lines = [];
  for (const c of cases) {
    const miss = c.run();
    if (miss.length) {
      fail++;
      lines.push(`FAIL  ${c.id}  ${miss.join('; ')}`);
    } else {
      lines.push(`ok    ${c.id}`);
    }
  }
  return { fail, total: cases.length, lines };
}
