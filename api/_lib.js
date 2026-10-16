import { put, get, del, list } from '@vercel/blob';
import crypto from 'node:crypto';

export const SITE = process.env.SITE_URL || 'https://skiscope.vercel.app';
const A = { access: 'private' };

// ---------- storage (Vercel Blob, private store) ----------
// subs/<token>.json   -> { token, email, resorts[], status: 'pending'|'active', created, confirmed }
// emails/<sha256>.json -> { token }   (dedupe index)
const ehash = e => crypto.createHash('sha256').update(e.toLowerCase().trim()).digest('hex');
async function readJSON(path) {
  const r = await get(path, { ...A, useCache: false }).catch(() => null);
  if (!r || !r.stream) return null;
  return JSON.parse(await new Response(r.stream).text());
}
const writeJSON = (path, obj) => put(path, JSON.stringify(obj), { ...A, addRandomSuffix: false, allowOverwrite: true, contentType: 'application/json' });
export const getSub = token => /^[a-f0-9]{32}$/.test(token || '') ? readJSON(`subs/${token}.json`) : null;
export const saveSub = sub => writeJSON(`subs/${sub.token}.json`, sub);
export async function findByEmail(email) { const i = await readJSON(`emails/${ehash(email)}.json`); return i ? getSub(i.token) : null; }
export async function createSub(email, resorts) {
  const sub = { token: crypto.randomBytes(16).toString('hex'), email: email.toLowerCase().trim(), resorts, status: 'pending', created: new Date().toISOString() };
  await saveSub(sub); await writeJSON(`emails/${ehash(email)}.json`, { token: sub.token });
  return sub;
}
export async function deleteSub(sub) { await del([`subs/${sub.token}.json`, `emails/${ehash(sub.email)}.json`]).catch(() => {}); }
export async function allActive() {
  const out = []; let cursor;
  do {
    const r = await list({ prefix: 'subs/', cursor, limit: 1000 }); cursor = r.cursor;
    for (const b of r.blobs) { const s = await readJSON(b.pathname); if (s?.status === 'active') out.push(s); }
  } while (cursor);
  return out;
}

// ---------- data ----------
export async function loadData() {
  const [idx, snow] = await Promise.all(['resorts-index.json', 'snow.json'].map(f => fetch(`${SITE}/data/${f}`).then(r => r.json())));
  const t = snow.today, D = snow.dates.length;
  const resorts = idx.map(r => {
    const sf = snow.resorts[r.id]?.sf || [];
    const sum = (a, b) => sf.slice(Math.max(0, a), b).reduce((x, y) => x + y, 0);
    return { ...r, d24: sf[t - 1] || 0, d7: sum(t - 6, t + 1), fc: sum(t + 1, D), fcDays: sf.slice(t + 1).map((v, i) => [snow.dates[t + 1 + i], v]) };
  });
  return { resorts, byId: Object.fromEntries(resorts.map(r => [r.id, r])), date: snow.dates[t], generated: snow.generated };
}
export const isEmail = e => typeof e === 'string' && e.length < 200 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);

// ---------- email ----------
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const inch = cm => { const v = cm / 2.54; return (v >= 10 ? Math.round(v) : Math.round(v * 10) / 10) + '″'; };
export const emailConfigured = () => !!process.env.RESEND_API_KEY;
export async function sendEmail({ to, subject, html, unsubscribeUrl }) {
  if (!process.env.RESEND_API_KEY) return { skipped: 'RESEND_API_KEY not set' };
  const headers = unsubscribeUrl ? { 'List-Unsubscribe': `<${unsubscribeUrl}>`, 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click' } : undefined;
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST', headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: process.env.RESEND_FROM || 'SkiScope <onboarding@resend.dev>', to: [to], subject, html, headers }),
  });
  return { status: r.status, body: await r.json().catch(() => null) };
}
const shell = (title, inner, footer) => `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="dark light"><title>${esc(title)}</title>
<style>@media (max-width:520px){.wrap{padding:18px 12px!important}.big{font-size:22px!important}.col{display:block!important;width:100%!important}}</style></head>
<body style="margin:0;background:#0b0f17;font-family:Inter,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#fff">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0b0f17"><tr><td align="center">
<div class="wrap" style="max-width:600px;margin:0 auto;padding:28px 20px">
<div style="font-size:18px;font-weight:800;letter-spacing:-.01em;margin-bottom:18px">❄ SkiScope</div>
${inner}
<div style="margin-top:28px;padding-top:16px;border-top:1px solid #1f2633;font-size:12px;line-height:1.6;color:#8b93a7">${footer}</div>
</div></td></tr></table></body></html>`;
export function confirmEmail(sub) {
  const url = `${SITE}/api/confirm?token=${sub.token}`;
  return shell('Confirm your SkiScope alerts', `<div class="big" style="font-size:26px;font-weight:800;margin-bottom:8px">Confirm your snow alerts</div>
  <p style="color:#c3c9d6;font-size:15px;line-height:1.6">Tap below to start a daily digest of fresh snow at the resorts you follow. If you didn't ask for this, just ignore this email.</p>
  <a href="${url}" style="display:inline-block;margin-top:10px;background:#fff;color:#0b0f17;text-decoration:none;font-weight:700;padding:14px 22px;border-radius:12px">Confirm subscription</a>`,
  `You'll get nothing else unless you confirm.`);
}
function resortCard(r, rank) {
  const fc = r.fcDays.slice(0, 7).map(([d, v]) => `<td align="center" style="padding:4px 2px;font-size:11px;color:#8b93a7">${new Date(d + 'T12:00').toLocaleDateString('en-US', { weekday: 'narrow' })}<br><b style="color:${v > 0.5 ? '#d5b3ff' : '#c3c9d6'};font-size:12px">${inch(v)}</b></td>`).join('');
  return `<a href="${SITE}/?r=${r.id}" style="display:block;text-decoration:none;color:#fff;background:#141a26;border:1px solid #1f2633;border-radius:14px;padding:14px 16px;margin:0 0 10px">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
    <td style="font-size:16px;font-weight:700">${rank ? `<span style="color:#8b93a7;font-weight:600">${rank}.</span> ` : ''}${esc(r.name)} <span style="font-size:12px;color:#8b93a7;font-weight:500">${esc(r.state)}</span></td>
    <td align="right" style="white-space:nowrap"><span style="font-size:20px;font-weight:800">${inch(r.d24)}</span><span style="font-size:11px;color:#8b93a7"> 24h</span> &nbsp;<span style="font-size:20px;font-weight:800">${inch(r.d7)}</span><span style="font-size:11px;color:#8b93a7"> 7d</span></td>
  </tr></table>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:8px"><tr><td style="font-size:12px;color:#8b93a7;white-space:nowrap;padding-right:8px">Next 7d <b style="color:#d5b3ff">${inch(r.fc)}</b></td>${fc}</tr></table>
  </a>`;
}
export function digestEmail({ data, followIds, token }) {
  const followed = followIds.map(id => data.byId[id]).filter(Boolean);
  const top = [...data.resorts].sort((a, b) => b.d7 - a.d7).slice(0, 10);
  const unsub = token ? `${SITE}/api/unsubscribe?token=${token}` : `${SITE}/alerts`;
  const manage = token ? `${SITE}/alerts?token=${token}` : `${SITE}/alerts`;
  const date = new Date(data.date + 'T12:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
  const subject = followed.length ? `❄ ${followed.map(r => `${r.name.split(' (')[0]} ${inch(r.d24)}`).slice(0, 3).join(' · ')} — SkiScope daily` : 'SkiScope daily snow report';
  const html = shell(subject, `<div style="font-size:13px;color:#8b93a7;margin-bottom:4px">${date}</div>
  <div class="big" style="font-size:26px;font-weight:800;margin-bottom:16px">Your snow report</div>
  ${followed.length ? `<div style="font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:#8b93a7;font-weight:600;margin:6px 0 10px">Resorts you follow</div>${followed.map(r => resortCard(r)).join('')}` : ''}
  <div style="font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:#8b93a7;font-weight:600;margin:22px 0 10px">Top 10 · most snow last 7 days</div>
  ${top.map((r, i) => resortCard(r, i + 1)).join('')}
  <a href="${SITE}" style="display:block;text-align:center;margin-top:16px;background:#fff;color:#0b0f17;text-decoration:none;font-weight:700;padding:14px;border-radius:12px">Open SkiScope 3D map</a>`,
  `Modeled snowfall from Open-Meteo (NOAA GFS/HRRR, ECMWF); not resort-reported. <br>
  <a href="${manage}" style="color:#c3c9d6">Manage resorts</a> · <a href="${unsub}" style="color:#c3c9d6">Unsubscribe with one click</a>`);
  return { subject, html, unsubscribeUrl: unsub };
}
export const page = (title, body) => `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)}</title></head>
<body style="margin:0;min-height:100vh;display:grid;place-items:center;background:#0b0f17;color:#fff;font:17px/1.5 Inter,-apple-system,system-ui,sans-serif;padding:24px"><div style="max-width:420px;text-align:center">${body}<p><a href="/" style="color:#7cc4ff">Back to SkiScope</a></p></div></body></html>`;
export async function body(req) { if (req.body && typeof req.body === 'object') return req.body; try { return JSON.parse(req.body || '{}'); } catch { return {}; } }
