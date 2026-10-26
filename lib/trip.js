import { flightLinks, lodgingLinks, aiHandoffLinks, partyOf, tripDates } from './links.js';

const KEY = 'ss_trip';

export function loadTrip() {
  try {
    const t = JSON.parse(localStorage.getItem(KEY) || '{}');
    const adults = Math.min(12, Math.max(1, +(t.adults ?? t.party ?? 2)));
    const kids = Math.min(12, Math.max(0, t.kids == null ? 2 : +t.kids));
    return {
      home: (t.home || 'SAN').toUpperCase().replace(/[^A-Z]/g, '').slice(0, 3) || 'SAN',
      adults,
      kids,
      start: t.start || null,
      end: t.end || null,
      flexMonth: t.flexMonth || null,
      lodging: ['hotel', 'condo', 'any'].includes(t.lodging) ? t.lodging : 'any',
      budget: ['value', 'mid', 'splurge'].includes(t.budget) ? t.budget : 'mid',
    };
  } catch {
    return { home: 'SAN', adults: 2, kids: 2, start: null, end: null, flexMonth: null, lodging: 'any', budget: 'mid' };
  }
}

export function saveTrip(t) {
  localStorage.setItem(KEY, JSON.stringify(t));
}

export { tripDates, partyOf };

export function peopleLabel(trip) {
  const { adults, kids } = partyOf(trip);
  const a = `${adults} adult${adults === 1 ? '' : 's'}`;
  const k = kids ? ` + ${kids} kid${kids === 1 ? '' : 's'}` : '';
  return a + k;
}

export function interestingBlurb(r) {
  const bits = [];
  if (r.town && r.region) bits.push(`${r.town}, ${r.region}`);
  else if (r.region) bits.push(r.region);
  const vert = r.summit && r.base ? r.summit - r.base : null;
  const facts = [];
  if (vert) facts.push(`${Math.round(vert * 3.28084).toLocaleString()} ft of vertical`);
  if (r.runs) facts.push(`${r.runs} runs mapped in OpenSkiMap`);
  if (r.lifts) facts.push(`${r.lifts} lifts`);
  if (facts.length) bits.push(facts.join(', '));
  if (r.iata) bits.push(`nearest airport ${r.iata}`);
  if (!bits.length) return '';
  return bits.join('. ') + '.';
}

export function buildPlan({ resorts, win, trip, snowLabel, links }) {
  const { start, end } = tripDates(trip, win);
  const { adults, kids, people } = partyOf(trip);
  const home = trip.home;
  const names = resorts.map(r => r.name).join(', ');
  const lines = [
    `Plan a ski trip for ${people} people (${adults} adult${adults === 1 ? '' : 's'}${kids ? `, ${kids} child${kids === 1 ? '' : 'ren'}` : ''}) flying from ${home}.`,
    `Dates: ${start} to ${end}.`,
    `Resorts: ${names}.`,
    '',
  ];
  for (const r of resorts) {
    const pass = (r.passes || []).map(p => p.toUpperCase()).join(' + ') || 'no pass';
    const access = r.ikon || r.epic || '';
    lines.push(`- ${r.name} (${r.region || r.state}, ${pass}${access ? `, ${access}` : ''})`);
    if (r.iata) lines.push(`  Airport: ${r.iata}`);
    const blurb = interestingBlurb(r);
    if (blurb) lines.push(`  Facts (OpenSkiMap / listed location only): ${blurb}`);
    if (snowLabel[r.id]) lines.push(`  Snow: ${snowLabel[r.id]}`);
    const fl = flightLinks({ home, iata: r.iata, start, end, adults, kids });
    const ld = lodgingLinks({ name: r.name, lat: r.center[1], lon: r.center[0], start, end, adults, kids });
    if (fl.length) lines.push(`  Flights (Google Flights preferred): ${fl.map(x => x.href).join(' | ')}`);
    if (ld.length) lines.push(`  Lodging: ${ld.map(x => x.href).join(' | ')}`);
    lines.push('');
  }
  lines.push('Please propose a realistic itinerary: flights, lodging area (family-friendly if children are in the party), which days to ski which mountain, backup weather days, and a packing list. Do not invent lift-ticket prices or snow depths — use the outlook above and look up current conditions.');
  if (links?.length) {
    lines.push('', 'Saved links:');
    for (const l of links) lines.push(`- ${l}`);
  }
  return lines.join('\n');
}

export function planHandoffLinks(prompt) {
  const x = aiHandoffLinks(prompt);
  return { chatgpt: x.chatgpt?.href, grok: x.grok?.href, claude: null };
}
