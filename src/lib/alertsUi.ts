import { EMAIL_ALERTS_ENABLED } from '../../public/config.js';

export type AlertsUiMode = 'paused' | 'live' | 'preview';

const PROD_HOSTS = new Set(['skiscope.vercel.app', 'www.skiscope.vercel.app']);

export function alertsUiState(search = typeof location !== 'undefined' ? location.search : '', host = typeof location !== 'undefined' ? location.hostname : ''): { show: boolean; mode: AlertsUiMode } {
  if (EMAIL_ALERTS_ENABLED) return { show: true, mode: 'live' };
  const qs = new URLSearchParams(search.startsWith('?') ? search : `?${search}`);
  const flagged = qs.get('alerts') === '1';
  const previewHost = !PROD_HOSTS.has(host) && (host.endsWith('.vercel.app') || host === 'localhost' || host === '127.0.0.1');
  if (flagged || previewHost) return { show: true, mode: 'preview' };
  return { show: true, mode: 'paused' };
}

export {
  ALERT_SENSITIVITY,
  DEFAULT_ALERT_MIN_SNOW_IN,
  DEFAULT_ALERT_WINDOW_HOURS,
  DEFAULT_ALERT_SENSITIVITY,
  sensitivityOf,
} from '../../lib/alertDefaults.js';

/** @deprecated Signup no longer asks. Kept for older screenshots / evals. */
export const THRESHOLDS = [
  { id: 6, label: '6″', hint: 'a solid day' },
  { id: 12, label: '12″', hint: 'a real storm' },
  { id: 18, label: '18″', hint: 'a dump' },
];

/** @deprecated Signup no longer asks. Kept for the evaluator. */
export const WINDOWS = [
  { id: 24, label: '24h' },
  { id: 48, label: '48h' },
  { id: 72, label: '72h' },
  { id: 168, label: '7d' },
];

export function withAlerts(path: string) {
  if (typeof location === 'undefined') return path;
  const flagged = new URLSearchParams(location.search).get('alerts') === '1';
  if (!flagged) return path;
  const [p, hash] = path.split('#');
  const joiner = p.includes('?') ? '&' : '?';
  return `${p}${joiner}alerts=1${hash ? `#${hash}` : ''}`;
}

export const FREQS = [
  { id: 'on-trigger', label: 'On trigger' },
  { id: 'weekly', label: 'Weekly' },
];
