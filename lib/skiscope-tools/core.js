/** Pure lookup helpers shared by the Node tool layer and the in-browser Ask fallback. */
import { regionMatchesResort } from '../search.js';

export function findResort(cat, id) {
  const n = String(id || '').toLowerCase();
  return cat.resorts.find(r => r.id === id || r.id === n || r.name.toLowerCase() === n
    || (r.aliases || []).some(a => String(a).toLowerCase() === n)) || null;
}

export function findRegion(cat, id) {
  if (!id) return null;
  const n = String(id).toLowerCase();
  return cat.regions.find(g => g.id === n || g.name.toLowerCase() === n
    || (g.aliases || []).some(a => String(a).toLowerCase() === n)) || null;
}

export function passOK(pass) {
  if (!pass || pass === 'all' || pass === 'both') return () => true;
  return r => (r.passes || []).includes(pass);
}

export function filterResorts(cat, { region, country, state, pass } = {}) {
  let list = cat.resorts.filter(passOK(pass));
  const g = findRegion(cat, region) || findRegion(cat, country) || findRegion(cat, state);
  if (g) list = list.filter(r => regionMatchesResort(g, r));
  else if (country) list = list.filter(r => String(r.country || '').toLowerCase() === String(country).toLowerCase());
  else if (state) {
    const s = String(state).toLowerCase();
    list = list.filter(r => String(r.region || '').toLowerCase() === s || String(r.state || '').toLowerCase() === s);
  }
  return { list, region: g };
}
