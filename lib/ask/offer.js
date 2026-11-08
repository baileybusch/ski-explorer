/**
 * Ask's inline alert signup offer (generative UI part `offerAlertSignup`).
 *
 * Never pushy: offered at most once per browser session, only after real interest
 * (2+ questions, or a named resort/region/month), never after a dismiss or a signup —
 * unless the user explicitly asks to be alerted, which always gets the card.
 * The client owns the session state ({ shown, dismissed, subscribed }) and sends it each turn.
 */
import { mentionedResorts, monthFromText, regionNamed } from './answer.js';
import { parseTripSentence } from '../agent/parseTrip.js';

const EXPLICIT_RE = /\b(alert|notify|email|e-mail|text|ping|tell|remind)\s+me\b|\bsign\s+(me\s+)?up\b|\bsubscribe\b|\bget\s+(an?\s+)?(alerts?|emails?|notifications?)\b/i;

export const OFFER_TOOL = 'offerAlertSignup';

export function wantsAlerts(text = '') {
  return EXPLICIT_RE.test(String(text));
}

function userTexts(messages = []) {
  return messages
    .filter(m => m?.role === 'user')
    .map(m => (m.parts || []).filter(p => p?.type === 'text').map(p => p.text).join(' ').trim())
    .filter(Boolean);
}

function regionIn(text, cat) {
  const parsed = parseTripSentence(text, { regions: cat.regions || [], resorts: cat.resorts || [] });
  const id = parsed.region?.id;
  return id && regionNamed(text, cat, id) ? (cat.regions || []).find(g => g.id === id) || null : null;
}

/** What the card offers alerts for: the most recently named resort, else region, else the board's region. */
export function offerTarget(messages, cat = {}) {
  const texts = userTexts(messages);
  for (let i = texts.length - 1; i >= 0; i--) {
    const r = mentionedResorts(texts[i], cat)[0];
    if (r) return { type: 'resort', id: r.id, name: r.name };
    const g = regionIn(texts[i], cat);
    if (g) return { type: 'region', id: g.id, name: g.name };
  }
  const boardRegion = cat.board?.regionId && (cat.regions || []).find(g => g.id === cat.board.regionId);
  return boardRegion ? { type: 'region', id: boardRegion.id, name: boardRegion.name } : null;
}

export function cleanOfferState(raw) {
  const s = raw && typeof raw === 'object' ? raw : {};
  return { shown: s.shown === true, dismissed: s.dismissed === true, subscribed: s.subscribed === true };
}

/**
 * @returns {{ offer: boolean, reason: string, target: {type,id,name}|null }}
 */
export function decideOffer({ messages = [], cat = {}, state = {} } = {}) {
  const st = cleanOfferState(state);
  const texts = userTexts(messages);
  const last = texts.at(-1) || '';
  const target = offerTarget(messages, cat);
  if (wantsAlerts(last)) return { offer: true, reason: 'asked', target };
  if (st.subscribed) return { offer: false, reason: 'subscribed', target };
  if (st.dismissed) return { offer: false, reason: 'dismissed', target };
  if (st.shown) return { offer: false, reason: 'already-offered', target };
  const lastTarget = mentionedResorts(last, cat)[0] || regionIn(last, cat);
  const month = monthFromText(last) != null;
  if (lastTarget && target) return { offer: true, reason: 'specific', target };
  if (month) return { offer: true, reason: 'month', target };
  if (texts.length >= 2) return { offer: true, reason: 'engaged', target };
  return { offer: false, reason: 'too-early', target };
}

export function offerHeadline(target) {
  return target ? `Want me to alert you when ${target.name} gets dumped on?` : 'Want me to alert you when your mountains get dumped on?';
}

/** UI message chunks for the offer card (no start/finish). */
export function offerChunks(decision) {
  if (!decision?.offer) return [];
  const id = `offer-${Date.now().toString(36)}`;
  const input = { reason: decision.reason, target: decision.target };
  return [
    { type: 'start-step' },
    { type: 'tool-input-available', toolCallId: id, toolName: OFFER_TOOL, input },
    { type: 'tool-output-available', toolCallId: id, output: { target: decision.target, headline: offerHeadline(decision.target), reason: decision.reason } },
    { type: 'finish-step' },
  ];
}
