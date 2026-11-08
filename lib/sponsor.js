/**
 * JSON sponsor slot for automated storm alerts and weekly recaps.
 * Edit public/data/sponsor.json (committed, no secrets). Cron reads it once per run.
 * The slot only renders when the file is on, not expired, and the subscriber left
 * "sponsor / partner content" on. Individual emails are never sent to the sponsor.
 */
import { readFileSync } from 'node:fs';

export function readSponsorSlot(now = Date.now()) {
  let raw = {};
  try {
    raw = JSON.parse(readFileSync(new URL('../public/data/sponsor.json', import.meta.url), 'utf8'));
  } catch {
    return { on: false, name: '', line: '', href: '', until: null };
  }
  const until = raw.until ? Date.parse(raw.until) : NaN;
  const expired = Number.isFinite(until) && until < now;
  const href = typeof raw.href === 'string' && /^https:\/\//i.test(raw.href) ? raw.href.slice(0, 300) : '';
  return {
    on: raw.on === true && !expired,
    name: String(raw.name || 'Partner').slice(0, 80),
    line: String(raw.line || '').slice(0, 280),
    href,
    until: raw.until || null,
  };
}

/** Merge subscriber preference with the live JSON slot. Preview forces the slot on with example copy when JSON is off. */
export function emailSponsor(prefs, slot = readSponsorSlot(), { preview = false } = {}) {
  if (preview) return { ...slot, on: true, example: !slot.on };
  return { ...slot, on: prefs?.sponsor === true && slot.on, example: false };
}
