import { loadData, digestEmail } from '../_lib.js';
// Renders the daily digest. Demo only: never looks up real subscribers.
export default async function handler(req, res) {
  const data = await loadData();
  const follow = (req.query.resorts ? String(req.query.resorts).split(',') : ['alta', 'snowbird', 'eagle-point']).slice(0, 10);
  const { html, subject } = digestEmail({ data, followIds: follow, token: null, freq: req.query.freq === 'weekly' ? 'weekly' : 'daily' });
  res.setHeader('content-type', 'text/html; charset=utf-8');
  res.setHeader('x-digest-subject', encodeURIComponent(subject));
  res.send(html);
}
