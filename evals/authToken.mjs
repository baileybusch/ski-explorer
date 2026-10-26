import { MANAGE_TTL_SEC, SIGNIN_TTL_SEC, signAuthToken, verifyAuthToken } from '../lib/authToken.js';

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
      const [v, body, sig] = t.split('.');
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
