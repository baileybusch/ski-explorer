import { getSub, saveSub, body } from './_lib.js';
export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  const b = req.method === 'POST' ? await body(req) : {};
  const sub = await getSub(req.query.token || b.token);
  if (!sub) return res.status(404).json({ error: 'Subscription not found' });
  if (req.method === 'POST') {
    sub.resorts = [...new Set((b.resorts || []).filter(r => typeof r === 'string' && /^[a-z0-9-]{2,40}$/.test(r)))].slice(0, 30);
    if (b.freq === 'daily' || b.freq === 'weekly' || b.freq === 'on-trigger') sub.freq = b.freq;
    if (Array.isArray(b.rules)) {
      sub.rules = b.rules.slice(0, 8).map(r => ({
        ...(sub.rules || []).find(x => x.id === r.id),
        ...r,
        tier: r.tier === 'paid' ? 'paid' : 'free',
      }));
    }
    await saveSub(sub);
  }
  res.json({
    email: sub.email.replace(/^(.).*(@.*)$/, '$1•••$2'),
    status: sub.status,
    resorts: sub.resorts,
    freq: sub.freq || 'daily',
    rules: sub.rules || [],
  });
}
