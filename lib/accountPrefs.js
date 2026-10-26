/** Account-level email preferences. Default: storms + recap on, sponsor off. */

export const RECAP_DAYS = [
  { id: 'sun', label: 'Sunday' },
  { id: 'sat', label: 'Saturday' },
  { id: 'mon', label: 'Monday' },
  { id: 'fri', label: 'Friday' },
];

export function defaultPrefs() {
  return {
    stormAlerts: true,
    recap: true,
    sponsor: false,
    recapDay: 'sun',
    quietStart: '21:00',
    quietEnd: '07:00',
  };
}

export function normalizePrefs(p = {}) {
  const days = new Set(RECAP_DAYS.map(d => d.id));
  const hhmm = v => /^\d{2}:\d{2}$/.test(v) ? v : null;
  return {
    stormAlerts: p.stormAlerts !== false,
    recap: p.recap !== false,
    sponsor: p.sponsor === true,
    recapDay: days.has(p.recapDay) ? p.recapDay : 'sun',
    quietStart: hhmm(p.quietStart) || '21:00',
    quietEnd: hhmm(p.quietEnd) || '07:00',
  };
}
