/** Central outbound links: flights, lodging, AI handoff, share URLs, affiliate wrap. */
import { AFFILIATES, affiliateConfigured } from '../public/config.js';
import { addDays } from './util.js';

const enc = encodeURIComponent;

function clamp(n, lo, hi) {
  n = +n;
  if (!Number.isFinite(n)) return lo;
  return Math.min(hi, Math.max(lo, Math.round(n)));
}

export function partyOf(trip) {
  const adults = clamp(trip.adults ?? trip.party ?? 2, 1, 12);
  const kids = clamp(trip.kids ?? 0, 0, 12);
  return { adults, kids, people: adults + kids };
}

export function roomsFor(adults, kids) {
  return Math.max(1, Math.ceil((adults + kids) / 4));
}

export function wrapAffiliate(provider, href) {
  const raw = String(AFFILIATES[provider] || AFFILIATES.travelpayouts || '').trim();
  if (!raw) return { href, sponsored: false };
  if (raw.includes('{url}') || raw.includes('{href}')) {
    return { href: raw.replace(/\{url\}|\{href\}/g, enc(href)), sponsored: true };
  }
  const suffix = raw.startsWith('?') || raw.startsWith('&') ? raw.replace(/^[?&]/, '') : raw;
  return { href: href + (href.includes('?') ? '&' : '?') + suffix, sponsored: true };
}

export function outboundRel(sponsored) {
  return sponsored || affiliateConfigured() ? 'sponsored noopener' : 'noopener';
}

export function outboundHTML(link, extraClass = '') {
  const rel = outboundRel(link.sponsored);
  const cls = extraClass ? ` class="${extraClass}"` : '';
  const primary = link.primary ? ' data-primary="1"' : '';
  return `<a${cls}${primary} href="${link.href.replace(/"/g, '&quot;')}" target="_blank" rel="${rel}">${link.label}</a>`;
}

export function flightLinks({ home = 'SAN', iata, start, end, adults = 2, kids = 0 }) {
  if (!iata) return [];
  adults = clamp(adults, 1, 12);
  kids = clamp(kids, 0, 12);
  const who = kids ? `${adults} adults and ${kids} children` : `${adults} adults`;
  const skyDate = s => s.replace(/-/g, '').slice(2);
  const kayakParty = kids ? `${adults}adults/${kids}children` : `${adults}adults`;
  const raw = [
    { id: 'googleflights', label: 'Google Flights', primary: true, href: `https://www.google.com/travel/flights?q=${enc(`Flights from ${home} to ${iata} on ${start} through ${end} for ${who}`)}` },
    { id: 'kayak', label: 'Kayak', href: `https://www.kayak.com/flights/${home}-${iata}/${start}/${end}/${kayakParty}` },
    { id: 'skyscanner', label: 'Skyscanner', href: `https://www.skyscanner.com/transport/flights/${home.toLowerCase()}/${iata.toLowerCase()}/${skyDate(start)}/${skyDate(end)}/?adultsv2=${adults}${kids ? `&childrenv2=${kids}` : ''}` },
  ];
  return raw.map(x => ({ ...x, ...wrapAffiliate(x.id, x.href) }));
}

export function lodgingLinks({ name, lat, lon, start, end, adults = 2, kids = 0 }) {
  adults = clamp(adults, 1, 12);
  kids = clamp(kids, 0, 12);
  const q = name || 'ski resort';
  const rooms = roomsFor(adults, kids);
  const ages = Array.from({ length: kids }, () => 'age=8').join('&');
  const bookingKids = kids ? `&group_children=${kids}${ages ? `&${ages}` : ''}` : '';
  const raw = [
    { id: 'booking', label: 'Booking.com', primary: true, href: `https://www.booking.com/searchresults.html?ss=${enc(q)}&latitude=${lat}&longitude=${lon}&checkin=${start}&checkout=${end}&group_adults=${adults}${bookingKids}&no_rooms=${rooms}` },
    { id: 'airbnb', label: 'Airbnb', href: `https://www.airbnb.com/s/homes?query=${enc(q)}&checkin=${start}&checkout=${end}&adults=${adults}${kids ? `&children=${kids}` : ''}` },
    { id: 'vrbo', label: 'VRBO', href: `https://www.vrbo.com/search?destination=${enc(q)}&startDate=${start}&endDate=${end}&adults=${adults}${kids ? `&children=${kids}` : ''}` },
    { id: 'expedia', label: 'Expedia', href: `https://www.expedia.com/Hotel-Search?destination=${enc(q)}&latLong=${lat}%2C${lon}&startDate=${start}&endDate=${end}&adults=${adults}${kids ? `&children=${kids}` : ''}&rooms=${rooms}` },
  ];
  return raw.map(x => ({ ...x, ...wrapAffiliate(x.id, x.href) }));
}

export function aiHandoffLinks(prompt) {
  const q = enc(prompt);
  return {
    chatgpt: { id: 'chatgpt', label: 'Open in ChatGPT', href: `https://chatgpt.com/?q=${q}`, sponsored: false },
    grok: { id: 'grok', label: 'Open in Grok', href: `https://grok.com/?q=${q}`, sponsored: false },
    claude: null,
  };
}

export function parseTripQuery(search = location.search) {
  const q = search instanceof URLSearchParams ? search : new URLSearchParams(search.startsWith('?') ? search : `?${search}`);
  const resort = q.get('resort') || q.get('r') || null;
  const mode = q.get('mode') === 'plan' ? 'plan' : (q.get('mode') === 'explore' || resort ? 'explore' : null);
  const from = q.get('from') || (q.get('when') || '').split(',')[0] || null;
  const to = q.get('to') || (q.get('when') || '').split(',')[1] || from;
  let adults = q.get('adults');
  let kids = q.get('kids');
  const people = q.get('people');
  if (adults == null && kids == null && people != null) {
    const n = clamp(people, 1, 24);
    adults = Math.min(n, 2);
    kids = Math.max(0, n - adults);
  }
  return {
    resort,
    mode,
    from: from && /^\d{4}-\d{2}-\d{2}$/.test(from) ? from : null,
    to: to && /^\d{4}-\d{2}-\d{2}$/.test(to) ? to : null,
    adults: adults != null ? clamp(adults, 1, 12) : null,
    kids: kids != null ? clamp(kids, 0, 12) : null,
    home: q.get('home') ? q.get('home').toUpperCase().replace(/[^A-Z]/g, '').slice(0, 3) : null,
    pass: q.get('pass'),
    q: q.get('q'),
  };
}

export function shareSearch({ resort, from, to, adults, kids, home, mode, pass, region, view, alerts } = {}) {
  const q = new URLSearchParams();
  if (resort) q.set('resort', resort);
  if (from) q.set('from', from);
  if (to) q.set('to', to);
  if (adults != null) q.set('adults', String(adults));
  if (kids != null) q.set('kids', String(kids));
  if (adults != null && kids != null) q.set('people', String(adults + kids));
  if (home) q.set('home', home);
  if (mode && mode !== 'incoming') q.set('mode', mode);
  if (pass && pass !== 'all') q.set('pass', pass);
  if (region) q.set('q', region);
  if (view || mode === 'incoming') q.set('view', view || 'incoming');
  if (alerts) q.set('alerts', String(alerts));
  const s = q.toString();
  return s ? `?${s}` : '';
}

export function shareURL(opts, origin = location.origin + location.pathname) {
  return origin.replace(/\/$/, '/') + shareSearch(opts).replace(/^\?/, '?');
}

export function tripDates(trip, win) {
  const start = trip.start || win.start;
  let end = trip.end || win.end;
  if (end <= start) end = addDays(start, 4);
  return { start, end };
}

export { affiliateConfigured };
