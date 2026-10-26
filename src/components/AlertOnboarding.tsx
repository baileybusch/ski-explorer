import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { FlowShell, useAutoAdvance } from '@/components/FlowShell';
import { type AlertsUiMode } from '@/lib/alertsUi';
import { sensitivityOf } from '../../lib/alertDefaults.js';
import { loadPrefs } from '@/lib/session';
import {
  type LocalRule, accountEmail, addLocalRule, setAccountEmail, updateLocalRule,
} from '@/lib/alertRules';
import { CONSENT_TEXT } from '../../lib/consentText.js';

export type AlertContext = {
  resortId?: string | null;
  resortName?: string | null;
  pass?: string;
  email?: string | null;
  source?: 'incoming' | 'resort' | 'menu' | 'edit' | 'signup';
};

const STEPS = ['resorts', 'confirm', 'success'] as const;
type Step = typeof STEPS[number];

function namesOf(ids: string[], resorts: { id: string; name: string }[]) {
  return ids.map(id => resorts.find(r => r.id === id)?.name || id);
}

function validEmail(addr: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(addr.trim());
}

export function AlertOnboarding({
  open, onOpenChange, ctx, mode, resorts = [], editRule, onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  ctx: AlertContext;
  mode: AlertsUiMode;
  resorts?: { id: string; name: string }[];
  editRule?: LocalRule | null;
  onSaved?: () => void;
}) {
  const [step, setStep] = useState<Step>('resorts');
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<string[]>([]);
  const [stormOn, setStormOn] = useState(true);
  const [recapOn, setRecapOn] = useState(true);
  const [email, setEmail] = useState('');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const advance = useAutoAdvance();

  useEffect(() => {
    if (!open) return;
    const startIds = editRule?.resorts?.length
      ? editRule.resorts
      : ctx.resortId ? [ctx.resortId] : [];
    setSelected(startIds);
    setStormOn(editRule ? editRule.freq !== 'weekly' : true);
    setRecapOn(editRule ? editRule.recap !== false : true);
    setEmail(editRule?.email || ctx.email || accountEmail() || '');
    setQuery('');
    setMsg('');
    setStep(startIds.length && !editRule ? 'confirm' : 'resorts');
  }, [open, ctx.resortId, ctx.email, editRule]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = q
      ? resorts.filter(r => r.name.toLowerCase().includes(q) || r.id.includes(q))
      : resorts;
    const picked = list.filter(r => selected.includes(r.id));
    const rest = list.filter(r => !selected.includes(r.id));
    return [...picked, ...rest].slice(0, 40);
  }, [query, resorts, selected]);

  const labels = namesOf(selected, resorts);
  const where = labels.length ? labels.join(', ') : 'your resorts';
  const preview = `We'll email you when ${where} is about to get dumped on.`;

  function pickResort(id: string) {
    setSelected([id]);
    setMsg('');
    const addr = (email || ctx.email || '').trim();
    advance(() => {
      if (validEmail(addr) && ctx.source === 'signup') submit([id], addr);
      else setStep('confirm');
    });
  }

  function back() {
    if (step === 'resorts') onOpenChange(false);
    else if (step === 'success') onOpenChange(false);
    else setStep('resorts');
  }

  async function submit(ids = selected, addr = email) {
    const next = addr.trim();
    if (!validEmail(next)) {
      setMsg('Enter a valid email');
      setStep('confirm');
      return;
    }
    if (!ids.length) {
      setMsg('Pick at least one resort');
      setStep('resorts');
      return;
    }
    setBusy(true);
    setMsg('');
    const sense = sensitivityOf(loadPrefs().sensitivity);
    const payload: Partial<LocalRule> = {
      id: editRule?.id,
      email: next,
      watch: 'resort',
      pass: ctx.pass || 'both',
      resorts: ids,
      minSnowIn: sense.minSnowIn,
      windowHours: sense.windowHours,
      freq: stormOn ? 'on-trigger' : 'weekly',
      recap: recapOn,
    };
    try {
      setAccountEmail(next);
      if (mode !== 'live') {
        if (editRule?.id) updateLocalRule(editRule.id, payload);
        else addLocalRule(payload);
        onSaved?.();
        setStep('success');
        return;
      }
      const r = await fetch('/api/subscribe', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ ...payload, source: ctx.source || 'signup' }),
      });
      const j = await r.json().catch(() => ({ error: 'Could not save' }));
      if (j.error) {
        setMsg(j.error);
        setStep('confirm');
        return;
      }
      onSaved?.();
      setStep('success');
    } finally {
      setBusy(false);
    }
  }

  const title = {
    resorts: 'Which resort?',
    confirm: 'Your email',
    success: "You're set.",
  }[step];

  const hint = mode === 'preview'
    ? 'Preview only — saved on this device. Nothing is emailed.'
    : mode === 'live'
      ? 'One-click unsubscribe in every email.'
      : 'Alerts are paused. Rules stay on this device.';

  const footer = step === 'success' ? (
    <>
      <Button type="button" variant="outline" className="min-h-12 w-full text-base" data-testid="alert-add-another" onClick={() => { setSelected([]); setStep('resorts'); }}>
        Add another resort
      </Button>
      <Button type="button" className="min-h-12 w-full text-base" onClick={() => onOpenChange(false)}>
        Done
      </Button>
    </>
  ) : step === 'confirm' ? (
    <Button type="button" className="min-h-12 w-full text-base" disabled={busy} onClick={() => submit()} data-testid="alert-submit">
      {busy ? 'Saving…' : editRule ? 'Save alert' : 'Turn on alerts'}
    </Button>
  ) : (
    <Button
      type="button"
      className="min-h-12 w-full text-base"
      disabled={!selected.length}
      data-testid="alert-next"
      onClick={() => (validEmail(email) && ctx.source === 'signup' ? submit() : setStep('confirm'))}
    >
      Continue
    </Button>
  );

  return (
    <FlowShell
      open={open}
      testId="alert-onboarding"
      onClose={() => onOpenChange(false)}
      onBack={step === 'success' ? undefined : back}
      title={title}
      hint={hint}
      progress={step === 'success' ? 2 : STEPS.indexOf(step) + 1}
      total={2}
      footer={footer}
    >
      {step === 'resorts' ? (
        <div className="mt-5 flex min-w-0 flex-col gap-3">
          <Input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search resorts"
            className="min-h-12 min-w-0"
            data-testid="alert-search"
            autoComplete="off"
          />
          <div className="flex min-w-0 flex-col gap-2">
            {filtered.map(r => {
              const on = selected.includes(r.id);
              return (
                <button
                  key={r.id}
                  type="button"
                  data-testid={`alert-resort-${r.id}`}
                  className={`min-h-12 min-w-0 rounded-2xl px-4 text-left text-base ring-1 ${on ? 'bg-foreground text-background ring-foreground' : 'ring-foreground/12'}`}
                  onClick={() => pickResort(r.id)}
                >
                  {r.name}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}

      {step === 'confirm' ? (
        <div className="mt-6 flex min-w-0 flex-col gap-4">
          <Input
            type="email"
            inputMode="email"
            autoComplete="email"
            className="min-h-12 min-w-0"
            placeholder="you@email.com"
            value={email}
            onChange={e => setEmail(e.target.value)}
            data-testid="alert-email"
          />
          <div className="rounded-2xl bg-card p-4 text-base leading-relaxed ring-1 ring-foreground/12" data-testid="alert-preview">
            {preview}
          </div>
          <label className="flex min-h-12 items-center justify-between gap-3 text-sm">
            <span>Storm alerts</span>
            <Switch checked={stormOn} onCheckedChange={setStormOn} data-testid="alert-storm-toggle" />
          </label>
          <label className="flex min-h-12 items-center justify-between gap-3 text-sm">
            <span>Weekly recap</span>
            <Switch checked={recapOn} onCheckedChange={setRecapOn} data-testid="alert-recap-toggle" />
          </label>
          <p className="text-sm text-muted-foreground" data-testid="alert-consent">
            {CONSENT_TEXT}
          </p>
          {msg ? <p className="text-sm text-destructive" data-testid="alert-msg">{msg}</p> : null}
        </div>
      ) : null}

      {step === 'success' ? (
        <div className="mt-6 flex flex-col gap-4" data-testid="alert-success">
          <p className="text-lg leading-relaxed">
            You&apos;re set. We&apos;ll email you when {where} is about to get dumped on.
          </p>
          <p className="text-sm text-muted-foreground" data-testid="alert-check-email">
            {mode === 'live' ? 'Check your email and tap the confirmation link. Alerts start only after you confirm.' : 'Saved on this device. Nothing was emailed.'}
          </p>
        </div>
      ) : null}
    </FlowShell>
  );
}
