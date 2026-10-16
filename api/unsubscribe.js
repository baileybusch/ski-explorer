import { getSub, deleteSub, page } from './_lib.js';
// GET (link in email) and POST (RFC 8058 List-Unsubscribe-Post one-click) both unsubscribe immediately.
export default async function handler(req, res) {
  const sub = await getSub(req.query.token);
  if (sub) await deleteSub(sub);
  if (req.method === 'POST') return res.status(200).json({ ok: true });
  res.setHeader('content-type', 'text/html').send(page('Unsubscribed', `<h1>You're unsubscribed</h1><p style="color:#aab">${sub ? 'No more SkiScope emails will be sent to this address.' : 'This address was already unsubscribed.'}</p>`));
}
