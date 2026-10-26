import { useEffect, useMemo, useState } from 'react';
import { ChevronLeftIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { THRESHOLDS, WINDOWS, type AlertsUiMode } from '@/lib/alertsUi';
import {
  type LocalRule, accountEmail, addLocalRule, setAccountEmail, updateLocalRule,
} from '@/lib/alertRules';

export type AlertContext = {
  resortId?: string | null;
  resortName?: string | null;
  pass?: string;
  source?: 'incoming' | 'resort' | 'menu' | 'edit';
};

const STEPS = ['resorts', 'inches', 'window', 'emails', 'confirm', 'success'] as const;
type Step = typeof STEPS[number];

function namesOf(ids: string[], resorts: { id: string; name: string }[]) {
  return ids.map(id => resorts.find(r => r.id === id)?.name || id);
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
  const [minSnowIn, setMinSnowIn] = useState(12);
  const [windowHours, setWindowHours] = useState(72);
  const [stormOn, setStormOn] = useState(true);
  const [recapOn, setRecapOn] = useState(true);
  const [email, setEmail] = useState('');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    const startIds = editRule?.resorts?.length
      ? editRule.resorts
      : ctx.resortId ? [ctx.resortId] : [];
    setSelected(startIds);
    setMinSnowIn(editRule?.minSnowIn || 12);
    setWindowHours(editRule?.windowHours || 72);
    setStormOn(editRule ? editRule.freq !== 'weekly' : true);
    setRecapOn(editRule ? editRule.recap !== false : true);
    setEmail(editRule?.email || accountEmail() || '');
    setQuery('');
    setMsg('');
    setStep('resorts');
  }, [open, ctx.resortId, editRule]);

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
  const win = WINDOWS.find(w => w.id === windowHours)?.label || '72h';
  const preview = `We'll email you when ${where} is about to get ${minSnowIn}″ in ${win}.`;

  function toggle(id: string) {
    setSelected(cur => (cur.includes(id) ? cur.filter(x => x !== id) : [...cur, id]));
  }

  function next() {
    const i = STEPS.indexOf(step);
    if (i < STEPS.length - 1) setStep(STEPS[i + 1]);
  }

  function back() {
    const i = STEPS.indexOf(step);
    if (i <= 0) onOpenChange(false);
    else setStep(STEPS[i - 1]);
  }

  async function submit() {
    const addr = email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(addr)) {
      setMsg('Enter a valid email');
      return;
    }
    if (!selected.length) {
      setMsg('Pick at least one resort');
      setStep('resorts');
      return;
    }
    setBusy(true);
    setMsg('');
    const payload: Partial<LocalRule> = {
      id: editRule?.id,
      email: addr,
      watch: 'resort',
      pass: ctx.pass || 'both',
      resorts: selected,
      minSnowIn,
      windowHours,
      freq: stormOn ? 'on-trigger' : 'weekly',
      recap: recapOn,
    };
    try {
      setAccountEmail(addr);
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
        body: JSON.stringify(payload),
      });
      const j = await r.json().catch(() => ({ error: 'Could not save' }));
      if (j.error) {
        setMsg(j.error);
        return;
      }
      onSaved?.();
      setStep('success');
    } finally {
      setBusy(false);
    }
  }

  if (!open) return null;
  const progress = Math.min(5, STEPS.indexOf(step) + 1);
  const question = {
    resorts: 'Which resorts?',
    inches: 'How much snow to trigger?',
    window: 'How far ahead?',
    emails: 'What emails?',
    confirm: 'Confirm your email',
    success: "You're set.",
  }[step];

  return (
    <div className="fixed inset-0 z-50 bg-background sm:bg-black/50 sm:grid sm:place-items-center" data-testid="alert-onboarding">
      <div className="flex h-full w-full flex-col bg-background sm:h-auto sm:max-h-[90dvh] sm:max-w-lg sm:rounded-2xl sm:ring-1 sm:ring-foreground/12">
        <div className="flex items-center gap-2 px-3 pt-[max(0.55rem,env(safe-area-inset-top))]">
          {step !== 'success' ? (
            <Button type="button" variant="ghost" className="min-h-11 min-w-11 rounded-full" aria-label="Back" data-testid="alert-back" onClick={back}>
              <ChevronLeftIcon />
            </Button>
          ) : <div className="w-11" />}
          <div className="flex flex-1 justify-center gap-1.5" data-testid="alert-progress">
            {STEPS.slice(0, 5).map((id, i) => (
              <span key={id} className={`h-1.5 w-8 rounded-full ${i < progress ? 'bg-foreground' : 'bg-foreground/20'}`} />
            ))}
          </div>
          <Button type="button" variant="ghost" className="min-h-11 px-2 text-base" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-6">
          <p className="text-sm text-muted-foreground">
            {mode === 'preview'
              ? 'Preview only — saved on this device. Nothing is emailed.'
              : mode === 'live'
                ? 'No password. One-click unsubscribe in every email.'
                : 'Alerts are paused. Rules stay on this device.'}
          </p>
          <h2 className="mt-2 font-display text-4xl tracking-wide">{question}</h2>

          {step === 'resorts' ? (
            <div className="mt-5 flex flex-col gap-3">
              <Input
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Search resorts"
                className="min-h-12"
                data-testid="alert-resort-search"
                autoComplete="off"
              />
              <div className="flex flex-col gap-2">
                {filtered.map(r => {
                  const on = selected.includes(r.id);
                  return (
                    <button
                      key={r.id}
                      type="button"
                      data-testid={`alert-resort-${r.id}`}
                      className={`min-h-12 rounded-2xl px-4 text-left text-base ring-1 ${on ? 'bg-foreground text-background ring-foreground' : 'ring-foreground/12'}`}
                      onClick={() => toggle(r.id)}
                    >
                      {r.name}
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}

          {step === 'inches' ? (
            <div className="mt-6 flex flex-col gap-3">
              {THRESHOLDS.map(t => (
                <button
                  key={t.id}
                  type="button"
                  data-testid={`alert-inches-${t.id}`}
                  className={`min-h-20 rounded-2xl px-5 text-left ring-1 ${minSnowIn === t.id ? 'bg-foreground text-background ring-foreground' : 'ring-foreground/12'}`}
                  onClick={() => setMinSnowIn(t.id)}
                >
                  <div className="font-display text-4xl">{t.label}</div>
                  <div className="text-sm opacity-70">{t.hint}</div>
                </button>
              ))}
            </div>
          ) : null}

          {step === 'window' ? (
            <div className="mt-6 grid grid-cols-2 gap-3">
              {WINDOWS.map(w => (
                <button
                  key={w.id}
                  type="button"
                  data-testid={`alert-window-${w.id}`}
                  className={`min-h-20 rounded-2xl px-4 text-center ring-1 ${windowHours === w.id ? 'bg-foreground text-background ring-foreground' : 'ring-foreground/12'}`}
                  onClick={() => setWindowHours(w.id)}
                >
                  <div className="font-display text-3xl">{w.id === 168 ? '7d' : w.label}</div>
                  {w.id === 168 ? <div className="mt-1 text-xs opacity-70">next 7 days</div> : null}
                </button>
              ))}
            </div>
          ) : null}

          {step === 'emails' ? (
            <div className="mt-6 flex flex-col gap-4">
              <label className="flex min-h-16 items-center justify-between gap-4 rounded-2xl px-4 ring-1 ring-foreground/12">
                <span className="text-base">Storm alerts</span>
                <Switch checked={stormOn} onCheckedChange={setStormOn} data-testid="alert-storm-toggle" />
              </label>
              <label className="flex min-h-16 items-center justify-between gap-4 rounded-2xl px-4 ring-1 ring-foreground/12">
                <span className="text-base">Weekly recap</span>
                <Switch checked={recapOn} onCheckedChange={setRecapOn} data-testid="alert-recap-toggle" />
              </label>
            </div>
          ) : null}

          {step === 'confirm' ? (
            <div className="mt-6 flex flex-col gap-4">
              <Input
                type="email"
                inputMode="email"
                autoComplete="email"
                className="min-h-12"
                placeholder="you@email.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                data-testid="alert-email"
              />
              <div className="rounded-2xl bg-card p-4 text-base leading-relaxed ring-1 ring-foreground/12" data-testid="alert-preview">
                {preview}
              </div>
              <p className="text-sm text-muted-foreground">
                No password. We only use this address for snow alerts. Unsubscribe sits in every email.
              </p>
              {msg ? <p className="text-sm text-destructive" data-testid="alert-msg">{msg}</p> : null}
            </div>
          ) : null}

          {step === 'success' ? (
            <div className="mt-6 flex flex-col gap-4" data-testid="alert-success">
              <p className="text-lg leading-relaxed">
                You&apos;re set. We&apos;ll email you when {where} is about to get {minSnowIn}″.
              </p>
              <p className="text-sm text-muted-foreground">
                {mode === 'live' ? 'Watch the inbox when a storm lines up.' : 'Saved on this device. Nothing was emailed.'}
              </p>
            </div>
          ) : null}
        </div>

        <div className="flex flex-col gap-2 px-5 pb-[max(1rem,env(safe-area-inset-bottom))] pt-2">
          {step === 'success' ? (
            <>
              <Button type="button" variant="outline" className="min-h-12 w-full text-base" data-testid="alert-add-another" onClick={() => { setSelected([]); setStep('resorts'); }}>
                Add another resort
              </Button>
              <Button type="button" className="min-h-12 w-full text-base" onClick={() => onOpenChange(false)}>
                Done
              </Button>
            </>
          ) : step === 'confirm' ? (
            <Button type="button" className="min-h-12 w-full text-base" disabled={busy} onClick={submit} data-testid="alert-submit">
              {busy ? 'Saving…' : editRule ? 'Save alert' : 'Turn on alerts'}
            </Button>
          ) : (
            <Button
              type="button"
              className="min-h-12 w-full text-base"
              disabled={step === 'resorts' && !selected.length}
              data-testid="alert-next"
              onClick={next}
            >
              Continue
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
