import { findByEmail, createSub, saveSub, sendEmail, confirmEmail, emailConfigured, isEmail, body, SITE } from './_lib.js';
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  const { email, resorts = [] } = await body(req);
  if (!isEmail(email)) return res.status(400).json({ error: 'Enter a valid email' });
  const ids = [...new Set(resorts.filter(r => typeof r === 'string' && /^[a-z0-9-]{2,40}$/.test(r)))].slice(0, 30);
  let sub = await findByEmail(email);
  if (!sub) sub = await createSub(email, ids);
  else { sub.resorts = [...new Set([...(sub.resorts || []), ...ids])]; await saveSub(sub); }
  if (sub.status === 'active') return res.json({ status: 'active', message: `Added. You're already subscribed — <a href="/alerts">manage alerts</a> from the link in any digest.` });
  const sent = await sendEmail({ to: sub.email, subject: 'Confirm your SkiScope snow alerts', html: confirmEmail(sub) });
  if (!emailConfigured()) return res.json({ status: 'pending', emailConfigured: false, message: 'Saved. Email delivery is not switched on yet, so the confirmation email could not be sent. You will be able to confirm once it is live.' });
  if (sent.status >= 300) return res.status(502).json({ error: 'Could not send confirmation email' });
  res.json({ status: 'pending', message: `Check ${sub.email} and tap the confirmation link to start alerts.` });
}
