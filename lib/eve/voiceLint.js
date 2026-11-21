/**
 * Deterministic voice checks for chat answers (evals + live preview checks).
 * Mirrors agent/instructions.md: no "depth rise", weekend answers use weekend days
 * only, and no unsupported color.
 */
export const DEPTH_RISE = /depth[-_ ]?rise|\bsnwd\b|peak[-_ ]?rise/i;
export const SEVEN_DAY = /\b(7|seven)[- ]day|next (7|seven) days|over the next week|this week'?s total|coming week/i;
export const UNSUPPORTED_COLOR = /lift[- ]?(lines?|runs?)|crowds?|grooming|groomers|higher[- ]altitude|tree skiing|fresh tracks all day|bluebird/i;

/** @returns {string[]} issue ids */
export function voiceIssues(text = '', { weekend = false } = {}) {
  const t = String(text);
  const out = [];
  if (DEPTH_RISE.test(t)) out.push('depth-rise');
  if (weekend && SEVEN_DAY.test(t)) out.push('weekend-uses-7-day');
  if (UNSUPPORTED_COLOR.test(t)) out.push('unsupported-color');
  return out;
}

export const isWeekendQuestion = q => /\bweekend\b|\bsaturday\b|\bsunday\b/i.test(String(q));
