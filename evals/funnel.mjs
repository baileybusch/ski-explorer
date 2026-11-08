/**
 * Email funnel: insights events + dashboard, chat signup offer policy, welcome series
 * scheduling, admin session cookies, region/pass pages, and Do Not Sell in exports.
 */
import { loadCatalog } from '../lib/skiscope-tools/index.js';
import { cleanEvent, inferInterests, buildDashboard, subscribersCsv, chatsCsv, demoEvents, sourceBucket, toCsv } from '../lib/insights.js';
import { recordEvents, readEvents, resetMemoryStore } from '../lib/insightsStore.js';
import { decideOffer, offerChunks, wantsAlerts } from '../lib/ask/offer.js';
import { welcomeDue, markWelcome, welcomeRows, watchLabel } from '../lib/welcome.js';
import { welcomeEmail } from '../lib/emails.js';
import { passwordOk, signAdminSession, verifyAdminSession, adminCookieHeader } from '../lib/adminAuth.js';
import { parseCategoryPath, categoryMeta, categoryName, ctaLabel } from '../lib/categoryPages.js';
import { CONSENT_TEXT, CONSENT_VERSION } from '../lib/consentText.js';
import { cleanRules } from '../api/auth.js';

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

  // chat offer: never pushy, at most once per session unless asked
  const msg = (...texts) => texts.map((t, i) => ({ id: `m${i}`, role: 'user', parts: [{ type: 'text', text: t }] }));
  check('offer-too-early', decideOffer({ messages: msg('hi'), cat }).offer === false);
  const sp = decideOffer({ messages: msg('Is Alta getting snow this week?'), cat });
  check('offer-specific-resort', sp.offer && sp.reason === 'specific' && sp.target?.id === 'alta', JSON.stringify(sp));
  const rg = decideOffer({ messages: msg('Best resorts in Japan right now'), cat });
  check('offer-specific-region', rg.offer && rg.target?.type === 'region' && rg.target.id === 'japan', JSON.stringify(rg));
  check('offer-month', decideOffer({ messages: msg('Where should I ski in March?'), cat }).reason === 'month');
  check('offer-engaged', decideOffer({ messages: msg('hi', 'what is this'), cat }).reason === 'engaged');
  check('offer-once', decideOffer({ messages: msg('Alta snow?'), cat, state: { shown: true } }).offer === false);
  check('offer-dismissed', decideOffer({ messages: msg('a', 'b', 'Alta?'), cat, state: { dismissed: true } }).offer === false);
  check('offer-subscribed', decideOffer({ messages: msg('Alta?'), cat, state: { subscribed: true } }).offer === false);
  check('offer-asked-overrides', wantsAlerts('can you alert me when Alta gets snow') && decideOffer({ messages: msg('alert me when Alta gets dumped on'), cat, state: { shown: true, dismissed: true } }).reason === 'asked');
  const ch = offerChunks(sp);
  check('offer-chunks', ch.length === 4 && ch[1].toolName === 'offerAlertSignup' && /Alta gets dumped on\?$/.test(ch[2].output.headline), JSON.stringify(ch[2]));
  check('offer-no-chunks', offerChunks({ offer: false }).length === 0);

  // welcome series scheduling
  const day = 864e5;
  const confirmed = new Date(now).toISOString();
  const sub = { status: 'active', confirmed, email: 'w@example.com', token: 't'.repeat(32), resorts: ['alta'], rules: [{ id: 'r1', watch: 'resort', type: 'resort', resorts: ['alta'] }, { id: 'r2', watch: 'region', type: 'region', region: 'japan', resorts: [] }] };
  check('welcome-w1-now', welcomeDue(sub, now) === 'w1');
  markWelcome(sub, 'w1', now);
  check('welcome-w2-waits', welcomeDue(sub, now + day) === null);
  check('welcome-w2-day2', welcomeDue(sub, now + 2 * day + 1) === 'w2');
  markWelcome(sub, 'w2', now + 2 * day);
  check('welcome-w3-day5', welcomeDue(sub, now + 5 * day + 1) === 'w3');
  markWelcome(sub, 'w3', now + 5 * day);
  check('welcome-done', welcomeDue(sub, now + 30 * day) === null);
  check('welcome-pending-none', welcomeDue({ ...sub, status: 'pending', welcome: null }, now) === null);
  check('welcome-stale-skipped', welcomeDue({ ...sub, welcome: null, confirmed: new Date(now - 30 * day).toISOString() }, now) === null);
  check('welcome-respects-prefs', welcomeDue({ ...sub, welcome: null, prefs: { stormAlerts: false, recap: false } }, now) === null);
  const snowJson = { ...cat.snow, index: cat.resorts, regions: cat.regions };
  const rows = welcomeRows(sub, snowJson);
  check('welcome-rows', rows[0]?.id === 'alta' && rows.length >= 2 && rows.every(r => Number.isFinite(r.incomingIn)), JSON.stringify(rows.map(r => r.id)));
  check('welcome-label', watchLabel(sub, snowJson) === 'Alta + 1 more', watchLabel(sub, snowJson));
  const w = ['w1', 'w2', 'w3'].map(step => welcomeEmail({ step, rows, label: 'Alta + Japan', token: sub.token, email: sub.email }));
  check('welcome-templates', w.every(m => m.subject && m.html.includes('unsubscribe') && m.text.length > 100) && w[0].html.includes('Alta') && w[1].html.includes('?ask=') && w[2].html.includes('/region/'), w.map(m => m.subject).join(' | '));

  // admin session
  const pw = 'correct horse battery';
  check('admin-password', passwordOk(pw, pw) && !passwordOk('nope', pw) && !passwordOk(pw, '') && !passwordOk('', ''));
  const tok = signAdminSession(pw, now);
  check('admin-session-ok', verifyAdminSession(tok, pw, now + 1000));
  check('admin-session-expires', !verifyAdminSession(tok, pw, now + 13 * 3600e3));
  check('admin-session-rotates', !verifyAdminSession(tok, 'new password', now));
  check('admin-session-tamper', !verifyAdminSession(tok.slice(0, -2) + 'xx', pw, now) && !verifyAdminSession('', pw, now));
  check('admin-cookie-flags', /HttpOnly/.test(adminCookieHeader(tok)) && /SameSite=Strict/.test(adminCookieHeader(tok)) && /Path=\/api/.test(adminCookieHeader(tok)));

  // region / pass pages
  check('category-parse', parseCategoryPath('/region/california')?.id === 'california' && parseCategoryPath('/pass/ikon/')?.kind === 'pass');
  check('category-parse-rejects', parseCategoryPath('/pass/nope') === null && parseCategoryPath('/region/../x') === null && parseCategoryPath('/regions/utah') === null);
  const ca = { kind: 'region', id: 'california' };
  const caName = categoryName(ca, cat.regions);
  const meta = categoryMeta(ca, { name: caName, site: 'https://x.test' });
  check('category-meta', caName === 'California' && meta.title.startsWith('California snow') && meta.image === 'https://x.test/og/region-california.png', JSON.stringify(meta));
  check('category-cta', ctaLabel(ca, caName) === 'Get alerts for California' && ctaLabel({ kind: 'pass', id: 'ikon' }, 'Ikon Pass') === 'Get alerts for Ikon resorts');

  // consent + account rules
  check('consent-discloses', CONSENT_VERSION === 'ss-consent-2' && /Ask questions/.test(CONSENT_TEXT) && /sponsors and partners/.test(CONSENT_TEXT) && /Opt out/.test(CONSENT_TEXT));
  const prior = [{ id: 'rul_keep1', type: 'resort', resorts: ['alta'], lastFired: '2026-11-01', lastKeys: { alta: 'k' } }];
  const cleaned = cleanRules([
    { id: 'rul_keep1', type: 'resort', resorts: ['alta', 'BAD id!'], lastFired: 'forged' },
    { type: 'region', region: 'japan', resorts: [], pendingSend: { x: 1 } },
  ], 'a@b.co', prior);
  check('rules-keep-server-fields', cleaned[0].lastFired === '2026-11-01' && cleaned[0].lastKeys?.alta === 'k' && cleaned[0].resorts.join() === 'alta', JSON.stringify(cleaned[0]));
  check('rules-new-id-no-forged', /^rul_[0-9a-f]{12}$/.test(cleaned[1].id) && cleaned[1].pendingSend === undefined && cleaned[1].region === 'japan', JSON.stringify(cleaned[1]));

  return { fail, total: lines.length, lines };
}
