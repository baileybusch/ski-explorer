/**
 * Recurring-report copy from presenting-snow-conditions/SKILL.md short template.
 * Snapshot-only: no live fetch. Inches are model est. unless noted.
 */

function inch(cm) {
  const v = (Number(cm) || 0) / 2.54;
  return (v >= 10 ? Math.round(v) : Math.round(v * 10) / 10) + '″';
}

/** Always a range, never a single number (skill: presenting-snow-conditions). */
export function rangeInches(cm) {
  const n = Number(cm) || 0;
  if (n < 0.5) return '0–1″';
  const lo = (n * 0.8) / 2.54;
  const hi = (n * 1.2) / 2.54;
  const fmt = (v) => (v >= 10 ? String(Math.round(v)) : String(Math.round(v * 10) / 10));
  return `${fmt(lo)}–${fmt(hi)}″`;
}

export function bestForecastDay(fcDays) {
  if (!fcDays?.length) return null;
  let best = fcDays[0];
  for (const d of fcDays) {
    if ((d[1] || 0) > (best[1] || 0)) best = d;
  }
  return best;
}

export function confidenceFromForecast(fcDays) {
  const vals = (fcDays || []).map(d => Number(d[1]) || 0);
  if (!vals.length) return 2;
  const sum = vals.reduce((a, b) => a + b, 0);
  if (sum < 0.5) return 4;
  const max = Math.max(...vals);
  const spread = max > 0 ? (max - Math.min(...vals)) / max : 0;
  if (spread > 0.75) return 3;
  return 3;
}

function weekday(iso) {
  if (!iso) return 'n/a';
  return new Date(iso + 'T12:00').toLocaleDateString('en-US', { weekday: 'long' });
}

/**
 * Short template:
 * [Resort] snow report — [date]
 * Next 72 h: [range] at base / [range] up top ([feel]). Confidence [n]/5.
 * Best day: [day] — [reason].
 * Longer range: [one line, hedged].
 */
export function presentingShortReport(r, { dateLabel, weekly = false } = {}) {
  const next72 = (r.fcDays || []).slice(0, 3).reduce((a, [, v]) => a + (Number(v) || 0), 0);
  const conf = r.confidence || confidenceFromForecast(r.fcDays);
  const best = bestForecastDay((r.fcDays || []).slice(0, 7));
  const feel = r.feel || 'feel unknown without storm liquid';
  const water = r.stormWaterIn != null
    ? ` about ${r.stormWaterIn}″ of water`
    : (r.sweIn != null ? ` pack SWE ${r.sweIn}″ (pillow, not this storm)` : '');
  const reason = best && (best[1] || 0) > 2
    ? `heaviest modeled snow in the window (${inch(best[1])}${water ? ',' + water : ''})`
    : 'quiet stretch — groomers, maybe wind buff';
  return {
    headline: `${r.name} snow report — ${dateLabel}`,
    next72: `Next 72 h: ${rangeInches(next72)} at base / ${rangeInches(next72 * 1.25)} up top (${feel}). Confidence ${conf}/5.`,
    bestDay: `Best day: ${weekday(best?.[0])} — ${reason}.`,
    longer: weekly
      ? `Longer range: next 7 days ${rangeInches(r.fc)} (model est.; a forecast can bust).`
      : `Longer range: next 7 days ${rangeInches(r.fc)} — check back as the run firms up.`,
    last72: `Last 72h ${inch(r.d7)} · last 24h ${inch(r.d24)} (SNWD depth-rise or model est. — not recorded snowfall).`,
  };
}

export function presentingReportCardHtml(r, { rank = 0, weekly = false, dateLabel, site, esc, inch: inchFn }) {
  const fmtIn = inchFn || inch;
  const copy = presentingShortReport(r, { dateLabel, weekly });
  const fc = (r.fcDays || []).slice(0, 7).map(([d, v]) => `<td align="center" style="padding:4px 2px;font-size:11px;color:#8b93a7">${new Date(d + 'T12:00').toLocaleDateString('en-US', { weekday: 'narrow' })}<br><b style="color:${v > 0.5 ? '#d5b3ff' : '#c3c9d6'};font-size:12px">${fmtIn(v)}</b></td>`).join('');
  return `<a href="${site}/?r=${r.id}" style="display:block;text-decoration:none;color:#fff;background:#141a26;border:1px solid #1f2633;border-radius:14px;padding:14px 16px;margin:0 0 10px">
  <div style="font-size:16px;font-weight:700">${rank ? `<span style="color:#8b93a7;font-weight:600">${rank}.</span> ` : ''}${esc(copy.headline)}</div>
  <div style="font-size:13px;line-height:1.55;color:#c3c9d6;margin-top:8px">${esc(copy.next72)}</div>
  <div style="font-size:13px;line-height:1.55;color:#c3c9d6">${esc(copy.bestDay)}</div>
  <div style="font-size:13px;line-height:1.55;color:#c3c9d6">${esc(copy.longer)}</div>
  <div style="font-size:11px;color:#8b93a7;margin-top:8px">${esc(copy.last72)}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:8px"><tr><td style="font-size:12px;color:#8b93a7;white-space:nowrap;padding-right:8px">Next 7d <b style="color:#d5b3ff">${rangeInches(r.fc)}</b> est.</td>${fc}</tr></table>
  </a>`;
}
