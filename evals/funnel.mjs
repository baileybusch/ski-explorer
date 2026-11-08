/**
 * Email funnel: insights events + dashboard, chat signup offer policy, welcome series
 * scheduling, admin session cookies, region/pass pages, and Do Not Sell in exports.
 */
import { loadCatalog } from '../lib/skiscope-tools/index.js';
import { cleanEvent, inferInterests, buildDashboard, subscribersCsv, chatsCsv, demoEvents, sourceBucket, toCsv } from '../lib/insights.js';
import { recordEvents, readEvents, resetMemoryStore } from '../lib/insightsStore.js';

export async function runFunnelEvals() {
  const lines = [];
  let fail = 0;
  const check = (id, ok, detail = '') => {
    if (ok) lines.push(`ok    ${id}`);
    else { fail++; lines.push(`FAIL  ${id}  ${detail}`); }
  };
  const cat = loadCatalog();
  const now = Date.parse('2026-11-08T12:00:00Z');

  // insights: schema + inference
  const i1 = inferInterests('Is Alta better than Snowbird in March?', cat);
  check('infer-resorts', i1.resorts.includes('alta') && i1.resorts.includes('snowbird'), JSON.stringify(i1));
  check('infer-month', i1.months.join() === '3', JSON.stringify(i1.months));
  const i2 = inferInterests('Good resort for a Japan ski trip', cat);
  check('infer-region', i2.regions.includes('japan'), JSON.stringify(i2));
  check('infer-may-not-maybe', inferInterests('maybe utah', cat).months.length === 0);
  check('source-buckets', sourceBucket('pass') === 'region' && sourceBucket('home') === 'home' && sourceBucket('trip') === 'other');
  check('clean-rejects-unknown', cleanEvent({ type: 'pageview' }) === null);
  check('clean-chat-needs-q', cleanEvent({ type: 'chat', q: '  ' }) === null);
  check('clean-signup-needs-email', cleanEvent({ type: 'signup', email: 'nope' }) === null);
  const ce = cleanEvent({ type: 'chat', q: 'x'.repeat(500), sid: 'bad sid!', email: 'A@B.co', extra: 1, at: '2001-01-01' }, { now });
  check('clean-trims', ce.q.length === 300 && ce.sid === null && ce.email === 'a@b.co' && !('extra' in ce), JSON.stringify(ce).slice(0, 120));
  check('clean-client-time-ignored', ce.at === new Date(now).toISOString(), ce.at);

  // dashboard: sessions join emails, DNS honored
  const evs = [
    { type: 'chat', q: 'Alta in January?', sid: 'sessAAAA1', resorts: ['alta'], regions: ['utah'], months: [1], at: '2026-11-01T10:00:00Z', trusted: true },
    { type: 'chat', q: 'Alta in January', sid: 'sessAAAA1', resorts: ['alta'], regions: [], months: [1], at: '2026-11-01T10:05:00Z', trusted: true },
    { type: 'signup', email: 'skier@example.com', sid: 'sessAAAA1', source: 'chat', kind: 'resort', resorts: ['alta'], at: '2026-11-01T10:06:00Z', trusted: true },
    { type: 'signup', email: 'two@example.com', sid: 'sessBBBB2', source: 'region', kind: 'region', region: 'japan', at: '2026-11-02T10:00:00Z', trusted: true },
    { type: 'dns', sid: 'sessBBBB2', optOut: true, at: '2026-11-03T10:00:00Z', trusted: true },
  ].map(e => cleanEvent(e, { now }));
  const dash = buildDashboard(evs, { now, days: 14, names: { alta: 'Alta', japan: 'Japan' } });
  const skier = dash.subscribers.find(s => s.email === 'skier@example.com');
  check('dash-join-pre-signup-chats', skier?.questions === 2 && skier.askedResorts[0] === 'alta' && skier.askedMonths[0] === 1, JSON.stringify(skier));
  check('dash-source-buckets', dash.signupsBySource.chat === 1 && dash.signupsBySource.region === 1, JSON.stringify(dash.signupsBySource));
  check('dash-top-questions-merge', dash.topQuestions[0]?.count === 2, JSON.stringify(dash.topQuestions));
  check('dash-top-region-named', dash.topSubscribed.regions[0]?.name === 'Japan');
  check('dash-by-day-len', dash.signupsByDay.length === 14 && dash.signupsByDay.at(-1).date === '2026-11-08');
  check('dash-dns-via-session', dash.subscribers.find(s => s.email === 'two@example.com')?.doNotSell === true && dash.totals.doNotSell === 1);
  const partners = subscribersCsv(dash, { partners: true });
  check('csv-partners-excludes-dns', partners.includes('skier@example.com') && !partners.includes('two@example.com') && !partners.split('\n')[0].includes('doNotSell'), partners.slice(0, 200));
  check('csv-internal-has-all', subscribersCsv(dash).includes('two@example.com'));
  const chats = chatsCsv(evs, { partners: true });
  check('csv-chats-partners-no-email', !chats.includes('@'), chats.slice(0, 200));
  check('csv-formula-escaped', toCsv([{ a: '=HYPERLINK("x")' }], ['a']).includes(`"'=HYPERLINK(""x"")"`));

  const demo = demoEvents({ now });
  check('demo-labeled', demo.length > 50 && demo.every(e => e.demo === true && (!e.email || e.email.endsWith('@example.com'))));
  const dd = buildDashboard(demo, { now });
  check('demo-dashboard-populated', dd.totals.subscribers > 20 && dd.topQuestions.length > 3 && Object.values(dd.signupsBySource).every(n => n > 0), JSON.stringify(dd.signupsBySource));

  // store: memory fallback when no Blob token
  const hadToken = process.env.BLOB_READ_WRITE_TOKEN;
  delete process.env.BLOB_READ_WRITE_TOKEN;
  resetMemoryStore();
  await recordEvents([{ type: 'chat', q: 'hello', sid: 'sessCCCC3' }, { type: 'bogus' }]);
  const stored = await readEvents();
  check('store-memory', stored.length === 1 && stored[0].env === (process.env.VERCEL_ENV || 'development'), JSON.stringify(stored));
  resetMemoryStore();
  if (hadToken) process.env.BLOB_READ_WRITE_TOKEN = hadToken;

  return { fail, total: lines.length, lines };
}
