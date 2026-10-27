/** Local preview rules. Nothing here is emailed or written to Blob. */
import { DEFAULT_ALERT_MIN_SNOW_IN, DEFAULT_ALERT_WINDOW_HOURS } from '../../lib/alertDefaults.js';

export type LocalRule = {
  id: string;
  email?: string;
  type?: 'resort' | 'region' | 'trip';
  watch: 'resort' | 'saved' | 'region' | 'pass';
  pass?: string | null;
  region?: string | null;
  regionScope?: 'all' | 'subset';
  tripStart?: string | null;
  tripEnd?: string | null;
  resorts?: string[];
  savedResorts?: string[];
  minSnowIn: number;
  windowHours: number;
  quietStart: string;
  quietEnd: string;
  freq: 'on-trigger' | 'weekly';
  recap: boolean;
  paused: boolean;
};

const KEY = 'ss_alert_rules';
const EMAIL_KEY = 'ss_email';

export function accountEmail(): string {
  try { return localStorage.getItem(EMAIL_KEY) || ''; } catch { return ''; }
}

export function setAccountEmail(email: string) {
  localStorage.setItem(EMAIL_KEY, email.trim().toLowerCase());
}

export function signOutAccount() {
  localStorage.removeItem(EMAIL_KEY);
}

export function loadRules(): LocalRule[] {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || '[]');
    return Array.isArray(raw) ? raw : [];
  } catch {
    return [];
  }
}

export function saveRules(rules: LocalRule[]) {
  localStorage.setItem(KEY, JSON.stringify(rules.slice(0, 20)));
}

export function addLocalRule(partial: Partial<LocalRule>): LocalRule {
  const rule: LocalRule = {
    id: partial.id || `loc_${Math.random().toString(36).slice(2, 10)}`,
    email: partial.email || accountEmail(),
    type: partial.type || (partial.region ? 'region' : 'resort'),
    watch: (partial.watch as LocalRule['watch']) || 'pass',
    pass: partial.pass || 'both',
    region: partial.region || null,
    regionScope: partial.regionScope || 'all',
    tripStart: partial.tripStart || null,
    tripEnd: partial.tripEnd || null,
    resorts: partial.resorts || [],
    savedResorts: partial.savedResorts || [],
    minSnowIn: partial.minSnowIn || DEFAULT_ALERT_MIN_SNOW_IN,
    windowHours: partial.windowHours || DEFAULT_ALERT_WINDOW_HOURS,
    quietStart: partial.quietStart || '21:00',
    quietEnd: partial.quietEnd || '07:00',
    freq: partial.freq === 'weekly' ? 'weekly' : 'on-trigger',
    recap: partial.recap !== false,
    paused: !!partial.paused,
  };
  saveRules([rule, ...loadRules().filter(r => r.id !== rule.id)]);
  return rule;
}

export function updateLocalRule(id: string, patch: Partial<LocalRule>) {
  saveRules(loadRules().map(r => (r.id === id ? { ...r, ...patch, id } : r)));
}

export function deleteLocalRule(id: string) {
  saveRules(loadRules().filter(r => r.id !== id));
}

export function ruleSummary(rule: LocalRule, names: { id: string; name: string }[] = []) {
  if (rule.type === 'trip') {
    const who = (rule.resorts || []).map(id => names.find(n => n.id === id)?.name || id).join(', ') || 'a trip';
    return `Trip · ${who}${rule.tripStart ? ` ${rule.tripStart}` : ''}`;
  }
  if (rule.type === 'region' || rule.watch === 'region') {
    return `Region · ${rule.region || 'a region'}${rule.regionScope === 'subset' ? ' (subset)' : ''}`;
  }
  const where = rule.watch === 'resort'
    ? (rule.resorts || []).map(id => names.find(n => n.id === id)?.name || id).join(', ') || 'a resort'
    : rule.watch === 'saved'
      ? 'saved resorts'
      : rule.pass === 'ikon' ? 'Ikon' : rule.pass === 'epic' ? 'Epic' : 'Ikon + Epic';
  return rule.type === 'resort' ? `Resort · ${where}` : where;
}
