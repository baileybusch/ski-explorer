export type Design = 'a' | 'b';

export function initialDesign(): Design {
  const q = new URLSearchParams(location.search).get('design');
  if (q === 'a' || q === 'b') return q;
  const stored = localStorage.getItem('ss_design');
  if (stored === 'a' || stored === 'b') return stored;
  return 'a';
}

export function persistDesign(d: Design) {
  localStorage.setItem('ss_design', d);
}

export const REGION_CHIPS = [
  'japan', 'colorado', 'utah', 'california', 'canada', 'alps', 'dolomites', 'chile',
];
