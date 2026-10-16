import { loadData, digestEmail, sendEmail, allActive, emailConfigured } from '../_lib.js';
export const config = { maxDuration: 300 };
// Daily subscribers every run; weekly subscribers only on Saturday (Pacific). Daily at 13:30 UTC (6:30 AM PT), after the ~5 AM PT snow refresh deploys.
export default async function handler(req, res) {
  if (process.env.CRON_SECRET && req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) return res.status(401).json({ error: 'unauthorized' });
  if (!emailConfigured()) return res.json({ ok: true, sent: 0, note: 'RESEND_API_KEY not set; digest not sent' });
  const allow = (process.env.DIGEST_ALLOWLIST || '').split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
  const [data, subs] = await Promise.all([loadData(), allActive()]);
  const isSat = new Date().toLocaleDateString('en-US', { timeZone: 'America/Los_Angeles', weekday: 'short' }) === 'Sat';
  let sent = 0, failed = 0, skipped = 0;
  for (const s of subs) {
    const freq = s.freq || 'daily';
    if (freq === 'weekly' && !isSat) { skipped++; continue; }
    if (allow.length && !allow.includes(s.email)) continue;
    const { subject, html, unsubscribeUrl } = digestEmail({ data, followIds: s.resorts || [], token: s.token, freq });
    const r = await sendEmail({ to: s.email, subject, html, unsubscribeUrl });
    r.status && r.status < 300 ? sent++ : failed++;
    await new Promise(r => setTimeout(r, 600)); // Resend default limit ~2 req/s
  }
  res.json({ ok: true, subscribers: subs.length, sent, failed, skippedWeekly: skipped, saturday: isSat });
}
