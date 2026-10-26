/**
 * Internal alert-rule defaults. Signup never asks for a threshold or window.
 * Preference-center “Alert sensitivity” is the only user-facing control.
 *
 * Standard (default): 6″ in the next 72h — the lowest storm tier, a solid day.
 * Every storm:        6″ in the next 7 days — widest window.
 * Big storms only:    12″ in the next 72h.
 */
export const DEFAULT_ALERT_MIN_SNOW_IN = 6;
export const DEFAULT_ALERT_WINDOW_HOURS = 72;
export const DEFAULT_ALERT_SENSITIVITY = 'standard';

export const ALERT_SENSITIVITY = [
  { id: 'every', label: 'Every storm', hint: '6″ in the next 7 days', minSnowIn: 6, windowHours: 168 },
  { id: 'standard', label: 'Standard', hint: '6″ in the next 72 hours', minSnowIn: 6, windowHours: 72 },
  { id: 'big', label: 'Big storms only', hint: '12″ in the next 72 hours', minSnowIn: 12, windowHours: 72 },
];

export function sensitivityOf(id = DEFAULT_ALERT_SENSITIVITY) {
  return ALERT_SENSITIVITY.find(s => s.id === id) || ALERT_SENSITIVITY.find(s => s.id === DEFAULT_ALERT_SENSITIVITY);
}
