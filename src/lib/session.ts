import { defaultPrefs, normalizePrefs } from '../../lib/accountPrefs.js';

const SESSION = 'ss_session';
const PREFS = 'ss_account_prefs';

export function sessionEmail(): string {
  try { return localStorage.getItem(SESSION) || ''; } catch { return ''; }
}

export function setSession(email: string) {
  const addr = email.trim().toLowerCase();
  localStorage.setItem(SESSION, addr);
}

export function clearSession() {
  localStorage.removeItem(SESSION);
}

export function loadPrefs() {
  try {
    return normalizePrefs(JSON.parse(localStorage.getItem(PREFS) || '{}'));
  } catch {
    return defaultPrefs();
  }
}

export function savePrefs(p: ReturnType<typeof normalizePrefs>) {
  localStorage.setItem(PREFS, JSON.stringify(normalizePrefs(p)));
}
