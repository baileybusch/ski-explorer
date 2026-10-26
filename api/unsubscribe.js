import { getSub, saveSub, page } from './_lib.js';
import { defaultPrefs } from '../lib/accountPrefs.js';
// GET (link in email) and POST (RFC 8058 List-Unsubscribe-Post one-click).
// Scoped to this subscriber only. Does not delete the record.
export default async function handler(req, res) {
  const sub = await getSub(req.query.token);
  if (sub) {
    sub.prefs = { ...defaultPrefs(), stormAlerts: false, recap: false, sponsor: false };
    sub.status = 'unsubscribed';
    (sub.rules || []).forEach(r => { r.paused = true; });
    await saveSub(sub);
  }
  if (req.method === 'POST') return res.status(200).json({ ok: true });
  res.setHeader('content-type', 'text/html').send(page('Unsubscribed', `<h1>You're unsubscribed</h1><p style="color:#aab">${sub ? 'No more SkiScope emails will be sent to this address.' : 'This address was already unsubscribed.'}</p>`));
}
