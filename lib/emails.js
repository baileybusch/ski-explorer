/**
 * Storm-alert and weekly-recap emails. HTML + plain text.
 * Slate / paper / ink — same monochrome as the board. Big numbers, block cards.
 * Every email includes manage-preferences + one-click unsubscribe.
 * At most two outbound buttons, both via lib/links.js.
 */
import { SITE } from './site.js';
import { flightLinks, lodgingLinks, shareSearch, outboundRel } from './links.js';
import { addDays } from './util.js';

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

export function manageUrl(token) {
  return token ? `${origin()}/alerts?token=${token}` : `${origin()}/alerts`;
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

function blockCard({ rank, name, region, inches, caption, href, strip }) {
  const num = inchLabel(inches);
  return `<a href="${esc(href)}" style="display:block;text-decoration:none;color:${PAPER};background:${SLATE};border:1px solid ${LINE};border-radius:18px;padding:16px 16px 14px;margin:0 0 10px">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
      <td style="vertical-align:top">
        <div style="font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:${GRAPHITE};font-weight:700">${rank ? `#${rank}` : 'Watch'}</div>
        <div style="font-size:20px;font-weight:800;letter-spacing:-.02em;margin-top:2px">${esc(shortName(name))}</div>
        <div style="font-size:12px;color:${GRAPHITE};margin-top:2px">${esc(caption || region || '')}</div>
      </td>
      <td align="right" style="vertical-align:top;white-space:nowrap;padding-left:12px">
        <div style="font-size:42px;line-height:.9;font-weight:800;letter-spacing:-.04em">${num}</div>
      </td>
    </tr></table>
    ${stripHTML(strip)}
  </a>`;
}

function footerHTML(token) {
  const manage = manageUrl(token);
  const unsub = unsubUrl(token);
  return `Modeled Open-Meteo forecast — not resort-reported totals, not typical averages.<br>
  <a href="${esc(manage)}" style="color:${FOG}">Manage preferences</a> · <a href="${esc(unsub)}" style="color:${FOG}">Unsubscribe with one click</a>`;
}

function footerText(token) {
  return `Modeled Open-Meteo forecast — not resort-reported totals.\nManage preferences: ${manageUrl(token)}\nUnsubscribe: ${unsubUrl(token)}`;
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

export function stormAlertEmail({ alert, token, site } = {}) {
  void site;
  const lead = alert.lead || alert.affected?.[0] || {};
  const affected = (alert.affected || [lead]).slice(0, 6);
  const subject = alert.subject || `Storm incoming: ${shortName(lead.resortName)} ${Math.round(lead.snowIn || 0)}"`;
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
    inches: row.snowIn,
    caption: startCaption(row),
    href: deepExplore(row.resortId),
    strip: row.strip,
  })).join('');

  const buttons = [
    btn(inbound, inboundLabel, true),
    ...outbound.map(l => `<div style="height:8px"></div>${outboundBtn(l)}`),
  ].join('');

  const html = emailShell(subject, `
    <div style="font-size:13px;color:${GRAPHITE};margin-bottom:6px">Dump alert · modeled forecast</div>
    <div class="hero" style="font-size:40px;line-height:.95;font-weight:800;letter-spacing:-.04em;margin:0 0 8px">${esc(shortName(lead.resortName))} ${esc(inchLabel(lead.snowIn))}</div>
    <div style="font-size:15px;color:${FOG};margin-bottom:20px">${esc(startCaption(lead))}. Ranked by forecast snow in your window.</div>
    ${cards}
    <div style="margin-top:18px">${buttons}</div>
  `, footerHTML(token));

  const textLines = [
    subject,
    '',
    `${shortName(lead.resortName)} ${inchLabel(lead.snowIn)} — ${startCaption(lead)}`,
    '',
    'Top resorts affected (modeled):',
    ...affected.map((row, i) => `${i + 1}. ${shortName(row.resortName)}  ${inchLabel(row.snowIn)}  ${startCaption(row)}${row.strip?.length ? `\n   ${stripText(row.strip)}` : ''}`),
    '',
    `${inboundLabel}: ${inbound}`,
    ...outbound.map(l => `${l.label}: ${l.href}`),
    '',
    footerText(token),
  ];

  return { subject, html, text: textLines.join('\n'), unsubscribeUrl: unsubUrl(token) };
}

export function recapEmail({ recent = [], incoming = [], token, kind = 'weekly' } = {}) {
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
    inches: row.recentIn,
    caption: 'last 7 days · modeled',
    href: deepExplore(row.id),
    strip: row.strip,
  })).join('');

  const incomingCards = incoming.slice(0, 5).map((row, i) => blockCard({
    rank: i + 1,
    name: row.name,
    region: row.region,
    inches: row.incomingIn,
    caption: 'next 7 days · modeled',
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
    <div style="margin-top:18px">${btn(board, 'Open the board', true)}<div style="height:8px"></div>${btn(incomingUrl, 'Incoming storms', false)}</div>
  `, footerHTML(token));

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
    footerText(token),
  ].join('\n');

  return { subject, html, text, unsubscribeUrl: unsubUrl(token) };
}
