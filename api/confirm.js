import { getSub, saveSub, page } from './_lib.js';
export default async function handler(req, res) {
  const sub = await getSub(req.query.token);
  if (!sub) return res.status(404).setHeader('content-type', 'text/html').send(page('Link expired', '<h1>Link not found</h1><p>This confirmation link is invalid or was already used to unsubscribe.</p>'));
  if (sub.status !== 'active') { sub.status = 'active'; sub.confirmed = new Date().toISOString(); await saveSub(sub); }
  res.redirect(302, `/alerts?token=${sub.token}&confirmed=1`);
}
