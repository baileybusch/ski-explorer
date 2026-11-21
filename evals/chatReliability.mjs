/**
 * Chat reliability: rate-limit buckets, error copy, one forecast source,
 * plain storm wording, answer-voice checks. Deterministic, no LLM.
 */
import { createLimiter, requestKind, LIMITS, RATE_LIMITED_CODE } from '../lib/eve/rateLimit.js';
import { chatErrorKind, isCapInteraction, CHAT_ERROR_COPY } from '../src/lib/chatErrors.js';
import { alignExtrasToCatalog, getResortConditions } from '../lib/eve/skiTools.js';
import { resortForModel } from '../lib/eve/modelView.js';
import { weekendSay, weekendFromDays } from '../lib/skiscope-tools/weekend.js';
import { voiceIssues, wordCount } from '../lib/eve/voiceLint.js';
import { normalizeChatText } from '../src/lib/chatText.js';
import { stormStatus } from '../lib/stormStatus.js';
import { catalog } from '../lib/eve/skiTools.js';

const req = (method, path, ip = '1.2.3.4') => new Request(`https://skiscope.test${path}`, { method, headers: { 'x-forwarded-for': `${ip}, 10.0.0.1` } });

export function runChatReliabilityEvals() {
  const lines = [];
  let fail = 0;
  const check = (id, ok, detail = '') => {
    if (ok) lines.push(`ok    ${id}`);
    else { fail++; lines.push(`FAIL  ${id}  ${detail}`); }
  };

  // --- Rate limit: only questions count toward the strict bucket.
  check('kind-message', requestKind('POST', '/eve/v1/session/wrun_abc') === 'message');
  check('kind-session-create', requestKind('POST', '/eve/v1/session') === 'background');
  check('kind-stream', requestKind('GET', '/eve/v1/session/wrun_abc/stream') === 'background');
  check('kind-cancel', requestKind('POST', '/eve/v1/session/wrun_abc/cancel') === 'background');
  check('kind-get-session', requestKind('GET', '/eve/v1/session/wrun_abc') === 'background');
  check('limits', LIMITS.message === 20 && LIMITS.background >= 200, JSON.stringify(LIMITS));

  let t = 0;
  const lim = createLimiter({ now: () => t });
  // An idle tab for an hour: page-load session + stream reconnect every 60s.
  let bgOk = 0;
  for (let i = 0; i < 6; i++) { t = i * 10 * 60_000; if (lim.check(req('POST', '/eve/v1/session')).ok) bgOk++; }
  for (let s = 0; s < 60; s++) { t = s * 60_000; if (lim.check(req('GET', '/eve/v1/session/wrun_a/stream')).ok) bgOk++; }
  check('idle-tab-never-limited', bgOk === 66, `bg ok ${bgOk}/66`);
  // Three idle tabs plus 20 questions inside one window: all questions go through.
  t = 70 * 60_000;
  for (let i = 0; i < 30; i++) lim.check(req('GET', '/eve/v1/session/wrun_b/stream'));
  let qOk = 0;
  for (let i = 0; i < 20; i++) if (lim.check(req('POST', '/eve/v1/session/wrun_b')).ok) qOk++;
  check('twenty-questions-allowed', qOk === 20, `${qOk}/20`);
  check('question-21-limited', lim.check(req('POST', '/eve/v1/session/wrun_b')).ok === false);
  check('limit-per-ip', lim.check(req('POST', '/eve/v1/session/wrun_c', '9.9.9.9')).ok === true);
  check('stream-ok-while-questions-limited', lim.check(req('GET', '/eve/v1/session/wrun_b/stream')).ok === true);
  t += 10 * 60_000 + 1;
  check('limit-clears-after-window', lim.check(req('POST', '/eve/v1/session/wrun_b')).ok === true);
  // Background abuse is still capped (loosely).
  const lim2 = createLimiter({ now: () => 0 });
  let bg2 = 0;
  for (let i = 0; i < LIMITS.background + 5; i++) if (lim2.check(req('GET', '/eve/v1/session/x/stream')).ok) bg2++;
  check('background-loose-cap', bg2 === LIMITS.background, `${bg2}`);

  // --- Error copy.
  const rateErr = Object.assign(new Error('Request failed'), { status: 403, code: RATE_LIMITED_CODE, body: '{"ok":false,"code":"rate_limited","error":"Too many questions, try again in a few minutes."}' });
  check('error-rate', chatErrorKind(rateErr) === 'rate');
  check('error-rate-body-only', chatErrorKind({ status: 403, body: '{"code":"rate_limited"}' }) === 'rate');
  check('error-generic', chatErrorKind(new Error('Failed to fetch')) === 'generic');
  check('error-none', chatErrorKind(null) === null);
  check('cap-interaction', isCapInteraction({ interactionId: 'wrun_x:3:limit:usage:0', request: { kind: 'budget' } }));
  check('cap-not-other-interaction', !isCapInteraction({ interactionId: 'wrun_x:3:ask:1', request: { kind: 'question' } }));
  check('copy-rate', CHAT_ERROR_COPY.rate === 'Too many questions, try again in a few minutes.');
  check('copy-cap', /gotten long, start a new one/.test(CHAT_ERROR_COPY.cap));

  // --- One forecast source: live extras take the catalog's daily amounts.
  const cat = [{ date: '2026-11-22', snowCm: 0 }, { date: '2026-11-23', snowCm: 0 }];
  const extras = { days: [{ date: '2026-11-22', snowCm: 1, snowCmMin: 0.5, snowCmMax: 1.5, feel: 'dense' }, { date: '2026-11-23', snowCm: 0, snowCmMin: 0, snowCmMax: 0 }, { date: '2026-11-29', snowCm: 3 }], next7SnowCm: 4, next3: [] };
  const aligned = alignExtrasToCatalog(extras, cat);
  check('align-days-from-catalog', aligned.days.every(d => d.snowCm === 0) && aligned.days.length === 2, JSON.stringify(aligned.days));
  check('align-total-from-catalog', aligned.next7SnowCm === 0);
  check('align-drops-bad-range', aligned.days[0].snowCmMin == null && aligned.days[1].snowCmMin === 0);
  check('align-keeps-feel', aligned.days[0].feel === 'dense');
  const june = resortForModel(getResortConditions({ resort: 'june' }));
  const juneNext = june.next7In;
  const juneDaysSum = (june.days || []).reduce((a, s) => a + parseFloat(String(s).split(' · ')[1]), 0);
  check('resort-view-days-match-next7', Math.abs(juneDaysSum - juneNext) < 0.6, `days ${juneDaysSum} vs next7 ${juneNext}`);
  check('resort-view-no-range', !('next7RangeIn' in june));

  // --- Plain storm line (summary card).
  const cat0 = catalog();
  const bad = /SNOTEL|CDEC|snow-depth|water equivalent|SNWD|SWE|depth rise|still on the forecast/;
  const texts = Object.values(cat0.resorts || {}).slice(0, 400).map(r => stormStatus(r, cat0.snow).text);
  const jargon = texts.filter(x => bad.test(x));
  check('storm-line-plain-all-resorts', !jargon.length, jargon.slice(0, 2).join(' | '));
  const juneR = (cat0.resorts || []).find ? cat0.resorts.find(r => r.id === 'june') : cat0.resorts?.june;
  if (juneR) check('storm-line-june', /new snow in 3 days/.test(stormStatus(juneR, cat0.snow).text), stormStatus(juneR, cat0.snow).text);

  // --- Voice: units, Sunday, length.
  check('double-unit-flagged', voiceIssues('Only 0.4" inches coming.').includes('double-unit'));
  check('double-unit-normalized', normalizeChatText('Only 0.4" inches and 2″ in more.') === 'Only 0.4" and 2″ more.', normalizeChatText('Only 0.4" inches and 2″ in more.'));
  check('weekend-sunday-flagged', voiceIssues('Quiet over the weekend.', { sundayOnly: true }).includes('weekend-not-sunday'));
  check('weekend-sunday-ok', !voiceIssues('Quiet on Sunday.', { sundayOnly: true }).length);
  check('too-long-flagged', voiceIssues(Array(120).fill('snow').join(' '), { short: true }).includes('too-long'));
  check('word-count', wordCount('a b  c') === 3);
  check('weekend-say-sunday', weekendSay(['2026-11-22']) === 'Sunday');
  check('weekend-say-both', weekendSay(['2026-11-28', '2026-11-29']) === 'this weekend');
  const wk = weekendFromDays([{ date: '2026-11-22', snowCm: 0 }, { date: '2026-11-23', snowCm: 0 }], { today: '2026-11-21' });
  check('resort-weekend-say', wk?.say === 'Sunday', JSON.stringify(wk));

  return { fail, total: lines.length, lines };
}
