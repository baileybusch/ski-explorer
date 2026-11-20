/**
 * Deterministic checks for the eve tool layer (no LLM).
 */
import { readFileSync } from 'node:fs';
import { getTrending, getResortConditions, compareResorts, lookupUnknownResort, powderFlag, parseMeteoExtras, catalog, assertClimateRegions } from '../lib/eve/skiTools.js';
import { readdirSync } from 'node:fs';
import { powderDayCall } from '../lib/eve/powderDayCall.js';
import { resortForModel, compareForModel, rankForModel, snowLevelWords } from '../lib/eve/modelView.js';
import { presentingShortReport } from '../lib/eve/reportEmail.js';
import { digestEmail } from '../api/_lib.js';
import { startReportSubscription, CONSENT_VERSION } from '../lib/eve/subscribeReport.js';
import { EMAIL_ALERTS_ENABLED } from '../public/config.js';
import { buildFollowups, sameQuestion, isOpenEndedWhere } from '../src/lib/chatFollowups.js';
import { HOME_REGIONS, regionTiles, regionRows, regionScopeContext, regionStarters, parseExplorePath, explorePath } from '../lib/homeRegions.js';
import { vercelSpa } from '../lib/vercelSpa.js';

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
  check('alta-climate-region', alta.data.region === 'utah-wasatch' && alta.data.snowClimate?.region === 'utah-wasatch', JSON.stringify(alta.data.snowClimate));
  check('alta-region-guide', /wasatch|lake effect/i.test(alta.data.snowClimate?.guide || ''), (alta.data.snowClimate?.guide || '').slice(0, 80));
  check('powder-24', powderFlag({ actual24In: 7, actual72In: 2 }).flagged === true);

  try {
    const mapped = assertClimateRegions(catalog().resorts);
    check('climate-regions-mapped', mapped.ok && mapped.total === catalog().resorts.length, JSON.stringify({ total: mapped.total, ambiguous: mapped.ambiguous.length }));
  } catch (e) {
    check('climate-regions-mapped', false, e.message);
  }
  try {
    assertClimateRegions([{ id: 'alta', name: 'Alta', country: 'US', region: 'Utah', state: 'UT', climateRegion: 'not-a-real-slug' }]);
    check('climate-unknown-slug-fails', false, 'expected throw');
  } catch {
    check('climate-unknown-slug-fails', true);
  }
  const japan = getResortConditions({ resort: 'niseko-hirafu' });
  const alps = getResortConditions({ resort: 'chamonix' });
  const sierra = getResortConditions({ resort: 'mammoth' });
  check('region-japan', japan.data.region === 'japan', japan.data.region);
  check('region-alps-north', alps.data.region === 'alps-north', alps.data.region);
  check('region-sierra', sierra.data.region === 'sierra-nevada-california', sierra.data.region);

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
  check('web-lookup-region', web.data.region === 'pacific-northwest-bc-coast', web.data.region);

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
  const regional = skill('regional-snow-climates');
  check('skill-regional-frontmatter', /^---[\s\S]*name: regional-snow-climates/m.test(regional));
  check('skill-regional-files', /regions\/utah-wasatch\.md/.test(regional) && /regions\/japan\.md/.test(regional));
  const regionFiles = readdirSync(new URL('../agent/skills/regional-snow-climates/regions', import.meta.url)).filter(f => f.endsWith('.md'));
  check('skill-regional-13', regionFiles.length === 13, String(regionFiles.length));
  check('skill-regional-adjustment', /Regional adjustment/.test(skill('reading-snow-quality')) && /Regional adjustment/.test(skill('powder-day-call')));
  const persona = readFileSync(new URL('../agent/instructions.md', import.meta.url), 'utf8');
  check('persona', /not recorded snowfall/i.test(persona));
  check('persona-skills', /presenting-snow-conditions/.test(persona) && /regional-snow-climates/.test(persona));
  check('persona-chat-voice', /friend who knows snow/i.test(persona) && /Never say internal names/i.test(persona) && /Never "not reached base"/i.test(persona));
  check('skill-presenting-chat-usage', /## Chat usage/.test(presenting) && /Go deeper only on request/i.test(presenting));

  // Open-ended "where?" questions get an immediate ranked pick, never a clarifying question.
  check('open-ended-instructions', /never bounce/i.test(persona) && /Never reply with a clarifying question/i.test(persona) && /top spot as your call, plus 1–2 runners-up/i.test(persona) && /only \*\*after\*\* answering/i.test(persona));
  const trendDesc = readFileSync(new URL('../agent/tools/getTrending.ts', import.meta.url), 'utf8');
  check('open-ended-tool-description', /immediately for open-ended/i.test(trendDesc) && /never ask for a region first/i.test(trendDesc));
  const rv = rankForModel(getTrending({}));
  check('open-ended-rank-pick', rv.pick === rv.rows[0].name && rv.runnersUp.length >= 1 && rv.runnersUp.length <= 2 && /Do not ask which region/i.test(rv.howToAnswer), JSON.stringify({ pick: rv.pick, runnersUp: rv.runnersUp }));
  const openQs = ["Where's it dumping right now?", 'Where should I ski this weekend?', 'Who got the most snow?', "Where's the best powder?"];
  const notOpen = ["How's Mammoth looking?", 'Compare Alta and Snowbird', 'Why? Walk me through it.'];
  check('open-ended-classifier', openQs.every(isOpenEndedWhere) && !notOpen.some(isOpenEndedWhere), JSON.stringify(openQs.concat(notOpen).map(q => [q, isOpenEndedWhere(q)])));
  // Region narrowing comes after the answer, as chips.
  const rankMain = { kind: 'rank', where: 'Worldwide', rows: getTrending({ limit: 3 }).data.rows };
  const rankChips = buildFollowups({ asked: "Where's it dumping right now?", main: rankMain, hasOwnData: true });
  check('open-ended-region-chips', rankChips.some(c => c.label === 'Near me?') && rankChips.some(c => /^Just /.test(c.label)), JSON.stringify(rankChips.map(c => c.label)));
  // Follow-up chips never repeat the question just asked, in every context.
  const ctxs = [null, rankMain, { kind: 'compare' }, { kind: 'resort', resort: { name: 'Mammoth Mountain' } }];
  const asks = ["Where's it dumping right now?", "where's it dumping", 'Where should I ski this weekend?', "How's Mammoth looking?", "How's Mammoth Mountain looking?", 'Why? Walk me through it.', 'Why there? Walk me through it.', 'Show me the key numbers.', 'Which one has the better snow quality?', "What's good near me?"];
  const echoes = [];
  for (const main of ctxs) for (const asked of asks) for (const hasOwnData of [true, false]) {
    for (const c of buildFollowups({ asked, main, hasOwnData })) if (sameQuestion(c.send || c.label, asked) || sameQuestion(c.label, asked)) echoes.push(`${main?.kind || 'none'}: ${asked} -> ${c.label}`);
  }
  check('followups-never-repeat-question', echoes.length === 0, echoes.slice(0, 5).join(' | '));
  check('followups-repeat-detector', sameQuestion("Where's it dumping?", "Where's it dumping right now?") && !sameQuestion("How's Mammoth?", "Where's it dumping right now?"));

  // Home "Browse by region" tiles + region-scoped chat view.
  {
    const gaz = JSON.parse(readFileSync(new URL('../public/data/gazetteer.json', import.meta.url), 'utf8'));
    const cat = { ...catalog(), regions: gaz.regions || gaz };
    const tiles = regionTiles(cat, HOME_REGIONS);
    check('regions-tiles', tiles.length >= 6 && tiles.every(t => t.count > 0 && t.name && t.topName), JSON.stringify(tiles.map(t => [t.id, t.count])));
    const utah = cat.regions.find(g => g.id === 'utah');
    const rows = regionRows(utah, cat);
    const trendUtah = getTrending({ region: utah.name, limit: 3 });
    check('regions-rows-match-trending', rows.length > 0 && rows[0].r.id === trendUtah.data.rows[0].id && trendUtah.data.where === 'Utah', `${rows[0]?.r.id} vs ${trendUtah.data.rows[0]?.id}`);
    const tileStatOk = tiles.find(t => t.id === 'utah')?.topName === rows[0].r.name;
    check('regions-tile-stat', tileStatOk);
    const ctx = regionScopeContext('Utah');
    check('regions-scope-context', /getTrending with region "Utah"/.test(ctx) && /Scope every answer to Utah/.test(ctx));
    check('regions-starters-scoped', regionStarters('Utah', 'Snowbird').every(q => /Utah|Snowbird/.test(q)));
    check('regions-explore-path', parseExplorePath(explorePath('pacific-nw')) === 'pacific-nw' && parseExplorePath('/explore/../x') === null && parseExplorePath('/region/utah') === null);
    check('regions-explore-rewrite', vercelSpa.rewrites.some(r => r.source === '/explore/:id' && r.destination === '/'));
    check('regions-instructions', /Region pages \(page context\)/.test(persona) && /best \*\*in that region\*\*/.test(persona));
  }

  // Compact model views: small, honest, and free of internal labels.
  const fullAlta = getResortConditions({ resort: 'alta' });
  const viewAlta = resortForModel(fullAlta);
  const viewAltaText = JSON.stringify(viewAlta);
  check('model-view-small', viewAltaText.length < 2500 && viewAltaText.length < JSON.stringify(fullAlta).length / 2, String(viewAltaText.length));
  check('model-view-honesty', /not recorded snowfall/i.test(viewAlta.honesty || '') && viewAlta.observed === true);
  check('model-view-no-internal-names', !/powder-day-call|SNWD|mountain-wide"/i.test(viewAltaText), viewAltaText.slice(0, 200));
  check('model-view-compare', compareForModel(compareResorts({ ids: ['alta', 'snowbird'] })).rows.length === 2);
  check('model-view-rank', rankForModel(getTrending({ limit: 8 })).rows.length <= 8);
  const below = snowLevelWords({ meanFt: 5000, baseFt: 8000, rainAtBase: false });
  const rainy = snowLevelWords({ meanFt: 9500, baseFt: 8000, rainAtBase: true });
  check('snow-level-plain-words', /stays below the base/.test(below) && /Rain likely at the base/.test(rainy) && !/not reached/i.test(below + rainy + snowLevelWords(null, null)));
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
