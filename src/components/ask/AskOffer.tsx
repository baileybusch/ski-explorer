import { useEffect, useRef, useState, type FormEvent } from 'react';
import { BellIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ConsentNote } from '@/components/ConsentNote';
import { accountEmail } from '@/lib/alertRules';
import { alertsUiState, sensitivityOf } from '@/lib/alertsUi';
import { loadPrefs } from '@/lib/session';
import { subscribeRule, validEmail } from '@/lib/subscribe';
import { doNotSell, setOfferState, track } from '@/lib/visitor';
import type { OfferOutput, OfferTarget } from '@/lib/askTypes';

type Phase = 'ask' | 'busy' | 'done' | 'dismissed';

/**
 * Ask's inline "alert me" card. Shown at most once per session (lib/ask/offer.js decides);
 * "No thanks" dismisses it for the rest of the session.
 */
export function AlertOffer({ out, onPick }: { out: OfferOutput; onPick?: (target: OfferTarget | null) => void }) {
  const [phase, setPhase] = useState<Phase>('ask');
  const [email, setEmail] = useState(() => accountEmail());
  const [msg, setMsg] = useState('');
  const mode = alertsUiState().mode;
  const target = out.target;
  const tracked = useRef(false);

  useEffect(() => {
    if (tracked.current) return;
    tracked.current = true;
    setOfferState({ shown: true });
    track({ type: 'offer', action: 'shown', target: target ? { type: target.type, id: target.id } : null });
  }, [target]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!target) return;
    if (!validEmail(email)) { setMsg('Enter a valid email'); return; }
    setPhase('busy');
    setMsg('');
    const sense = sensitivityOf(loadPrefs().sensitivity);
    const payload = target.type === 'resort'
      ? { type: 'resort' as const, watch: 'resort' as const, resorts: [target.id], region: null }
      : { type: 'region' as const, watch: 'region' as const, resorts: [], region: target.id, regionScope: 'all' as const };
    const r = await subscribeRule({
      payload: { ...payload, email, pass: 'both', minSnowIn: sense.minSnowIn, windowHours: sense.windowHours, freq: 'on-trigger', recap: true },
      mode,
      source: 'chat',
      extra: { doNotSell: doNotSell() },
    });
    if ('error' in r) {
      setMsg(r.error);
      setPhase('ask');
      return;
    }
    setOfferState({ subscribed: true });
    track({ type: 'offer', action: 'accepted', target: { type: target.type, id: target.id } });
    setPhase('done');
  }

  function dismiss() {
    setOfferState({ dismissed: true });
    track({ type: 'offer', action: 'dismissed', target: target ? { type: target.type, id: target.id } : null });
    setPhase('dismissed');
  }

  if (phase === 'dismissed') {
    return (
      <p className="text-[13px] text-muted-foreground" data-testid="ask-offer-dismissed">
        No problem. Ask me to set up alerts anytime.
      </p>
    );
  }

  return (
    <section className="rounded-xl bg-card px-3.5 pt-3 pb-3.5 ring-1 ring-foreground/15" data-testid="ask-offer" data-target={target?.id || ''} data-reason={out.reason}>
      <header className="flex items-start gap-2.5">
        <span className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-full bg-foreground/10"><BellIcon className="size-3.5" /></span>
        <p className="text-[15px] leading-snug font-medium" data-testid="ask-offer-headline">{out.headline}</p>
      </header>
      {phase === 'done' ? (
        <div className="mt-3 pl-[2.375rem]" data-testid="ask-offer-done">
          <p className="text-[15px] leading-snug">You&apos;re set. We&apos;ll email you when {target?.name} gets dumped on.</p>
          <p className="mt-1 text-[13px] text-muted-foreground">
            {mode === 'live' ? 'Check your inbox and tap the confirmation link to start alerts.' : 'Preview only. Saved on this device; nothing is emailed.'}
          </p>
        </div>
      ) : target ? (
        <form className="mt-3 flex flex-col gap-2 pl-[2.375rem]" onSubmit={submit}>
          <div className="flex gap-2">
            <Input
              type="email"
              inputMode="email"
              autoComplete="email"
              placeholder="you@email.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="min-h-11 min-w-0 flex-1 text-base"
              aria-label="Email for snow alerts"
              data-testid="ask-offer-email"
            />
            <Button type="submit" className="min-h-11 px-4" disabled={phase === 'busy'} data-testid="ask-offer-submit">
              {phase === 'busy' ? 'Saving…' : 'Alert me'}
            </Button>
          </div>
          {msg ? <p className="text-[13px] text-destructive" data-testid="ask-offer-msg">{msg}</p> : null}
          <ConsentNote className="text-[11px]" testId="ask-offer-consent" />
          <Button type="button" variant="ghost" size="sm" className="-ml-2 min-h-9 self-start px-2 text-[13px] text-muted-foreground" onClick={dismiss} data-testid="ask-offer-dismiss">
            No thanks
          </Button>
        </form>
      ) : (
        <div className="mt-3 flex items-center gap-2 pl-[2.375rem]">
          <Button type="button" className="min-h-11 px-4" onClick={() => onPick?.(null)} data-testid="ask-offer-pick">Pick my mountains</Button>
          <Button type="button" variant="ghost" className="min-h-11 px-3 text-[13px] text-muted-foreground" onClick={dismiss} data-testid="ask-offer-dismiss">No thanks</Button>
        </div>
      )}
    </section>
  );
}
