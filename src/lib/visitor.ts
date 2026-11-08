/**
 * Anonymous visitor id for insights. Sent with Ask questions and funnel events; linked to an
 * email server-side once the visitor signs up or signs in (see Privacy Policy).
 */
const SID = 'ss_sid';
const DNS = 'ss_dns';
const OFFER = 'ss_offer';

function randomId() {
  const bytes = new Uint8Array(12);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, b => b.toString(36).padStart(2, '0')).join('').slice(0, 20);
}

export function visitorId(): string {
  try {
    let id = localStorage.getItem(SID);
    if (!id || !/^[A-Za-z0-9_-]{8,64}$/.test(id)) {
      id = randomId();
      localStorage.setItem(SID, id);
    }
    return id;
  } catch {
    return '';
  }
}

export type FunnelEvent =
  | { type: 'offer'; action: 'shown' | 'accepted' | 'dismissed'; target?: { type: string; id: string | null } | null }
  | { type: 'dns'; optOut: boolean }
  | { type: 'signup'; email: string; source: string; kind: string; resorts: string[]; region: string | null; consentVersion: string };

/** Fire-and-forget; the dev server and Vercel both serve /api/events. */
export function track(events: FunnelEvent | FunnelEvent[]) {
  const list = Array.isArray(events) ? events : [events];
  if (!list.length) return;
  fetch('/api/events', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ sid: visitorId(), events: list }),
    keepalive: true,
  }).catch(() => {});
}

export function doNotSell(): boolean {
  try { return localStorage.getItem(DNS) === '1'; } catch { return false; }
}

export function setDoNotSell(on: boolean) {
  try { localStorage.setItem(DNS, on ? '1' : '0'); } catch { /* private mode */ }
  track({ type: 'dns', optOut: on });
}

export type OfferState = { shown: boolean; dismissed: boolean; subscribed: boolean };

/** Ask's signup-offer state lives for the browser session (sessionStorage). */
export function offerState(): OfferState {
  try {
    const s = JSON.parse(sessionStorage.getItem(OFFER) || '{}');
    return { shown: s.shown === true, dismissed: s.dismissed === true, subscribed: s.subscribed === true };
  } catch {
    return { shown: false, dismissed: false, subscribed: false };
  }
}

export function setOfferState(patch: Partial<OfferState>) {
  try { sessionStorage.setItem(OFFER, JSON.stringify({ ...offerState(), ...patch })); } catch { /* private mode */ }
}
