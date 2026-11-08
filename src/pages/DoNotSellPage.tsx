import { useState } from 'react';
import { toast } from 'sonner';
import { BrandLogo } from '@/components/BrandLogo';
import { SiteFooter } from '@/components/SiteFooter';
import { Button } from '@/components/ui/button';
import { alertsUiState, withAlerts } from '@/lib/alertsUi';
import { loadPrefs, savePrefs, sessionEmail } from '@/lib/session';
import { doNotSell, setDoNotSell, visitorId } from '@/lib/visitor';
import { DNS_LINK_TEXT } from '../../lib/consentText.js';

/** CCPA opt-out. Flags this browser (and the signed-in account in live mode); partner exports honor it. */
export function DoNotSellPage() {
  const [on, setOn] = useState(() => doNotSell() || loadPrefs().doNotSell);
  const email = sessionEmail();
  const live = alertsUiState().mode === 'live';

  async function toggle(next: boolean) {
    setDoNotSell(next);
    savePrefs({ ...loadPrefs(), doNotSell: next });
    setOn(next);
    if (live && email) {
      await fetch('/api/auth?action=save', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ prefs: { ...loadPrefs(), doNotSell: next }, sid: visitorId() }),
      }).catch(() => null);
    }
    toast.success(next ? 'Opted out of sale and sharing.' : 'Opt-out removed.');
  }

  return (
    <div className="min-h-dvh bg-background text-foreground" data-testid="dns-page" data-opted-out={on ? '1' : '0'}>
      <header className="mx-auto flex w-full max-w-xl items-center justify-between px-3 pt-[max(0.55rem,env(safe-area-inset-top))]">
        <a href={withAlerts('/')} className="flex min-h-11 items-center gap-2">
          <BrandLogo size="page" />
        </a>
      </header>
      <main className="mx-auto flex w-full max-w-xl flex-col gap-5 px-3 py-8 text-base leading-relaxed">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">Draft pending lawyer review</p>
        <h1 className="font-display text-5xl leading-none tracking-wide">{DNS_LINK_TEXT}</h1>
        <p className="text-muted-foreground">
          We may share or sell interest data (the mountains you watch, the questions you ask in Ask, and your email) with sponsors and partners. You can opt out at any time. Opting out does not stop your alerts; we keep using your data only to run them.
        </p>
        <div className="rounded-2xl p-4 ring-1 ring-foreground/12" data-testid="dns-status">
          <p className="font-medium">{on ? 'You are opted out.' : 'You are not opted out.'}</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {email
              ? `Applies to this browser and ${email}${live ? '' : ' (preview: saved on this device)'}.`
              : 'Applies to this browser. Sign in on My alerts to apply it to your email on every device.'}
          </p>
          <Button type="button" className="mt-4 min-h-12 w-full text-base" variant={on ? 'outline' : 'default'} onClick={() => toggle(!on)} data-testid="dns-toggle">
            {on ? 'Allow sharing again' : 'Opt out of sale and sharing'}
          </Button>
        </div>
        <p className="text-sm text-muted-foreground">
          Questions or a request from an authorized agent: baileybusch@gmail.com. See the <a className="underline underline-offset-2" href={withAlerts('/privacy')}>Privacy Policy</a>.
        </p>
      </main>
      <SiteFooter />
    </div>
  );
}
