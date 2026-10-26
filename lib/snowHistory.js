/**
 * Season-to-date vs past seasons from history.json + live snow.json.
 * Season start: Oct 1 (N) / Jul 1 (S). Totals are modeled Open-Meteo snowfall_sum (cm).
 */
import { dumpParts } from './dumpScore.js';

export function seasonStartFor(hemi, asOf) {
  const d = new Date(`${asOf}T12:00:00Z`);
  const y = d.getUTCFullYear();
  const m = d.getUTCMonth() + 1;
  if (hemi === 'S') {
    return m >= 7 ? `${y}-07-01` : `${y - 1}-07-01`;
  }
  return m >= 10 ? `${y}-10-01` : `${y - 1}-10-01`;
}

export function sumSfBetween(sf, dates, start, end) {
  let cm = 0;
  for (let i = 0; i < dates.length; i++) {
    if (dates[i] >= start && dates[i] <= end) cm += sf[i] || 0;
  }
  return cm;
}

export function stormTotalCm(r, snow) {
  const rec = snow?.resorts?.[r.id] || r;
  const sf = rec.sf || r.sf || [];
  const today = snow?.today ?? 0;
  let total = 0;
  let i = today;
  while (i >= 0 && (sf[i] || 0) >= 0.5) {
    total += sf[i] || 0;
    i -= 1;
  }
  if (total < 0.5) {
    for (let k = Math.max(0, today - 2); k <= today; k++) total += sf[k] || 0;
  }
  return total;
}

export function historyFor(r, snow, history) {
  const hemi = r.hemisphere === 'S' ? 'S' : 'N';
  const asOf = snow?.dates?.[snow.today] || history?.asOf;
  const start = seasonStartFor(hemi, asOf);
  const rec = snow?.resorts?.[r.id] || r;
  const sf = rec.sf || r.sf || [];
  const dump = dumpParts(r, snow);
  const current = {
    last24Cm: dumpPartsLast24(sf, snow?.today ?? 0),
    last72Cm: dump.past72Cm,
    stormCm: stormTotalCm(r, snow),
  };
  const stdFromSnow = sumSfBetween(sf, snow?.dates || [], start, asOf);
  const row = history?.resorts?.[r.id] || null;
  const stdCm = row?.currentStdCm != null ? row.currentStdCm : stdFromSnow;
  const same = row?.sameDate || [];
  const avg = same.length ? same.reduce((a, b) => a + (b.cm || 0), 0) / same.length : null;
  let verdict = '';
  if (avg != null && avg > 0.4) {
    const pct = Math.round(((stdCm - avg) / avg) * 100);
    const when = new Date(`${asOf}T12:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
    const dir = pct >= 0 ? 'above' : 'below';
    verdict = `Running ${Math.abs(pct)}% ${dir} the ${same.length}-season average for ${when}.`;
  } else if (!row) {
    verdict = 'Past-season comparison is not cached for this mountain yet.';
  } else {
    verdict = 'Too little snow so far to compare to past seasons.';
  }
  return {
    hemi,
    asOf,
    start,
    current,
    stdCm,
    sameDate: same,
    fullSeasons: row?.fullSeasons || [],
    avgSameDateCm: avg,
    verdict,
    hasArchive: !!row,
  };
}

function dumpPartsLast24(sf, today) {
  return sf[today] || 0;
}
