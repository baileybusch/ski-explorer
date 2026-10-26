/** Account-level email preferences. Default: storms + recap on, sponsor off. */

export const RECAP_DAYS = [
  { id: 'sun', label: 'Sunday' },
  { id: 'sat', label: 'Saturday' },
  { id: 'mon', label: 'Monday' },
  { id: 'fri', label: 'Friday' },
];

export function defaultPrefs() {
  return { stormAlerts: true, recap: true, sponsor: false, recapDay: 'sun' };
}

export function normalizePrefs(p = {}) {
  const days = new Set(RECAP_DAYS.map(d => d.id));
  return {
    stormAlerts: p.stormAlerts !== false,
    recap: p.recap !== false,
    sponsor: p.sponsor === true,
    recapDay: days.has(p.recapDay) ? p.recapDay : 'sun',
  };
}
