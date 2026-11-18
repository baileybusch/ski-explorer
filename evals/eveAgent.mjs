/**
 * Deterministic checks for the eve tool layer (no LLM).
 */
import { readFileSync } from 'node:fs';
import { getTrending, getResortConditions, compareResorts, lookupUnknownResort, powderFlag } from '../lib/eve/skiTools.js';
import { startReportSubscription, CONSENT_VERSION } from '../lib/eve/subscribeReport.js';
import { EMAIL_ALERTS_ENABLED } from '../public/config.js';

export async function runEveAgentEvals() {
  const lines = [];
  let fail = 0;
  function check(id, ok, detail = '') {
    if (ok) lines.push(`ok    ${id}`);
    else {
      fail++;
      lines.push(`FAIL  ${id}  ${detail}`);
    }
  }

  const trending = getTrending({ sort: 'actual72h', limit: 2 });
  check('trending-rank', trending.ok && trending.data?.kind === 'rank' && trending.data.rows.length === 2, trending.text);
  check('trending-label', trending.data.sortLabel === 'Last 72h', trending.data.sortLabel);
  check('trending-honesty', trending.data.honesty?.last72IsNotRecordedSnowfall === true);

  const alta = getResortConditions({ resort: 'alta' });
  check('alta-found', alta.ok && alta.data.found, alta.text);
  check('alta-not-snowfall', alta.data.isRecordedSnowfall === false);
  check('alta-powder-basis', /depth-rise|heuristic/i.test(alta.data.powder?.basis || ''));
  check('alta-base-label', /pillow|not new snow/i.test(alta.data.baseDepth?.label || ''));
  check('powder-24', powderFlag({ actual24In: 7, actual72In: 2 }).flagged === true);

  const cmp = compareResorts({ ids: ['alta', 'snowbird'] });
  check('compare-two', cmp.ok && cmp.data.kind === 'compare' && cmp.data.rows.length === 2, String(cmp.data.rows?.length));

  const web = await lookupUnknownResort({ query: 'Mount Fakerton Glacier' }, (url) => {
    if (String(url).includes('geocoding')) {
      return Promise.resolve({ json: async () => ({ results: [{ name: 'Mount Fakerton', latitude: 46.8, longitude: -121.7, admin1: 'Washington', country: 'United States', elevation: 3286 }] }) });
    }
    return Promise.resolve({ json: async () => ({ daily: { time: ['2026-11-19'], snowfall_sum: [12] } }) });
  });
  check('web-lookup-kind', web.ok && web.data.kind === 'web-lookup' && web.data.labeled === true, web.text);
  check('web-lookup-source', /web.?lookup/i.test(web.data.source || ''), web.data.source);
  check('web-lookup-not-obs', web.data.isRecordedSnowfall === false);

  const skill = readFileSync(new URL('../agent/skills/present-snow/SKILL.md', import.meta.url), 'utf8');
  check('skill-present-snow', /not recorded snowfall/i.test(skill) && /powder/i.test(skill));
  check('persona', /not recorded snowfall/i.test(readFileSync(new URL('../agent/instructions.md', import.meta.url), 'utf8')));
  check('consent-version', CONSENT_VERSION === 'ss-consent-4');

  const paused = await startReportSubscription({ email: 'someone@example.com', resorts: ['alta'], freq: 'weekly' });
  check('sub-paused-or-gated', EMAIL_ALERTS_ENABLED || paused.paused === true, JSON.stringify(paused));
  check('sub-no-write-when-paused', EMAIL_ALERTS_ENABLED || paused.wrote !== true);

  return { fail, total: lines.length, lines };
}
