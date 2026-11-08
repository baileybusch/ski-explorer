/**
 * Storm-alert and weekly-recap emails. HTML + plain text.
 * Slate / paper / ink — same monochrome as the board. Big numbers, block cards.
 * Every email includes manage-preferences + one-click unsubscribe.
 * At most two outbound buttons, both via lib/links.js.
 */
import { SITE } from './site.js';
import { flightLinks, lodgingLinks, shareSearch, outboundRel } from './links.js';
import { addDays } from './util.js';
import { signAuthToken } from './authToken.js';

const INK = '#08090b';
const SLATE = '#16181c';
const PAPER = '#f2f3f5';
const FOG = '#c8ccd3';
const GRAPHITE = '#7a808a';
const LINE = 'rgba(242,243,245,.12)';

const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

export function inchLabel(n) {
  const v = Number(n) || 0;
  const shown = v >= 10 ? Math.round(v) : Math.round(v * 10) / 10;
  return `${shown}″`;
}

function weekdayShort(iso) {
  if (!iso) return '';
  return new Date(iso + 'T12:00:00Z').toLocaleDateString('en-US', { weekday: 'short', timeZone: 'UTC' });
}

function shortName(name) {
  return String(name || '').split(' (')[0];
}

function origin() {
  return (SITE || 'https://skiscope.vercel.app').replace(/\/$/, '');
}

export function manageUrl(token, email) {
  void token;
  try {
    if (email) {
      const signed = signAuthToken({ email, purpose: 'manage' });
      return `${origin()}/manage?token=${encodeURIComponent(signed)}`;
    }
  } catch { /* preview renders have no AUTH_TOKEN_SECRET */ }
  return `${origin()}/manage`;
}

export function unsubUrl(token) {
  return token ? `${origin()}/api/unsubscribe?token=${token}` : `${origin()}/alerts`;
}

export function boardUrl({ view, resort, mode } = {}) {
  return origin() + '/' + shareSearch({ view, resort, mode });
}

function deepExplore(resortId) {
  return origin() + '/' + shareSearch({ resort: resortId, mode: 'explore' });
}

function outboundPair(resort = {}) {
  const start = resort.startDay || new Date().toISOString().slice(0, 10);
  const end = addDays(start, 3);
  const flights = flightLinks({
    home: 'SAN',
    iata: resort.iata,
    start,
    end,
    adults: 2,
    kids: 2,
  }).filter(l => l.primary || l.id === 'googleflights').slice(0, 1);
  const stays = lodgingLinks({
    name: resort.name || resort.resortName,
    lat: resort.center?.[1],
    lon: resort.center?.[0],
    start,
    end,
    adults: 2,
    kids: 2,
  }).filter(l => l.primary || l.id === 'booking').slice(0, 1);
  return [...flights, ...stays].slice(0, 2);
}

function btn(href, label, fill) {
  const bg = fill ? PAPER : SLATE;
  const color = fill ? INK : PAPER;
  const border = fill ? PAPER : LINE;
  return `<a href="${esc(href)}" style="display:block;text-align:center;text-decoration:none;font-weight:700;font-size:15px;letter-spacing:.01em;padding:14px 16px;border-radius:14px;background:${bg};color:${color};border:1px solid ${border}">${esc(label)}</a>`;
}

function outboundBtn(link) {
  const rel = outboundRel(link.sponsored);
  return `<a href="${esc(link.href)}" target="_blank" rel="${rel}" style="display:block;text-align:center;text-decoration:none;font-weight:700;font-size:15px;padding:14px 16px;border-radius:14px;background:${SLATE};color:${PAPER};border:1px solid ${LINE}">${esc(link.label)}</a>`;
}

function stripHTML(strip = []) {
  if (!strip.length) return '';
  const cells = strip.slice(0, 7).map(d => {
    const n = inchLabel(d.in);
    const day = weekdayShort(d.date).slice(0, 2);
    const hot = (d.in || 0) >= 1;
    return `<td align="center" style="padding:6px 4px;font-size:11px;color:${GRAPHITE};width:14%">${esc(day)}<br><b style="color:${hot ? PAPER : GRAPHITE};font-size:13px;font-weight:800">${n}</b></td>`;
  }).join('');
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:10px"><tr>${cells}</tr></table>`;
}

function stripText(strip = []) {
  return strip.slice(0, 7).map(d => `${weekdayShort(d.date).slice(0, 2)} ${inchLabel(d.in)}`).join('  ');
}

function blockCard({ rank, name, region, pastIn, forecastIn, inches, caption, pastLabel, href, strip }) {
  const actual = pastIn != null ? pastIn : inches;
  const num = inchLabel(actual);
  const fallen = pastLabel || 'last 72h';
  const chip = forecastIn != null
    ? `<div style="display:inline-block;margin-top:8px;padding:5px 9px;border-radius:999px;background:#8fa6ba;color:${INK};font-size:11px;font-weight:800">+${esc(inchLabel(forecastIn))} coming</div>`
    : '';
  return `<a href="${esc(href)}" style="display:block;text-decoration:none;color:${PAPER};background:${SLATE};border:1px solid ${LINE};border-radius:18px;padding:16px 16px 14px;margin:0 0 10px">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
      <td style="vertical-align:top">
        <div style="font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:${GRAPHITE};font-weight:700">${rank ? `#${rank}` : 'Watch'}</div>
        <div style="font-size:20px;font-weight:800;letter-spacing:-.02em;margin-top:2px">${esc(shortName(name))}</div>
        <div style="font-size:12px;color:${GRAPHITE};margin-top:2px">${esc(caption || `${fallen} · fallen`)}</div>
        ${chip}
      </td>
      <td align="right" style="vertical-align:top;white-space:nowrap;padding-left:12px">
        <div style="font-size:42px;line-height:.9;font-weight:800;letter-spacing:-.04em">${num}</div>
        <div style="font-size:11px;color:${GRAPHITE};margin-top:4px">${esc(fallen)}</div>
      </td>
    </tr></table>
    ${stripHTML(strip)}
  </a>`;
}

function footerHTML(token, email) {
  const manage = manageUrl(token, email);
  const unsub = unsubUrl(token);
  return `Modeled Open-Meteo forecast — not resort-reported totals, not typical averages.<br>
  <a href="${esc(manage)}" style="color:${FOG}">Manage preferences</a> · <a href="${esc(unsub)}" style="color:${FOG}">Unsubscribe with one click</a>`;
}

function footerText(token, email) {
  return `Modeled Open-Meteo forecast — not resort-reported totals.\nManage preferences: ${manageUrl(token, email)}\nUnsubscribe: ${unsubUrl(token)}`;
}

/** Clearly labeled sponsor slot. Off unless prefs.sponsor is on. Preview uses example copy. */
export function sponsorSlot({ on = false, example = false } = {}) {
  if (!on) return { html: '', text: '' };
  const who = example ? 'Example sponsor' : 'Partner';
  const html = `<div data-testid="sponsor-slot" style="margin:18px 0 8px;padding:14px 16px;border-radius:14px;border:1px dashed ${LINE};background:${SLATE}">
    <div style="font-size:10px;letter-spacing:.16em;text-transform:uppercase;color:${GRAPHITE};font-weight:800">Sponsored</div>
    <div style="font-size:16px;font-weight:800;margin-top:6px;color:${PAPER}">${esc(who)}</div>
    <div style="font-size:13px;color:${FOG};margin-top:4px;line-height:1.45">A partner offer would sit here. One sponsor per email. This is not SkiScope editorial.</div>
  </div>`;
  const text = `Sponsored — ${who}\nA partner offer would sit here. One sponsor per email.`;
  return { html, text };
}

export function emailShell(title, inner, footer) {
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="dark"><title>${esc(title)}</title>
<style>@media (max-width:520px){.wrap{padding:20px 14px!important}.hero{font-size:34px!important}}</style></head>
<body style="margin:0;background:${INK};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;color:${PAPER}">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${INK}"><tr><td align="center">
<div class="wrap" style="max-width:560px;margin:0 auto;padding:28px 20px">
<div style="font-size:13px;font-weight:800;letter-spacing:.16em;text-transform:uppercase;color:${GRAPHITE};margin-bottom:18px">SkiScope</div>
${inner}
<div style="margin-top:28px;padding-top:16px;border-top:1px solid ${LINE};font-size:12px;line-height:1.65;color:${GRAPHITE}">${footer}</div>
</div></td></tr></table></body></html>`;
}

function startCaption(row) {
  const start = weekdayShort(row.startDay || row.windowStart);
  const by = weekdayShort(row.byDate || row.windowEnd);
  const bits = [];
  if (start) bits.push(`starts ${start}`);
  if (by && by !== start) bits.push(`by ${by}`);
  bits.push('modeled');
  return bits.join(' · ');
}

function readoutBlock(readout) {
  if (!readout?.text) return { html: '', text: '' };
  const mode = readout.mode === 'llm' ? 'friend note' : 'template note';
  return {
    html: `<div data-testid="readout" data-mode="${esc(readout.mode || 'deterministic')}" style="font-size:16px;line-height:1.45;color:${FOG};margin:0 0 18px">${esc(readout.text)}</div>
      <div style="font-size:11px;color:${GRAPHITE};margin:-10px 0 16px">${esc(mode)}</div>`,
    text: readout.text,
  };
}

export function situationEmail({ alert, readout, token, email, sponsor } = {}) {
  const type = alert?.type || 'resort';
  if (type === 'region') return regionAlertEmail({ alert, readout, token, email, sponsor });
  if (type === 'trip') return tripAlertEmail({ alert, readout, token, email, sponsor });
  return stormAlertEmail({ alert, readout, token, email, sponsor });
}

export function combinedEmail({ pack, readouts = [], token, email, sponsor } = {}) {
  const events = pack?.events || [];
  const subject = pack?.subject || 'Situation detected';
  const notes = events.map((ev, i) => {
    const note = readoutBlock(readouts[i] || ev.readout);
    const lead = ev.lead || {};
    return `<div style="margin:0 0 18px">
      <div style="font-size:13px;color:${GRAPHITE};margin-bottom:6px">${esc(ev.type || 'resort')} · ${esc(ev.headline || ev.subject || '')}</div>
      ${note.html}
      ${lead.resortName ? blockCard({
        name: lead.resortName,
        pastIn: lead.past72In ?? 0,
        forecastIn: lead.snowIn ?? lead.next7In,
        caption: ev.headline,
        href: deepExplore(lead.resortId),
        strip: lead.strip,
      }) : ''}
    </div>`;
  }).join('');
  const html = emailShell(subject, `
    <div style="font-size:13px;color:${GRAPHITE};margin-bottom:6px">Combined situation · ${events.length} watches</div>
    <div class="hero" style="font-size:34px;line-height:1.05;font-weight:800;letter-spacing:-.035em;margin:0 0 18px">${esc(subject)}</div>
    ${notes}
    ${sponsorSlot(sponsor).html}
    <div style="margin-top:18px">${btn(origin() + '/', 'Open the board', true)}</div>
  `, footerHTML(token, email || pack?.email));
  const text = [
    subject, '',
    ...events.map((ev, i) => `${ev.headline || ev.subject}\n${readouts[i]?.text || ev.readout?.text || ''}`),
    '',
    sponsorSlot(sponsor).text,
    footerText(token, email || pack?.email),
  ].join('\n');
  return { subject, html, text, unsubscribeUrl: unsubUrl(token) };
}

export function regionAlertEmail({ alert, readout, token, email, sponsor } = {}) {
  const rows = alert.facts?.rows || alert.affected || [];
  const where = alert.facts?.where || alert.region || 'the region';
  const subject = alert.subject || `Situation detected in ${where}`;
  const note = readoutBlock(readout);
  const cards = rows.slice(0, 6).map((row, i) => blockCard({
    rank: i + 1,
    name: row.name || row.resortName,
    region: row.region,
    pastIn: row.past72 ?? row.past72In ?? 0,
    forecastIn: row.next7 ?? row.next7In ?? row.snowIn,
    caption: `${where} leaderboard`,
    href: deepExplore(row.id || row.resortId),
  })).join('');
  const html = emailShell(subject, `
    <div style="font-size:13px;color:${GRAPHITE};margin-bottom:6px">Region watch · modeled snow</div>
    <div class="hero" style="font-size:40px;line-height:.95;font-weight:800;letter-spacing:-.04em;margin:0 0 12px">${esc(where)}</div>
    ${note.html}
    ${cards}
    ${sponsorSlot(sponsor).html}
    <div style="margin-top:18px">${btn(origin() + '/', 'Open the board', true)}</div>
  `, footerHTML(token, email || alert?.email));
  const text = [subject, '', note.text, '', ...rows.slice(0, 6).map((r, i) => `${i + 1}. ${r.name || r.resortName}`), '', footerText(token, email || alert?.email)].join('\n');
  return { subject, html, text, unsubscribeUrl: unsubUrl(token) };
}

export function tripAlertEmail({ alert, readout, token, email, sponsor } = {}) {
  const name = alert.lead?.resortName || alert.facts?.resort?.name || 'your trip';
  const subject = alert.subject || `Situation detected: ${name} T-${alert.stage}`;
  const note = readoutBlock(readout);
  const explore = deepExplore(alert.resortId || alert.lead?.resortId);
  const html = emailShell(subject, `
    <div style="font-size:13px;color:${GRAPHITE};margin-bottom:6px">Trip watch · T-${esc(alert.stage)} · modeled snow</div>
    <div class="hero" style="font-size:40px;line-height:.95;font-weight:800;letter-spacing:-.04em;margin:0 0 12px">${esc(name)}</div>
    ${note.html}
    ${sponsorSlot(sponsor).html}
    <div style="margin-top:18px">${btn(explore, `Open ${shortName(name)}`, true)}</div>
  `, footerHTML(token, email || alert?.email));
  const text = [subject, '', note.text, '', footerText(token, email || alert?.email)].join('\n');
  return { subject, html, text, unsubscribeUrl: unsubUrl(token) };
}

export function stormAlertEmail({ alert, token, site, email, sponsor, readout } = {}) {
  void site;
  const lead = alert.lead || alert.affected?.[0] || {};
  const affected = (alert.affected || [lead]).slice(0, 6);
  const subject = alert.subject || readout?.subject || `Situation detected: ${shortName(lead.resortName)} just got ${inchLabel(lead.past72In ?? 0)}`;
  const note = readoutBlock(readout);
  const explore = deepExplore(lead.resortId);
  const inbound = affected.length > 1 ? boardUrl({ view: 'incoming' }) : explore;
  const inboundLabel = affected.length > 1 ? 'Incoming storms' : `Open ${shortName(lead.resortName)}`;
  const outbound = outboundPair({
    name: lead.resortName,
    iata: lead.iata,
    center: lead.center,
    startDay: lead.startDay,
  });

  const cards = affected.map((row, i) => blockCard({
    rank: i + 1,
    name: row.resortName,
    region: row.region,
    pastIn: row.past72In ?? 0,
    forecastIn: row.snowIn,
    caption: `${startCaption(row)} · forecast highlighted`,
    href: deepExplore(row.resortId),
    strip: row.strip,
  })).join('');

  const buttons = [
    btn(inbound, inboundLabel, true),
    ...outbound.map(l => `<div style="height:8px"></div>${outboundBtn(l)}`),
  ].join('');

  const html = emailShell(subject, `
    <div style="font-size:13px;color:${GRAPHITE};margin-bottom:6px">Dump alert · modeled forecast</div>
    <div class="hero" style="font-size:40px;line-height:.95;font-weight:800;letter-spacing:-.04em;margin:0 0 8px">${esc(shortName(lead.resortName))} ${esc(inchLabel(lead.past72In ?? 0))} last 72h</div>
    <div style="display:inline-block;margin:0 0 12px;padding:6px 10px;border-radius:999px;background:#8fa6ba;color:${INK};font-size:14px;font-weight:800">+${esc(inchLabel(lead.snowIn))} coming</div>
    <div style="font-size:15px;color:${FOG};margin-bottom:20px">${esc(startCaption(lead))}. Headline is fallen snow. Chip is forecast — never a combined total.</div>
    ${note.html}
    ${cards}
    ${sponsorSlot(sponsor).html}
    <div style="margin-top:18px">${buttons}</div>
  `, footerHTML(token, email || alert?.email));

  const textLines = [
    subject,
    '',
    `${shortName(lead.resortName)} ${inchLabel(lead.past72In ?? 0)} last 72h · +${inchLabel(lead.snowIn)} coming — ${startCaption(lead)}`,
    note.text,
    '',
    'Top resorts affected (modeled; actual then forecast):',
    ...affected.map((row, i) => `${i + 1}. ${shortName(row.resortName)}  ${inchLabel(row.past72In ?? 0)} last 72h  +${inchLabel(row.snowIn)} coming  ${startCaption(row)}${row.strip?.length ? `\n   ${stripText(row.strip)}` : ''}`),
    '',
    `${inboundLabel}: ${inbound}`,
    ...outbound.map(l => `${l.label}: ${l.href}`),
    '',
    sponsorSlot(sponsor).text,
    footerText(token, email || alert?.email),
  ];

  return { subject, html, text: textLines.join('\n'), unsubscribeUrl: unsubUrl(token) };
}

export function recapEmail({ recent = [], incoming = [], token, kind = 'weekly', email, sponsor } = {}) {
  const lead = recent[0] || incoming[0] || {};
  const leadIn = inchLabel(lead.recentIn ?? lead.incomingIn ?? 0);
  const lastStorm = kind === 'last-storm';
  const subject = lastStorm
    ? `Last storm: ${shortName(lead.name) || 'the board'} ${lead.recentIn ? leadIn : ''}`.trim()
    : (lead.name ? `This week: ${shortName(lead.name)} ${leadIn} · storms to watch` : 'This week in snow · storms to watch');
  const board = origin() + '/';
  const incomingUrl = boardUrl({ view: 'incoming' });

  const recentCards = recent.slice(0, 5).map((row, i) => blockCard({
    rank: i + 1,
    name: row.name,
    region: row.region,
    pastIn: row.recentIn,
    forecastIn: row.incomingIn,
    pastLabel: 'last 7d',
    caption: 'last 7 days · fallen',
    href: deepExplore(row.id),
    strip: row.strip,
  })).join('');

  const incomingCards = incoming.slice(0, 5).map((row, i) => blockCard({
    rank: i + 1,
    name: row.name,
    region: row.region,
    pastIn: row.past72In ?? 0,
    forecastIn: row.incomingIn,
    caption: 'last 72h · fallen · forecast chip is next 7 days',
    href: deepExplore(row.id),
    strip: row.strip,
  })).join('');

  const kicker = lastStorm ? 'Last storm recap' : 'Weekly recap';
  const html = emailShell(subject, `
    <div style="font-size:13px;color:${GRAPHITE};margin-bottom:6px">${kicker} · modeled snow</div>
    <div class="hero" style="font-size:34px;line-height:1.05;font-weight:800;letter-spacing:-.035em;margin:0 0 18px">Who got the most snow${lastStorm ? '' : ' this week'} + storms to watch${lastStorm ? '' : ' next week'}</div>
    <div style="font-size:12px;letter-spacing:.12em;text-transform:uppercase;color:${GRAPHITE};font-weight:700;margin:8px 0 10px">Top 5 · recent snow</div>
    ${recentCards || `<p style="color:${GRAPHITE}">Quiet on the last 7 days.</p>`}
    <div style="font-size:12px;letter-spacing:.12em;text-transform:uppercase;color:${GRAPHITE};font-weight:700;margin:22px 0 10px">Top 5 · incoming</div>
    ${incomingCards || `<p style="color:${GRAPHITE}">No modeled storms in the next 7 days.</p>`}
    ${sponsorSlot(sponsor).html}
    <div style="margin-top:18px">${btn(board, 'Open the board', true)}<div style="height:8px"></div>${btn(incomingUrl, 'Incoming storms', false)}</div>
  `, footerHTML(token, email));

  const text = [
    subject,
    '',
    lastStorm ? 'Last storm recap — modeled snow.' : 'Who got the most snow this week + storms to watch next week.',
    '',
    'Top 5 recent (last 7 days):',
    ...recent.slice(0, 5).map((row, i) => `${i + 1}. ${shortName(row.name)}  ${inchLabel(row.recentIn)}`),
    '',
    'Top 5 incoming (next 7 days):',
    ...incoming.slice(0, 5).map((row, i) => `${i + 1}. ${shortName(row.name)}  ${inchLabel(row.incomingIn)}  ${stripText(row.strip || [])}`),
    '',
    `Open the board: ${board}`,
    `Incoming storms: ${incomingUrl}`,
    '',
    sponsorSlot(sponsor).text,
    footerText(token, email),
  ].join('\n');

  return { subject, html, text, unsubscribeUrl: unsubUrl(token) };
}
