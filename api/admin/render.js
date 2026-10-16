import { findByEmail, confirmEmail, digestEmail, loadData, SITE } from '../_lib.js';
// Admin-only: render the confirmation + digest emails for an allowlisted subscriber so they can be
// sent out-of-band. Auth: Bearer CRON_SECRET. Only emails in DIGEST_ALLOWLIST are served.
export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (!process.env.CRON_SECRET || req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) return res.status(401).json({ error: 'unauthorized' });
  const email = String(req.query.email || '').toLowerCase();
  const allow = (process.env.DIGEST_ALLOWLIST || '').split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
  if (!allow.includes(email)) return res.status(403).json({ error: 'not allowlisted' });
  const sub = await findByEmail(email);
  if (!sub) return res.status(404).json({ error: 'no subscription' });
  const data = await loadData();
  const d = digestEmail({ data, followIds: sub.resorts || [], token: sub.token });
  res.json({ status: sub.status, confirm: { subject: 'Confirm your SkiScope snow alerts', html: confirmEmail(sub) }, digest: d });
}
