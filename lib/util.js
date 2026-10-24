export const $ = s => document.querySelector(s);
export const $$ = s => [...document.querySelectorAll(s)];
export const IN = cm => cm / 2.54;
export const FT = m => m * 3.28084;
export const C2F = c => c * 9 / 5 + 32;
export const fmtIn = cm => { const v = IN(cm); return v >= 10 ? Math.round(v) : (Math.round(v * 10) / 10); };
export const fmtFt = m => m == null ? '—' : Math.round(FT(m)).toLocaleString();
export const isDesk = () => matchMedia('(min-width:900px)').matches;
export const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const iso = d => (d instanceof Date ? d : new Date(d + 'T12:00')).toISOString().slice(0, 10);
export const addDays = (isoDate, n) => {
  const d = new Date(isoDate + 'T12:00');
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
};
export const parseISO = s => new Date(s + 'T12:00');
export const fmtShort = s => parseISO(s).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
export const fmtLong = s => parseISO(s).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
