/**
 * Chat-driven recurring reports. Reuses Blob subs, ss-consent-4, auth tokens, Resend.
 * EMAIL_ALERTS_ENABLED=false kill switch; test-only send to baileybusch@gmail.com.
 */
import { EMAIL_ALERTS_ENABLED } from '../../public/config.js';
import { CONSENT_TEXT, CONSENT_VERSION } from '../consentText.js';
import { consentRecord } from '../consent.js';
import { createSub, findByEmail, saveSub, sendEmail, confirmEmail, isEmail, TEST_SEND_ALLOWLIST } from '../../api/_lib.js';

export { CONSENT_TEXT, CONSENT_VERSION, TEST_SEND_ALLOWLIST };

function previewEnv() {
  return process.env.VERCEL_ENV === 'preview' || process.env.VERCEL_ENV === 'development';
}

export async function startReportSubscription({
  email, resorts = [], freq = 'weekly', source = 'chat', ip = 'unknown',
} = {}) {
  const addr = String(email || '').toLowerCase().trim();
  if (!isEmail(addr)) {
    return { ok: false, need: 'email', message: 'I need a real email to send reports.' };
  }
  const ids = [...new Set((resorts || []).filter(r => typeof r === 'string' && /^[a-z0-9-]{2,40}$/.test(r)))].slice(0, 12);
  const cadence = freq === 'daily' ? 'daily' : 'weekly';
  const test = TEST_SEND_ALLOWLIST.includes(addr);
  const consent = consentRecord({ source, ip });

  if (!EMAIL_ALERTS_ENABLED && !test) {
    return {
      ok: false,
      paused: true,
      wrote: false,
      sent: false,
      consentVersion: CONSENT_VERSION,
      consentText: CONSENT_TEXT,
      message: EMAIL_ALERTS_ENABLED
        ? 'Could not save that subscription.'
        : 'Reports are paused (EMAIL_ALERTS_ENABLED=false). Nothing was saved or emailed. Confirm your address and mountains when Bailey turns reports on.',
    };
  }

  let sub = await findByEmail(addr);
  if (!sub) {
    sub = await createSub(addr, ids, { freq: cadence, consent });
  } else {
    sub.resorts = [...new Set([...(sub.resorts || []), ...ids])];
    sub.freq = cadence;
    if (!sub.consent) sub.consent = consent;
    if (sub.status !== 'active') sub.status = 'pending';
    await saveSub(sub);
  }

  const mail = confirmEmail(sub);
  const forceTest = test && !EMAIL_ALERTS_ENABLED;
  const sent = await sendEmail({ to: addr, ...mail, forceTest });
  return {
    ok: true,
    status: 'check-email',
    wrote: true,
    sent: !sent.skipped && sent.status && sent.status < 300,
    skipped: sent.skipped || null,
    preview: previewEnv(),
    consentVersion: CONSENT_VERSION,
    consentText: CONSENT_TEXT,
    freq: cadence,
    resorts: sub.resorts,
    message: 'Check your email for a confirmation link. Unconfirmed signups receive nothing and expire after 7 days. Unsubscribe anytime.',
  };
}
