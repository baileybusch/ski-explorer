/** Local preview rules. Nothing here is emailed or written to Blob. */

export type LocalRule = {
  id: string;
  email?: string;
  watch: 'resort' | 'saved' | 'region' | 'pass';
  pass?: string | null;
  region?: string | null;
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
    watch: (partial.watch as LocalRule['watch']) || 'pass',
    pass: partial.pass || 'both',
    region: partial.region || null,
    resorts: partial.resorts || [],
    savedResorts: partial.savedResorts || [],
    minSnowIn: partial.minSnowIn || 12,
    windowHours: partial.windowHours || 72,
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
  const where = rule.watch === 'resort'
    ? (rule.resorts || []).map(id => names.find(n => n.id === id)?.name || id).join(', ') || 'a resort'
    : rule.watch === 'saved'
      ? 'saved resorts'
      : rule.watch === 'region'
        ? (rule.region || 'a region')
        : rule.pass === 'ikon' ? 'Ikon' : rule.pass === 'epic' ? 'Epic' : 'Ikon + Epic';
  const win = rule.windowHours === 168 ? '7d' : `${rule.windowHours}h`;
  return `${rule.minSnowIn}″ / ${win} · ${where}`;
}
