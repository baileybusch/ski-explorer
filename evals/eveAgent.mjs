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
import { ensureLiveData, resetLiveData, liveOrigin, LIVE_TTL_MS } from '../lib/eve/liveData.js';
import { loadRaw, buildCatalog, setCatalog } from '../lib/skiscope-tools/catalog.js';
import { weekendIdx, weekendSnow, weekendFromDays, weekendWindowIdx } from '../lib/skiscope-tools/weekend.js';
import { dumpParts } from '../lib/dumpScore.js';
import { newSnowWords } from '../lib/eve/modelView.js';
import { normalizeChatText } from '../src/lib/chatText.js';
import { voiceIssues, isWeekendQuestion, answerOrderIssues, isResortLookQuestion } from '../lib/eve/voiceLint.js';
import { json as modelJson, BANNED_MODEL_PHRASES } from '../lib/eve/modelView.js';

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
  {
    const chips = buildFollowups({ asked: "How's June looking?", main: { kind: 'resort', resort: { name: 'June Mountain' } }, hasOwnData: true }).map(c => c.label);
    check('followups-resort-peel-back', chips[0] === 'Why?' && chips.includes('Tell me more about the snow') && chips.includes("Where's better?"), JSON.stringify(chips));
  }
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

  // Live data: tools read the same /api/observed the page loads; chat and list agree.
  {
    const raw = loadRaw();
    const gazRegions = raw.gaz?.regions || [];
    const utahRegion = gazRegions.find(g => g.id === 'utah');
    const snapCat = { ...buildCatalog({ ...raw, snow: { ...raw.snow } }), regions: gazRegions };
    const snapshotTop = regionRows(utahRegion, snapCat)[0].r.id;
    // A live snapshot where a different Utah resort leads, with a distinct number.
    const bump = snapshotTop === 'brighton' ? 'solitude' : 'brighton';
    const live = JSON.parse(JSON.stringify(raw.observed));
    live.resorts[bump] = { ...(live.resorts[bump] || {}), snow72hCm: 99.1, snow24hCm: 30.5, source: 'snotel:test:UT:SNTL', method: 'snwd-peak' };
    live.fetched = '2099-01-01T00:00:00Z';
    let calls = 0;
    const okFetch = async url => { calls++; return { ok: url.endsWith('/api/observed'), status: 200, json: async () => live }; };
    let t = 1_000_000;
    const now = () => t;
    resetLiveData();
    const env = { VERCEL_ENV: 'preview', VERCEL_BRANCH_URL: 'skiscope-git-x-bbusch.vercel.app', VERCEL_URL: 'skiscope-abc.vercel.app' };
    const st = await ensureLiveData({ fetchImpl: okFetch, env, now });
    check('live-data-fetched', st.source === 'live' && st.origin === 'https://skiscope-git-x-bbusch.vercel.app' && calls === 1, JSON.stringify(st));
    const chatTop = getTrending({ region: 'Utah', limit: 3 }).data.rows[0];
    // The page: browser-style catalog from the same live observed -> lib/homeRegions.regionRows.
    const pageCat = { ...buildCatalog({ ...raw, snow: { ...raw.snow }, observed: live }), regions: gazRegions };
    const pageTop = regionRows(utahRegion, pageCat)[0];
    check('live-data-chat-matches-list', chatTop.id === bump && pageTop.r.id === bump && Math.abs(chatTop.actual72Cm - pageTop.dump.past72Cm) < 0.05, `${chatTop.id} ${chatTop.actual72Cm} vs ${pageTop.r.id} ${pageTop.dump.past72Cm}`);
    t += LIVE_TTL_MS - 1000;
    await ensureLiveData({ fetchImpl: okFetch, env, now });
    check('live-data-cached', calls === 1);
    t += 2000;
    await ensureLiveData({ fetchImpl: okFetch, env, now });
    check('live-data-ttl-refresh', calls === 2 && LIVE_TTL_MS <= 5 * 60 * 1000);
    t += LIVE_TTL_MS + 1;
    const bad = await ensureLiveData({ fetchImpl: async () => { throw new Error('boom'); }, env, now });
    const afterFail = getTrending({ region: 'Utah', limit: 1 }).data.rows[0].id;
    check('live-data-fallback-snapshot', bad.source === 'snapshot' && /boom/.test(bad.error) && afterFail === snapshotTop, `${bad.source} ${afterFail} vs ${snapshotTop}`);
    t += 120_000;
    const http = await ensureLiveData({ fetchImpl: async () => ({ ok: false, status: 503, json: async () => ({}) }), env, now });
    check('live-data-fallback-http', http.source === 'snapshot');
    resetLiveData();
    let noCalls = 0;
    const local = await ensureLiveData({ fetchImpl: async () => { noCalls++; return null; }, env: {}, now });
    check('live-data-no-origin-no-fetch', local.source === 'snapshot' && noCalls === 0);
    check('live-origin-env', liveOrigin({ VERCEL_ENV: 'production', VERCEL_PROJECT_PRODUCTION_URL: 'skiscope.vercel.app', VERCEL_URL: 'x.vercel.app' }) === 'https://skiscope.vercel.app'
      && liveOrigin({ VERCEL_ENV: 'preview', VERCEL_URL: 'x.vercel.app' }) === 'https://x.vercel.app' && liveOrigin({}) === null);
    const toolSrc = ['getTrending', 'getResortConditions', 'searchResorts', 'getSnowForecast', 'compareResorts']
      .map(n => [n, readFileSync(new URL(`../agent/tools/${n}.ts`, import.meta.url), 'utf8')]);
    check('live-data-all-tools', toolSrc.every(([, src]) => /await ensureLiveData\(\)/.test(src)), toolSrc.filter(([, src]) => !/await ensureLiveData/.test(src)).map(([n]) => n).join(','));
    check('live-data-embedded-base', /setBaseRaw\(embeddedRaw\)/.test(readFileSync(new URL('../lib/eve/embeddedData.ts', import.meta.url), 'utf8')));
    resetLiveData();
    setCatalog(buildCatalog({ ...raw, snow: { ...raw.snow } }));
  }

  // Voice: never "depth rise"; weekend = Sat + Sun only; no unsupported color.
  {
    check('voice-instructions-depth-rise', /Never say "depth rise"/.test(persona));
    check('voice-instructions-weekend', /only the weekend days' forecast/i.test(persona) && /sort: "weekend"/.test(persona) && /never the 7-day total/i.test(persona));
    check('voice-instructions-no-color', /Don't add unsupported color/i.test(persona) && /higher-altitude powder/.test(persona));
    const toolDescs = ['getTrending', 'getResortConditions', 'searchResorts', 'getSnowForecast', 'compareResorts']
      .map(n => readFileSync(new URL(`../agent/tools/${n}.ts`, import.meta.url), 'utf8').match(/description: '([^\n]*)'/)?.[1] || '');
    check('voice-tool-descriptions-no-depth-rise', toolDescs.every(d => !BANNED_MODEL_PHRASES.test(d)));
    const ids = catalog().resorts.slice(0, 40).map(r => r.id);
    const views = [
      ...ids.map(id => modelJson(resortForModel(getResortConditions({ resort: id })))),
      modelJson(rankForModel(getTrending({ limit: 8 }))),
      modelJson(rankForModel(getTrending({ sort: 'weekend', limit: 8 }))),
      modelJson(compareForModel(compareResorts({ resorts: ids.slice(0, 4) }))),
    ];
    const leaky = views.map(v => JSON.stringify(v.value)).filter(x => BANNED_MODEL_PHRASES.test(x));
    check('voice-model-views-no-depth-rise', leaky.length === 0, leaky[0]?.match(/.{0,40}(depth[-_ ]?rise|peak[-_ ]?rise|snwd).{0,40}/i)?.[0]);
    const ds = ['2026-11-20', '2026-11-21', '2026-11-22', '2026-11-23', '2026-11-24', '2026-11-25', '2026-11-26', '2026-11-27', '2026-11-28', '2026-11-29'];
    check('weekend-days', JSON.stringify(weekendIdx(ds, 0)) === '[1,2]' && JSON.stringify(weekendIdx(ds, 2)) === '[2]' && JSON.stringify(weekendIdx(ds, 3)) === '[8,9]', JSON.stringify([weekendIdx(ds, 0), weekendIdx(ds, 2), weekendIdx(ds, 3)]));
    const wk = getTrending({ sort: 'weekend', limit: 8 });
    const cat = catalog();
    const manual = cat.resorts.map(r => ({ id: r.id, cm: weekendSnow(r, cat.snow).cm })).sort((a, b) => b.cm - a.cm);
    check('weekend-rank-uses-weekend-days', wk.data.sortLabel === 'This weekend' && wk.data.rows[0].weekendCm === manual[0].cm && wk.data.rows.every(r => r.weekendIn <= r.next7In + 0.05), JSON.stringify(wk.data.rows.slice(0, 2).map(r => [r.name, r.weekendIn, r.next7In])));
    const wkView = rankForModel(wk);
    check('weekend-model-view-no-7day', wkView.rows.every(r => !('next7In' in r) && 'weekendIn' in r) && /never a 7-day total/.test(wkView.howToAnswer) && !!wkView.weekendDays, JSON.stringify(wkView.rows[0]));
    const altaView = resortForModel(getResortConditions({ resort: 'alta' }));
    check('weekend-resort-field', !!altaView.weekend && /Sat|Sun/.test(altaView.weekend.label) && Number.isFinite(altaView.weekend.snowIn), JSON.stringify(altaView.weekend));
    check('voice-lint-flags-bad', voiceIssues("Snowbird's the call: 18\" of depth rise, and fresh lift-runs with higher-altitude powder.").join() === 'depth-rise,unsupported-color'
      && voiceIssues('Stevens Pass: about 24 in over the next 7 days.', { weekend: true }).includes('weekend-uses-7-day'));
    check('voice-lint-passes-good', voiceIssues('Snowbasin is the call: about 22 inches in three days. Alta is close behind.').length === 0
      && voiceIssues('Hakuba for Sat–Sun: about 14 inches forecast. Les 3 Vallées gets about 11.', { weekend: true }).length === 0);
    // Regression (Sat Nov 21 2026): the weekend window and Next 7 days start on the same day
    // (tomorrow), so a big snow day today can't make the weekend exceed the week.
    {
      const dates = Array.from({ length: 17 }, (_, i) => new Date(Date.UTC(2026, 10, 14 + i)).toISOString().slice(0, 10));
      const sf = dates.map(() => 0);
      sf[7] = 24.1; sf[8] = 1.2; sf[13] = 3; sf[14] = 4; // Sat 21 (today) heavy, Sun 22 light, Fri 27/Sat 28 later
      const r = { id: 'pin' };
      const sat = { dates, today: 7, resorts: { pin: { sf } } };
      const sun = { dates, today: 8, resorts: { pin: { sf } } };
      const wSat = weekendSnow(r, sat), wSun = weekendSnow(r, sun);
      const n7Sat = dumpParts(r, sat).next7Cm, n7Sun = dumpParts(r, sun).next7Cm;
      check('weekend-saturday-pinned', dates[7] === '2026-11-21' && JSON.stringify(wSat.days) === '["2026-11-22"]' && wSat.cm === 1.2 && wSat.cm <= n7Sat && dumpParts(r, sat).past24Cm === 24.1,
        JSON.stringify({ wSat, n7Sat }));
      check('weekend-sunday-pinned', JSON.stringify(wSun.days) === '["2026-11-28","2026-11-29"]' && wSun.cm <= n7Sun && JSON.stringify(weekendWindowIdx(sun)) === '[14,15]',
        JSON.stringify({ wSun, n7Sun }));
      const live = [{ date: '2026-11-21', snowCm: 24.1 }, { date: '2026-11-22', snowCm: 1.2 }, { date: '2026-11-23', snowCm: 0 }];
      check('weekend-live-days-skip-today', weekendFromDays(live, { today: '2026-11-21' }).snowIn === 0.5 && weekendFromDays(live, { today: '2026-11-21' }).label === 'Sun Nov 22',
        JSON.stringify(weekendFromDays(live, { today: '2026-11-21' })));
      const allCat = catalog();
      const over = allCat.resorts.filter(x => weekendSnow(x, allCat.snow).cm > dumpParts(x, allCat.snow).next7Cm + 0.05).map(x => x.id);
      check('weekend-never-above-next7-all-resorts', over.length === 0, over.slice(0, 5).join());
    }
    check('voice-lint-flags-fell', voiceIssues('Mammoth: about 35" fell in the last three days.').includes('fell')
      && voiceIssues('Mammoth has about 35" of new snow in three days, estimated.').length === 0);
    check('new-snow-words-estimated', newSnowWords({ actual72In: 34.6, estimated: false, method: 'swe-slr' }) === 'about 35" of new snow in three days, estimated'
      && newSnowWords({ actual72In: 10, estimated: false, method: 'snwd-peak' }) === 'about 10" of new snow in three days'
      && newSnowWords({ actual72In: 3, estimated: true }) === 'about 3" of new snow in three days, estimated');
    check('chat-text-bullets-normalized', normalizeChatText('Go.\n\n- Last\u201172\u202Fh: \u224835\u202F\u2033 new snow\n-\u00A0Base: 17\u202F\u2033\n\u2022 Next 7 days: 0.6\u2033 at 10:30')
      === 'Go.\n\n- Last 72h: \u224835\u2033 new snow\n- Base: 17\u2033\n- Next 7 days: 0.6\u2033 at 10:30', JSON.stringify(normalizeChatText('- Last\u201172\u202Fh: \u224835\u202F\u2033')));
    // "How's X looking?": context first (what happened → now → coming), "My take:" last.
    check('answer-order-instructions', /context first and the call last/i.test(persona) && /What just happened/.test(persona) && /Current conditions/.test(persona) && /What's coming/.test(persona) && /starting with "My take:"/.test(persona) && /Don't open with a verdict/.test(persona));
    check('answer-order-skill', /context first, the call last/i.test(presenting) && /My take:/.test(presenting) && /Never open with a verdict/.test(presenting));
    {
      const ex = persona.match(/User: How's Mammoth looking\?\nYou: ([^\n]+)/)?.[1] || '';
      check('answer-order-persona-example', ex && answerOrderIssues(ex).length === 0, JSON.stringify(answerOrderIssues(ex)));
      const skillEx = [...presenting.matchAll(/\*\*SkiScope:\*\* ([^\n]+)/g)].map(m => m[1]);
      check('answer-order-skill-examples', skillEx.length >= 2 && skillEx.every(x => answerOrderIssues(x).length === 0), JSON.stringify(skillEx.map(answerOrderIssues)));
    }
    check('answer-order-flags-verdict-first', answerOrderIssues("June's a no. It got 22\" but nothing is coming.").includes('verdict-first')
      && answerOrderIssues('Mammoth is the call right now. About 35" of new snow, estimated. My take: go.').includes('verdict-first')
      && answerOrderIssues('There was just a storm, about 22" of new snow, estimated. Today is cold. Nothing is coming this week.').includes('take-missing'));
    check('answer-order-passes-good', answerOrderIssues('There was just a storm: about 22" of new snow in three days, estimated. Today\'s dry and cold, and the snow is heavy. Nothing much is coming this week. My take: it\'s not the one to pick right now.').length === 0);
    check('answer-order-question-detector', isResortLookQuestion("How's June looking?") && isResortLookQuestion('how is Alta looking this weekend') && !isResortLookQuestion("Where's it dumping right now?"));
    check('answer-order-model-view', /My take:/.test(resortForModel(getResortConditions({ resort: 'june' })).howToAnswer || ''));
    check('voice-weekend-detector', isWeekendQuestion('Where should I ski this weekend?') && !isWeekendQuestion("Where's it dumping right now?"));
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
