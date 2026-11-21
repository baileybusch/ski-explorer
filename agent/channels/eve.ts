import { ForbiddenError, localDev, none, vercelOidc } from 'eve/channels/auth';
import { eveChannel, eveVercelOidc, type EveAuthFn } from 'eve/channels/eve';
import { createLimiter, RATE_LIMITED_CODE, RATE_LIMITED_MESSAGE } from '../../lib/eve/rateLimit.js';

// Questions: 20 per 10 min per IP. Session setup, prewarm and stream reconnects: a
// separate, much looser bucket (see lib/eve/rateLimit.js), so idle tabs don't eat the
// budget. In-memory, so it is per warm instance: a soft anti-abuse limit.
const limiter = createLimiter();

const anonymous = none();
const dev = localDev();

const publicChat: EveAuthFn = async (request) => {
  const verdict = await limiter.check(request);
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
