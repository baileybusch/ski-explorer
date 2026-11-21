import { ForbiddenError, localDev, none, vercelOidc } from 'eve/channels/auth';
import { eveChannel, eveVercelOidc, type EveAuthFn } from 'eve/channels/eve';
import { createLimiter, ipOf, RATE_LIMITED_CODE, RATE_LIMITED_MESSAGE } from '../../lib/eve/rateLimit.js';

// Questions: 20 per 10 min per IP. Session setup + stream reconnects: a separate,
// much looser bucket (see lib/eve/rateLimit.js), so idle tabs don't eat the budget.
const limiter = createLimiter();
const INSTANCE = Math.random().toString(36).slice(2, 8);
let seen = 0;

const anonymous = none();
const dev = localDev();

const publicChat: EveAuthFn = async (request) => {
  const verdict = limiter.check(request);
  // TEMP diagnostics (remove before merge): which instance counted what.
  seen++;
  const ipTag = [ipOf(request)].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7).toString(36);
  console.log(`[rl] inst=${INSTANCE} seen=${seen} kind=${verdict.kind} ok=${verdict.ok} ip#${ipTag} ${request.method} ${new URL(request.url).pathname.replace(/wrun_\w+/, 'wrun_X')}`);
  if (!verdict.ok) {
    throw new ForbiddenError({ code: RATE_LIMITED_CODE, message: RATE_LIMITED_MESSAGE });
  }
  return anonymous(request);
};

const localEval: EveAuthFn = async (request) => {
  const caller = await dev(request);
  return caller ? { ...caller, allowToolStubs: true } : null;
};

export default eveChannel({
  auth: [
    eveVercelOidc({ subjects: [{ subject: '*', allowToolStubs: true }] }),
    vercelOidc(),
    localEval,
    publicChat,
  ],
});
