/** Gazetteer + resort-name + fuzzy search. No LLM key required. */

function norm(s) {
  return String(s || '').toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
}

function lev(a, b) {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  const m = Array.from({ length: a.length + 1 }, (_, i) => [i]);
  for (let j = 0; j <= b.length; j++) m[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      m[i][j] = Math.min(m[i - 1][j] + 1, m[i][j - 1] + 1, m[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
  }
  return m[a.length][b.length];
}

function hay(r) {
  return norm([r.name, r.state, r.region, r.subregion, r.town, r.country, r.iata, ...(r.aliases || []), ...(r.passes || [])].join(' '));
}

export function scoreText(haystack, q) {
  const h = norm(haystack), nq = norm(q);
  if (!nq) return 0;
  if (h === nq) return 200;
  if (h.startsWith(nq)) return 140;
  if (h.includes(nq)) return 110 - Math.min(20, h.indexOf(nq));
  const words = h.split(' ');
  if (words.some(w => w.startsWith(nq))) return 95;
  if (nq.length >= 3 && words.some(w => w.includes(nq))) return 80;
  if (nq.length >= 4) {
    let best = 99;
    for (const w of words) {
      if (Math.abs(w.length - nq.length) > 2) continue;
      best = Math.min(best, lev(w, nq));
    }
    if (best <= 2) return 70 - best * 10;
  }
  return 0;
}

export function regionMatchesResort(region, r) {
  const m = region.match || {};
  if (m.country && m.country.includes(r.country)) return true;
  if (m.region && m.region.includes(r.region)) return true;
  if (m.subregion && m.subregion.includes(r.subregion)) return true;
  const blob = hay(r);
  return (region.aliases || []).some(a => a.length > 3 && blob.includes(norm(a)));
}

export function searchAll(q, { regions, resorts, passOK }) {
  const nq = norm(q);
  if (!nq) return { regions: regions.slice(0, 8), resorts: resorts.filter(passOK).slice(0, 20) };
  const regs = regions.map(g => ({ g, s: Math.max(scoreText(g.name, nq), ...(g.aliases || []).map(a => scoreText(a, nq))) }))
    .filter(x => x.s > 0).sort((a, b) => b.s - a.s).slice(0, 6).map(x => x.g);
  const res = resorts.filter(passOK).map(r => ({ r, s: scoreText(hay(r), nq) }))
    .filter(x => x.s > 0).sort((a, b) => b.s - a.s).slice(0, 24).map(x => x.r);
  return { regions: regs, resorts: res };
}

export function resortsForRegion(region, resorts, passOK) {
  return resorts.filter(r => passOK(r) && regionMatchesResort(region, r));
}
