/**
 * Deterministic voice checks for chat answers (evals + live preview checks).
 * Mirrors agent/instructions.md: no "depth rise", weekend answers use weekend days
 * only, no unsupported color, and never "fell" for estimated new snow.
 */
export const DEPTH_RISE = /depth[-_ ]?rise|\bsnwd\b|peak[-_ ]?rise/i;
export const SEVEN_DAY = /\b(7|seven)[- ]day|next (7|seven) days|over the next week|this week'?s total|coming week/i;
/** Last 24h/72h are depth / water-content / model numbers, never a snowfall count. */
export const FELL = /\b(fell|fallen)\b/i;
/** '0.4" inches': one unit only. */
export const DOUBLE_UNIT = /\d(?:\.\d+)?\s?(?:″|"|”)\s?(?:inches|inch|in\b)/i;
/** Short one-mountain / pick answers: about 90 words, flag past this. */
export const MAX_WORDS = 110;
export const wordCount = t => (String(t).trim().match(/\S+/g) || []).length;
export const UNSUPPORTED_COLOR = /lift[- ]?(lines?|runs?)|crowds?|grooming|groomers|higher[- ]altitude|tree skiing|fresh tracks all day|bluebird/i;

/** @returns {string[]} issue ids */
export function voiceIssues(text = '', { weekend = false, sundayOnly = false, short = false } = {}) {
  const t = String(text);
  const out = [];
  if (DOUBLE_UNIT.test(t)) out.push('double-unit');
  if (sundayOnly && /\b(?:over |this |the )weekend\b/i.test(t) && !/\bsunday\b/i.test(t)) out.push('weekend-not-sunday');
  if (short && wordCount(t) > MAX_WORDS) out.push('too-long');
  if (DEPTH_RISE.test(t)) out.push('depth-rise');
  if (weekend && SEVEN_DAY.test(t)) out.push('weekend-uses-7-day');
  if (UNSUPPORTED_COLOR.test(t)) out.push('unsupported-color');
  if (FELL.test(t)) out.push('fell');
  return out;
}

export const isWeekendQuestion = q => /\bweekend\b|\bsaturday\b|\bsunday\b/i.test(String(q));

/** Opening verdicts that belong at the end of a one-mountain answer ("June's a no.", "Mammoth's the call."). */
export const VERDICT_OPENER = /^\s*(?:my take\b|(?:yes|no|nope|skip it|go|pass)\b[.,!:]|[A-Z][\w’'. -]{0,40}?(?:['’]s| is) (?:a (?:no|yes|pass|skip|hard no)|the call|not the one|worth it|a go)\b)/i;

/**
 * Order checks for "How's X looking?" answers: context first (what happened, now,
 * what's coming), then "My take:" last.
 * @returns {string[]} issue ids
 */
export function answerOrderIssues(text = '') {
  const t = String(text).trim();
  const out = [];
  const first = t.split(/(?<=[.!?])\s+/)[0] || '';
  if (VERDICT_OPENER.test(first)) out.push('verdict-first');
  const take = t.search(/\bmy take\b/i);
  if (take < 0) out.push('take-missing');
  else if (take < t.length * 0.4) out.push('take-too-early');
  return out;
}

export const isResortLookQuestion = q => /\bhow(?:'|’)?s\b.+\blooking\b|\bhow is\b.+\blooking\b|\bshould i (?:go|ski)\b/i.test(String(q));
