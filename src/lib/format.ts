import { fmtIn, C2F, FT } from '../../lib/util.js';

export type SnowUnits = 'in' | 'cm';
export type TempUnits = 'F' | 'C';

export function snowAmount(cm: number, units: SnowUnits) {
  if (cm == null || !Number.isFinite(cm)) return '—';
  return units === 'cm' ? `${Math.round(cm)} cm` : `${fmtIn(cm)}″`;
}

/** Headline label for fallen snow. Never use dump score (past+next) here. */
export function last72Label() {
  return 'last 72h';
}

/** Accent chip for forecast snow. Always prefixed with + so it cannot read as fallen. */
export function forecastComing(cm: number, units: SnowUnits) {
  return `+${snowAmount(cm, units)} coming`;
}

export function tempLabel(c: number | null | undefined, temp: TempUnits = 'F') {
  if (c == null || !Number.isFinite(c)) return '—';
  return temp === 'C' ? `${Math.round(c)}°C` : `${Math.round(C2F(c))}°`;
}

export function windLabel(kmh: number | null | undefined, units: 'in' | 'cm') {
  if (kmh == null || !Number.isFinite(kmh)) return '—';
  return units === 'cm' ? `${Math.round(kmh)} km/h` : `${Math.round(kmh * 0.621371)} mph`;
}

export function fzlLabel(m: number | null | undefined, units: 'in' | 'cm') {
  if (m == null || !Number.isFinite(m)) return '—';
  return units === 'cm' ? `${Math.round(m)} m` : `${Math.round(FT(m)).toLocaleString()} ft`;
}

export function stormBadge(tier: number) {
  if (tier >= 18) return '18″+';
  if (tier >= 12) return '12″+';
  if (tier >= 6) return '6″+';
  return '';
}

export function passLabel(r: { id?: string; passes?: string[] }) {
  if (r.id === 'eagle-point') return 'Closed';
  const p = r.passes || [];
  if (p.includes('ikon') && p.includes('epic')) return 'Ikon + Epic';
  if (p.includes('ikon')) return 'Ikon';
  if (p.includes('epic')) return 'Epic';
  return '';
}
