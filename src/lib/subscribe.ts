/**
 * One signup path for every capture point (onboarding sheet, region/pass CTA, Ask's inline card).
 * Live: POST /api/subscribe (double opt-in; the server records the signup and links the visitor).
 * Preview/paused: the rule stays on this device and a preview signup event feeds /admin.
 */
import { type AlertsUiMode } from '@/lib/alertsUi';
import { type LocalRule, addLocalRule, setAccountEmail, updateLocalRule } from '@/lib/alertRules';
import { track, visitorId } from '@/lib/visitor';
import { referralId } from '@/lib/share';
import { CONSENT_VERSION } from '../../lib/consentText.js';

export type CaptureSource = 'home' | 'resort' | 'region' | 'pass' | 'chat' | 'search' | 'trip' | 'menu' | 'signup' | 'incoming' | 'edit';

export function validEmail(addr: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(addr.trim());
}

export async function subscribeRule({
  payload, mode, source, editId, extra = {},
}: {
  payload: Partial<LocalRule> & { email: string };
  mode: AlertsUiMode;
  source: CaptureSource;
  editId?: string;
  extra?: Record<string, unknown>;
}): Promise<{ ok: true } | { error: string }> {
  const email = payload.email.trim().toLowerCase();
  if (!validEmail(email)) return { error: 'Enter a valid email' };
  setAccountEmail(email);
  if (mode !== 'live') {
    if (editId) updateLocalRule(editId, payload);
    else addLocalRule(payload);
    if (!editId) {
      track({
        type: 'signup', email, source, kind: payload.type || 'resort',
        resorts: payload.resorts || [], region: payload.region || null, consentVersion: CONSENT_VERSION,
        ref: referralId() || undefined,
      });
    }
    return { ok: true };
  }
  try {
    const r = await fetch('/api/subscribe', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ...payload, ...extra, source, sid: visitorId(), ref: referralId() || undefined }),
    });
    const j = await r.json().catch(() => ({ error: 'Could not save' }));
    return j.error ? { error: String(j.error) } : { ok: true };
  } catch {
    return { error: 'Could not reach the server. Try again.' };
  }
}
