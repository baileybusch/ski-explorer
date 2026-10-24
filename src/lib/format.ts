import { fmtIn } from '../../lib/util.js';

export function snowAmount(cm: number, units: 'in' | 'cm') {
  if (cm == null || !Number.isFinite(cm)) return '—';
  return units === 'cm' ? `${Math.round(cm)} cm` : `${fmtIn(cm)}″`;
}

export function passLabel(r: { id?: string; passes?: string[] }) {
  if (r.id === 'eagle-point') return 'Closed';
  const p = r.passes || [];
  if (p.includes('ikon') && p.includes('epic')) return 'Ikon + Epic';
  if (p.includes('ikon')) return 'Ikon';
  if (p.includes('epic')) return 'Epic';
  return '';
}
