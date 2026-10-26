import { findByEmail, getSub, saveSub, page } from './_lib.js';
import { consumeJti, verifyAuthToken } from '../lib/authToken.js';
import { isPendingExpired } from '../lib/consent.js';

export default async function handler(req, res) {
  const raw = String(req.query.token || '');
  let sub = await getSub(raw);
  if (!sub && raw.startsWith('ss1.')) {
    const v = verifyAuthToken(raw, undefined, { purpose: 'confirm' });
    if (v.ok) {
      if (v.jti) consumeJti(v.jti);
      sub = await findByEmail(v.email);
    }
  }
  if (!sub) {
    return res.status(404).setHeader('content-type', 'text/html').send(page('Link expired', '<h1>Link not found</h1><p>This confirmation link is invalid or was already used.</p>'));
  }
  if (isPendingExpired(sub)) {
    return res.status(410).setHeader('content-type', 'text/html').send(page('Link expired', '<h1>This signup expired</h1><p>Unconfirmed signups expire after 7 days. Enter your email again to get a new link.</p>'));
  }
  if (sub.status !== 'active') {
    sub.status = 'active';
    sub.confirmed = new Date().toISOString();
    await saveSub(sub);
  }
  res.redirect(302, `/manage?confirmed=1`);
}
