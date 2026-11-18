/**
 * Deterministic checks for the eve tool layer (no LLM).
 */
import { readFileSync } from 'node:fs';
import { getTrending, getResortConditions, compareResorts, lookupUnknownResort, powderFlag, parseMeteoExtras } from '../lib/eve/skiTools.js';
import { powderDayCall } from '../lib/eve/powderDayCall.js';
import { presentingShortReport } from '../lib/eve/reportEmail.js';
import { digestEmail } from '../api/_lib.js';
import { startReportSubscription, CONSENT_VERSION } from '../lib/eve/subscribeReport.js';
import { EMAIL_ALERTS_ENABLED } from '../public/config.js';

function skill(name) {
  return readFileSync(new URL(`../agent/skills/${name}/SKILL.md`, import.meta.url), 'utf8');
}

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
  check('alta-water-label', /SWE|liquid/i.test(alta.data.water?.label || ''));
  check('powder-24', powderFlag({ actual24In: 7, actual72In: 2 }).flagged === true);

  const yes = powderDayCall({
    last24In: 10, slr: 14, windSustainedMph: 18, windGustMph: 28, snowLevelFt: 5000, baseFt: 8500,
  });
  check('powder-call-yes', yes.grade === 'powder-day' && yes.flagged === true, JSON.stringify(yes));

  const windy = powderDayCall({
    last24In: 18, slr: 12, windSustainedMph: 50, windGustMph: 72, snowLevelFt: 5000, baseFt: 8500,
  });
  check('powder-call-wind-no', windy.grade === 'no' && windy.windHold === true && windy.flagged === false, JSON.stringify(windy));

  const rain = powderDayCall({
    last24In: 10, slr: 12, windGustMph: 20, snowLevelFt: 10000, baseFt: 7000,
  });
  check('powder-call-snow-level-no', rain.grade === 'no' && rain.rainAtBase === true, JSON.stringify(rain));

  const extras = parseMeteoExtras({
    daily: {
      time: ['2026-11-19'],
      snowfall_sum_gfs_seamless: [20],
      snowfall_sum_ecmwf_ifs025: [10],
      precipitation_sum_gfs_seamless: [10],
      precipitation_sum_ecmwf_ifs025: [8],
      wind_speed_10m_max_gfs_seamless: [40],
      wind_speed_10m_max_ecmwf_ifs025: [30],
      wind_gusts_10m_max_gfs_seamless: [80],
      wind_gusts_10m_max_ecmwf_ifs025: [60],
      wind_direction_10m_dominant_gfs_seamless: [270],
      wind_direction_10m_dominant_ecmwf_ifs025: [260],
    },
    hourly: { freezing_level_height: [1800, 2000] },
  }, { baseM: 2600, summitM: 3200 });
  check('extras-spread', extras.spread.snowCmMin === 10 && extras.spread.snowCmMax === 20, JSON.stringify(extras.spread));
  check('extras-wind-mph', extras.wind.gustMph != null && extras.wind.gustMph > 30 && extras.wind.direction === 'W', JSON.stringify(extras.wind));
  check('extras-snow-level', extras.snowLevel.meanFt != null && extras.snowLevel.meanFt > 5000, JSON.stringify(extras.snowLevel));
  check('extras-slr', extras.next7Slr != null && extras.next7WaterIn != null, JSON.stringify({ slr: extras.next7Slr, water: extras.next7WaterIn }));
  check('extras-estimated', extras.estimated === true);

  const cmp = compareResorts({ ids: ['alta', 'snowbird'] });
  check('compare-two', cmp.ok && cmp.data.kind === 'compare' && cmp.data.rows.length === 2, String(cmp.data.rows?.length));

  const web = await lookupUnknownResort({ query: 'Mount Fakerton Glacier' }, (url) => {
    if (String(url).includes('geocoding')) {
      return Promise.resolve({ json: async () => ({ results: [{ name: 'Mount Fakerton', latitude: 46.8, longitude: -121.7, admin1: 'Washington', country: 'United States', elevation: 3286 }] }) });
    }
    return Promise.resolve({
      json: async () => ({
        daily: {
          time: ['2026-11-19'],
          snowfall_sum: [12],
          precipitation_sum: [8],
          wind_speed_10m_max: [20],
          wind_gusts_10m_max: [35],
          wind_direction_10m_dominant: [180],
        },
        hourly: { freezing_level_height: [1500] },
      }),
    });
  });
  check('web-lookup-kind', web.ok && web.data.kind === 'web-lookup' && web.data.labeled === true, web.text);
  check('web-lookup-source', /web.?lookup/i.test(web.data.source || ''), web.data.source);
  check('web-lookup-not-obs', web.data.isRecordedSnowfall === false);
  check('web-lookup-extras', web.data.wind != null && web.data.water?.stormSlr != null, JSON.stringify(web.data.water));

  const presenting = skill('presenting-snow-conditions');
  const powderSkill = skill('powder-day-call');
  check('skill-presenting-frontmatter', /^---[\s\S]*name: presenting-snow-conditions/m.test(presenting));
  check('skill-presenting-credit', /mammothsnowman|Ted Schlaepfer|Steve Taylor/i.test(presenting));
  check('skill-presenting-email', /Next 72 h:/i.test(presenting) && /Confidence/i.test(presenting));
  check('skill-powder-frontmatter', /^---[\s\S]*name: powder-day-call/m.test(powderSkill));
  check('skill-powder-credit', /mammothsnowman|Ted Schlaepfer/i.test(powderSkill));
  check('skill-reading-quality', /snow-to-liquid|SWE/i.test(skill('reading-snow-quality')));
  check('skill-reading-forecasts', /confidence|model/i.test(skill('reading-forecasts')));
  check('skill-storm-setups', /pattern|setup/i.test(skill('storm-setups-and-patterns')));
  check('persona', /not recorded snowfall/i.test(readFileSync(new URL('../agent/instructions.md', import.meta.url), 'utf8')));
  check('persona-skills', /presenting-snow-conditions/.test(readFileSync(new URL('../agent/instructions.md', import.meta.url), 'utf8')));
  check('consent-version', CONSENT_VERSION === 'ss-consent-4');

  const copy = presentingShortReport({
    name: 'Alta',
    d24: 25,
    d7: 40,
    fc: 30,
    fcDays: [['2026-11-19', 20], ['2026-11-20', 8], ['2026-11-21', 2]],
  }, { dateLabel: 'Wednesday, November 18' });
  check('email-template-next72', /Next 72 h:/i.test(copy.next72) && /Confidence \d\/5/.test(copy.next72), copy.next72);
  check('email-template-best', /^Best day:/i.test(copy.bestDay), copy.bestDay);
  check('email-template-longer', /Longer range:/i.test(copy.longer), copy.longer);

  const altaCard = {
    id: 'alta',
    name: 'Alta',
    state: 'UT',
    d24: 25,
    d7: 40,
    fc: 30,
    fcDays: [['2026-11-19', 20], ['2026-11-20', 8], ['2026-11-21', 2], ['2026-11-22', 0]],
  };
  const digest = digestEmail({
    data: { date: '2026-11-18', generated: 'x', photos: [], resorts: [altaCard], byId: { alta: altaCard } },
    followIds: ['alta'],
    token: null,
    freq: 'daily',
  });
  check('digest-next-72h', /Next 72 h/i.test(digest.html));
  check('digest-confidence', /Confidence \d\/5/i.test(digest.html));
  check('digest-best-day', /Best day:/i.test(digest.html));
  check('digest-not-recorded', /not recorded snowfall/i.test(digest.html));

  const paused = await startReportSubscription({ email: 'someone@example.com', resorts: ['alta'], freq: 'weekly' });
  check('sub-paused-or-gated', EMAIL_ALERTS_ENABLED || paused.paused === true, JSON.stringify(paused));
  check('sub-no-write-when-paused', EMAIL_ALERTS_ENABLED || paused.wrote !== true);

  return { fail, total: lines.length, lines };
}
