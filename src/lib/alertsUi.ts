import { EMAIL_ALERTS_ENABLED } from '../../public/config.js';

export type AlertsUiMode = 'off' | 'live' | 'preview';

const PROD_HOSTS = new Set(['skiscope.vercel.app', 'www.skiscope.vercel.app']);

export function alertsUiState(search = typeof location !== 'undefined' ? location.search : '', host = typeof location !== 'undefined' ? location.hostname : ''): { show: boolean; mode: AlertsUiMode } {
  if (EMAIL_ALERTS_ENABLED) return { show: true, mode: 'live' };
  const qs = new URLSearchParams(search.startsWith('?') ? search : `?${search}`);
  if (qs.get('alerts') !== '1') return { show: false, mode: 'off' };
  if (PROD_HOSTS.has(host)) return { show: false, mode: 'off' };
  const preview = host.endsWith('.vercel.app') || host === 'localhost' || host === '127.0.0.1';
  if (preview) return { show: true, mode: 'preview' };
  return { show: false, mode: 'off' };
}

export const THRESHOLDS = [
  { id: 6, label: '6″' },
  { id: 12, label: '12″' },
  { id: 18, label: '18″' },
];

export const WINDOWS = [
  { id: 24, label: '24h' },
  { id: 48, label: '48h' },
  { id: 72, label: '72h' },
  { id: 168, label: 'Next 7' },
];
