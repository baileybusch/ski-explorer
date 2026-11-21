/**
 * Why the chat stopped, in words a skier understands.
 *
 * - 'rate': the server's per-IP question limit (403 code "rate_limited").
 * - 'cap':  the conversation hit its usage cap (eve opens a "budget" interaction).
 * - 'generic': anything else (network, stall, server error).
 */
export const CHAT_ERROR_COPY = {
  rate: 'Too many questions, try again in a few minutes.',
  cap: "This chat's gotten long, start a new one.",
  generic: 'Sorry, the snow desk didn’t answer. Try again in a moment.',
};

export function chatErrorKind(err) {
  if (!err) return null;
  const code = err.code || err.cause?.code;
  const body = `${err.body || ''} ${err.message || ''}`;
  if (code === 'rate_limited' || /rate_limited|too many questions|slow down/i.test(body)) return 'rate';
  if (/usage limit|session_usage|:limit:(usage|input|output|token-cost)/i.test(body)) return 'cap';
  return 'generic';
}

/** True when eve paused the session on its usage cap (an open "budget" interaction). */
export function isCapInteraction(i) {
  if (!i) return false;
  const kind = i.kind || i.request?.kind;
  const id = i.interactionId || i.id || '';
  return kind === 'budget' || /:limit:(usage|input|output|token-cost)/.test(id);
}
