import { ForbiddenError, localDev, none, vercelOidc } from 'eve/channels/auth';
import { eveChannel, eveVercelOidc, type EveAuthFn } from 'eve/channels/eve';

const WINDOW_MS = 10 * 60 * 1000;
const MAX = 30;
const hits = new Map<string, number[]>();

function ipOf(request: Request) {
  const xff = request.headers.get('x-forwarded-for');
  if (xff) return xff.split(',')[0].trim();
  return request.headers.get('x-real-ip') || 'unknown';
}

function rateOk(ip: string) {
  const now = Date.now();
  const arr = (hits.get(ip) || []).filter(t => now - t < WINDOW_MS);
  if (arr.length >= MAX) {
    hits.set(ip, arr);
    return false;
  }
  arr.push(now);
  hits.set(ip, arr);
  return true;
}

const anonymous = none();
const dev = localDev();

const publicChat: EveAuthFn = async (request) => {
  if (!rateOk(ipOf(request))) {
    throw new ForbiddenError({ message: 'Slow down — try again in a few minutes.' });
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
