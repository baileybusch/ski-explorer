/**
 * Generate + email daily/weekly reports. Same gates as api/cron/digest.js.
 */
import { EMAIL_ALERTS_ENABLED } from '../../public/config.js';
import { loadData, digestEmail, sendEmail, allActive, emailConfigured, TEST_SEND_ALLOWLIST } from '../../api/_lib.js';

export async function sendDueReports({ now = new Date(), forceTest = false } = {}) {
  if (!EMAIL_ALERTS_ENABLED && !forceTest) {
    return { ok: true, sent: 0, paused: true, note: 'EMAIL_ALERTS_ENABLED=false' };
  }
  if (!emailConfigured()) return { ok: true, sent: 0, note: 'RESEND_API_KEY not set' };

  const allow = (process.env.DIGEST_ALLOWLIST || '').split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
  const [data, subs] = await Promise.all([loadData(), allActive()]);
  const isSat = now.toLocaleDateString('en-US', { timeZone: 'America/Los_Angeles', weekday: 'short' }) === 'Sat';
  let sent = 0, failed = 0, skipped = 0;
  for (const s of subs) {
    const freq = s.freq || 'daily';
    if (freq === 'weekly' && !isSat) { skipped++; continue; }
    if (allow.length && !allow.includes(s.email)) continue;
    if (!EMAIL_ALERTS_ENABLED && !TEST_SEND_ALLOWLIST.includes(s.email)) continue;
    const { subject, html, unsubscribeUrl } = digestEmail({ data, followIds: s.resorts || [], token: s.token, freq });
    const r = await sendEmail({
      to: s.email, subject, html, unsubscribeUrl,
      forceTest: !EMAIL_ALERTS_ENABLED && TEST_SEND_ALLOWLIST.includes(s.email),
    });
    r.status && r.status < 300 ? sent++ : failed++;
  }
  return { ok: true, subscribers: subs.length, sent, failed, skippedWeekly: skipped, saturday: isSat };
}
