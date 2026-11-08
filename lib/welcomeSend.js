/**
 * Server-only: render + send one welcome step and record it on the subscriber.
 * sendEmail enforces the gate (EMAIL_ALERTS_ENABLED, or forceTest to the test allowlist only).
 */
import { welcomeEmail } from './emails.js';
import { markWelcome, welcomeDue, welcomeRows, watchLabel } from './welcome.js';
import { loadCatalog } from './skiscope-tools/index.js';
import { saveSub, sendEmail } from '../api/_lib.js';

export function welcomeCatalog() {
  const cat = loadCatalog();
  return { ...(cat.snow || {}), index: cat.resorts || [], regions: cat.regions || [] };
}

export function renderWelcome(sub, step, snowJson = welcomeCatalog()) {
  return welcomeEmail({
    step,
    rows: welcomeRows(sub, snowJson),
    label: watchLabel(sub, snowJson),
    shareRegion: sub.rules?.find(r => r.region)?.region || 'utah',
    token: sub.token,
    email: sub.email,
  });
}

/** Sends the step that is due now (if any). Returns { step, result } or null. */
export async function sendDueWelcome(sub, { now = Date.now(), snowJson, forceTest = false } = {}) {
  const step = welcomeDue(sub, now);
  if (!step) return null;
  const mail = renderWelcome(sub, step, snowJson);
  const result = await sendEmail({ to: sub.email, ...mail, forceTest });
  if (result.status && result.status < 300) {
    markWelcome(sub, step, now);
    await saveSub(sub);
  }
  return { step, result };
}
